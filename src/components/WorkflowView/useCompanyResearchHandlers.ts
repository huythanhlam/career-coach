import { useCallback, useState } from "react";
import {
  researchCompanyProfile, researchCompanyNews, assembleCompanyResearch, CompanyResearchResult,
} from "@/services/geminiService";
import { getCachedCompanyResearch, putCachedCompanyResearch } from "@/config/companyResearchCache";
import { getCompanyProfile, requestCompanyProfile, type RequestProfileResult } from "@/services/companyProfileService";
import type { CompanyProfile } from "@/types/companyProfile";

export function useCompanyResearchHandlers() {
  const [companyJobDetails, setCompanyJobDetails] = useState({ jobTitle: "", companyName: "", jobDescription: "" });
  const [companyResult, setCompanyResult] = useState<CompanyResearchResult | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [companyCachedAt, setCompanyCachedAt] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [requestState, setRequestState] = useState<RequestProfileResult | "requesting" | null>(null);

  const fetchProfileFresh = async (company: string) => {
    const p = await researchCompanyProfile({ jobTitle: "", companyName: company, jobDescription: "" });
    await putCachedCompanyResearch(company, "profile", p);
    return p;
  };

  const fetchNewsFresh = async (company: string) => {
    const n = await researchCompanyNews({ jobTitle: "", companyName: company, jobDescription: "" });
    await putCachedCompanyResearch(company, "news", n);
    return n;
  };

  const runCompanyResearch = async (mode: "auto" | "news" | "all" = "auto", companyArg?: string) => {
    const company = (companyArg ?? companyJobDetails.companyName).trim();
    if (!company || isResearching || isRevalidating) return;

    if (mode === "auto") {
      const [cp, cn] = await Promise.all([
        getCachedCompanyResearch(company, "profile"),
        getCachedCompanyResearch(company, "news"),
      ]);
      if (cp && cn) {
        setCompanyResult(assembleCompanyResearch(cp.data, cn.data));
        setCompanyCachedAt(cp.cachedAt < cn.cachedAt ? cp.cachedAt : cn.cachedAt);
        if (!cp.fresh || !cn.fresh) {
          setIsRevalidating(true);
          try {
            const [p, n] = await Promise.all([
              cp.fresh ? Promise.resolve(cp.data) : fetchProfileFresh(company),
              cn.fresh ? Promise.resolve(cn.data) : fetchNewsFresh(company),
            ]);
            setCompanyResult(assembleCompanyResearch(p, n));
            setCompanyCachedAt(new Date().toISOString());
          } catch (err) { console.error(err); } finally { setIsRevalidating(false); }
        }
        return;
      }
      setIsResearching(true);
      try {
        const [p, n] = await Promise.all([
          cp?.data ?? fetchProfileFresh(company),
          cn?.data ?? fetchNewsFresh(company),
        ]);
        setCompanyResult(assembleCompanyResearch(p, n));
        setCompanyCachedAt(new Date().toISOString());
      } catch (err) { console.error(err); } finally { setIsResearching(false); }
      return;
    }

    setIsRevalidating(true);
    try {
      const wantP = mode === "all";
      const wantN = mode === "all" || mode === "news";
      const [p, n] = await Promise.all([
        wantP ? fetchProfileFresh(company) : getCachedCompanyResearch(company, "profile").then((c) => c?.data ?? fetchProfileFresh(company)),
        wantN ? fetchNewsFresh(company) : getCachedCompanyResearch(company, "news").then((c) => c?.data ?? fetchNewsFresh(company)),
      ]);
      setCompanyResult(assembleCompanyResearch(p, n));
      setCompanyCachedAt(new Date().toISOString());
    } catch (err) { console.error(err); } finally { setIsRevalidating(false); }
  };

  const startCompanyResearch = async (name: string) => {
    const company = (name ?? "").trim();
    if (!company || isResearching || isRevalidating) return;
    setCompanyJobDetails({ jobTitle: "", companyName: company, jobDescription: "" });
    setProfileMissing(false);
    setRequestState(null);
    setIsResearching(true);
    try {
      const profile = await getCompanyProfile(company);
      if (profile) {
        setCompanyProfile(profile);
        setIsResearching(false);
        return;
      }
    } catch { /* fall through to AI */ }
    setProfileMissing(true);
    setIsResearching(false);
    await runCompanyResearch("auto", company);
  };

  const resetCompanyResult = useCallback(() => {
    setCompanyResult(null);
    setCompanyCachedAt(null);
    setProfileMissing(false);
    setRequestState(null);
  }, []);

  const submitProfileRequest = async () => {
    setRequestState("requesting");
    const result = await requestCompanyProfile(companyJobDetails.companyName);
    setRequestState(result);
  };

  return {
    companyJobDetails,
    companyResult,
    isResearching,
    isRevalidating,
    companyCachedAt,
    companyProfile,
    profileMissing,
    requestState,
    setCompanyProfile,
    setCompanyResult,
    setCompanyCachedAt,
    setProfileMissing,
    setRequestState,
    resetCompanyResult,
    runCompanyResearch,
    startCompanyResearch,
    submitProfileRequest,
  };
}
