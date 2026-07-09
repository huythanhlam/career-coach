import { useCallback, useRef, useState } from "react";
import {
  researchCompanyProfileStreaming,
  researchCompanyNewsStreaming,
  assembleCompanyResearch,
  CompanyResearchResult,
  type CompanyProfileData,
} from "@/services/geminiService";
import { fetchCareerPageContext } from "@/services/companyCareerService";
import { getCachedCompanyResearch, putCachedCompanyResearch } from "@/config/companyResearchCache";
import {
  getCompanyProfile,
  requestCompanyProfile,
  type RequestProfileResult,
} from "@/services/companyProfileService";
import type { CompanyProfile } from "@/types/companyProfile";

/** Fill in whatever prose fields a progressive company-research update carries, keeping the rest from `prev`. */
function mergeProfilePartial(
  prev: CompanyProfileData | null,
  partial: Partial<CompanyProfileData>,
): CompanyProfileData {
  const empty = {
    summary: "",
    bullets: [] as string[],
    sources: [] as CompanyProfileData["sources"],
  };
  return {
    overview: partial.overview ?? prev?.overview ?? "",
    hiringValues: partial.hiringValues ?? prev?.hiringValues ?? empty,
    benefits: partial.benefits ?? prev?.benefits ?? empty,
    interviewTips: partial.interviewTips ?? prev?.interviewTips ?? empty,
    financials: partial.financials ?? prev?.financials ?? empty,
    ticker: prev?.ticker ?? "",
    sources: prev?.sources ?? [],
  };
}

export function useCompanyResearchHandlers() {
  const [companyJobDetails, setCompanyJobDetails] = useState({
    jobTitle: "",
    companyName: "",
    jobDescription: "",
  });
  const [companyResult, setCompanyResult] = useState<CompanyResearchResult | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [companyCachedAt, setCompanyCachedAt] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  // AI career insights (culture/benefits/interview tips from crawling the
  // careers site) shown ALONGSIDE a deterministic profile.
  const [careerInsights, setCareerInsights] = useState<CompanyProfileData | null>(null);
  const [careerInsightsLoading, setCareerInsightsLoading] = useState(false);
  const [profileMissing, setProfileMissing] = useState(false);
  const [requestState, setRequestState] = useState<RequestProfileResult | "requesting" | null>(
    null,
  );
  // Cancels an in-flight research fetch (real AbortController, mirrors GlobalChatPanel).
  const abortRef = useRef<AbortController | null>(null);
  const stopResearching = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const fetchProfileFresh = async (
    company: string,
    onSection?: (partial: Partial<CompanyProfileData>) => void,
    signal?: AbortSignal,
  ) => {
    // Navigate the company's own careers pages first so the profile is grounded
    // in primary-source text (culture, benefits, interview process). Best-effort.
    const careerContext = await fetchCareerPageContext(company).catch(() => ({
      text: "",
      sources: [],
    }));
    const p = await researchCompanyProfileStreaming(
      {
        jobTitle: "",
        companyName: company,
        jobDescription: "",
        careerContext,
      },
      onSection,
      signal,
    );
    await putCachedCompanyResearch(company, "profile", p);
    return p;
  };

  /**
   * Load AI career insights (hiring values, benefits, interview tips — extracted
   * from crawling the company's careers site) to enrich a deterministic profile.
   * Reuses the cached "profile" research tier (stale-while-revalidate). Silent on
   * failure — the deterministic profile still renders without it. Streams
   * progressively: each section's summary fills in as soon as it finishes,
   * instead of the whole panel appearing at once.
   */
  const loadCareerInsights = async (company: string) => {
    setCareerInsights(null);
    const onSection = (partial: Partial<CompanyProfileData>) =>
      setCareerInsights((prev) => mergeProfilePartial(prev, partial));
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const cached = await getCachedCompanyResearch(company, "profile");
      if (cached) {
        setCareerInsights(cached.data);
        if (!cached.fresh)
          fetchProfileFresh(company, onSection, controller.signal)
            .then(setCareerInsights)
            .catch(() => {});
        return;
      }
      setCareerInsightsLoading(true);
      setCareerInsights(await fetchProfileFresh(company, onSection, controller.signal));
    } catch (err) {
      if (!controller.signal.aborted) console.error(err);
    } finally {
      setCareerInsightsLoading(false);
      abortRef.current = null;
    }
  };

  const fetchNewsFresh = async (company: string, signal?: AbortSignal) => {
    const n = await researchCompanyNewsStreaming(
      {
        jobTitle: "",
        companyName: company,
        jobDescription: "",
      },
      undefined,
      signal,
    );
    await putCachedCompanyResearch(company, "news", n);
    return n;
  };

  const runCompanyResearch = async (
    mode: "auto" | "news" | "all" = "auto",
    companyArg?: string,
  ) => {
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
          const controller = new AbortController();
          abortRef.current = controller;
          try {
            const [p, n] = await Promise.all([
              cp.fresh
                ? Promise.resolve(cp.data)
                : fetchProfileFresh(company, undefined, controller.signal),
              cn.fresh ? Promise.resolve(cn.data) : fetchNewsFresh(company, controller.signal),
            ]);
            setCompanyResult(assembleCompanyResearch(p, n));
            setCompanyCachedAt(new Date().toISOString());
          } catch (err) {
            if (!controller.signal.aborted) console.error(err);
          } finally {
            setIsRevalidating(false);
            abortRef.current = null;
          }
        }
        return;
      }
      setIsResearching(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const [p, n] = await Promise.all([
          cp?.data ?? fetchProfileFresh(company, undefined, controller.signal),
          cn?.data ?? fetchNewsFresh(company, controller.signal),
        ]);
        setCompanyResult(assembleCompanyResearch(p, n));
        setCompanyCachedAt(new Date().toISOString());
      } catch (err) {
        if (!controller.signal.aborted) console.error(err);
      } finally {
        setIsResearching(false);
        abortRef.current = null;
      }
      return;
    }

    setIsRevalidating(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const wantP = mode === "all";
      const wantN = mode === "all" || mode === "news";
      const [p, n] = await Promise.all([
        wantP
          ? fetchProfileFresh(company, undefined, controller.signal)
          : getCachedCompanyResearch(company, "profile").then(
              (c) => c?.data ?? fetchProfileFresh(company, undefined, controller.signal),
            ),
        wantN
          ? fetchNewsFresh(company, controller.signal)
          : getCachedCompanyResearch(company, "news").then(
              (c) => c?.data ?? fetchNewsFresh(company, controller.signal),
            ),
      ]);
      setCompanyResult(assembleCompanyResearch(p, n));
      setCompanyCachedAt(new Date().toISOString());
    } catch (err) {
      if (!controller.signal.aborted) console.error(err);
    } finally {
      setIsRevalidating(false);
      abortRef.current = null;
    }
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
        // Enrich the deterministic profile with AI career insights (crawls the
        // company's careers site). Loads async with its own indicator.
        loadCareerInsights(company);
        return;
      }
    } catch {
      /* fall through to AI */
    }
    setProfileMissing(true);
    setIsResearching(false);
    await runCompanyResearch("auto", company);
  };

  const resetCompanyResult = useCallback(() => {
    setCompanyResult(null);
    setCompanyCachedAt(null);
    setCareerInsights(null);
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
    careerInsights,
    careerInsightsLoading,
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
    stopResearching,
  };
}
