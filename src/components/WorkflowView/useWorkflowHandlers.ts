import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/context/UserProfileContext";
import {
  createTechCoachChat, sendMessageStream, analyzeResume, ResumeAnalysisResult,
  analyzeLinkedInProfile, LinkedInAnalysisResult,
  researchCompanyProfile, researchCompanyNews, assembleCompanyResearch, CompanyResearchResult,
} from "@/services/geminiService";
import { parseDocumentToText } from "@/services/documentParserService";
import { captureLinkedInScreenshot, ScreenshotResult } from "@/services/linkedinScreenshotService";
import { LinkedInUploadSubmit } from "@/components/LinkedInUploadForm";
import { MarketCompData, marketToMarkdown } from "@/components/MarketCompensationViz";
import { marketCacheKey, getCachedMarketData, putCachedMarketData, getStaleRow } from "@/services/marketDataCache";
import { enrichWithBls } from "@/services/blsService";
import { useSavedAnalyses } from "@/hooks/useSavedAnalyses";
import { SavedCoverLetterPayload } from "@/components/CoverLetterWorkspace";
import { CoverLetterFormData } from "@/components/CoverLetterForm";
import { getCachedCompanyResearch, putCachedCompanyResearch } from "@/config/companyResearchCache";
import { getCompanyProfile, requestCompanyProfile, type RequestProfileResult } from "@/services/companyProfileService";
import type { CompanyProfile } from "@/types/companyProfile";
import { downloadResume, deleteResume } from "@/services/resumeStorageService";
import { WorkflowId } from "@/components/Sidebar";
import { workflowsConfig } from "@/config/workflows";

interface FileData { data: string; mimeType: string; objectUrl: string; name: string; }

export function useWorkflowHandlers(workflowId: WorkflowId) {
  const config = workflowsConfig[workflowId];
  const { profile, updateProfile } = useUserProfile();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fileData, setFileData] = useState<Record<string, FileData>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const rawFileMap = useRef<Record<string, File>>({});
  const [resumeGeneratorData, setResumeGeneratorData] = useState<Record<string, any> | null>(null);
  const [savedResumeText, setSavedResumeText] = useState<string | null>(null);
  const [coverLetterFormData, setCoverLetterFormData] = useState<CoverLetterFormData | null>(null);
  const [savedCoverLetterPayload, setSavedCoverLetterPayload] = useState<SavedCoverLetterPayload | null>(null);
  const [builderAnalysisText, setBuilderAnalysisText] = useState<string | null>(null);
  const [builderAnalysisResult, setBuilderAnalysisResult] = useState<ResumeAnalysisResult | null>(null);
  const [isBuilderAnalyzing, setIsBuilderAnalyzing] = useState(false);
  const [builderAnalysisFile, setBuilderAnalysisFile] = useState<{ file: File; objectUrl: string } | null>(null);
  const [loadingResumeId, setLoadingResumeId] = useState<string | null>(null);
  const [showTailor, setShowTailor] = useState(false);
  const [tailorInitialResume, setTailorInitialResume] = useState<{ text: string; name: string } | null>(null);
  const [marketData, setMarketData] = useState<MarketCompData | null>(null);
  const [marketCachedAt, setMarketCachedAt] = useState<string | null>(null);
  const [isGeneratingMarketData, setIsGeneratingMarketData] = useState(false);
  const [marketSaveState, setMarketSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [marketCopied, setMarketCopied] = useState(false);
  const { saveAnalysis: persistMarketAnalysis } = useSavedAnalyses();
  const [mainDocumentText, setMainDocumentText] = useState("");

  /* ── Research Company state ───────────────────────────────────── */
  const [companyJobDetails, setCompanyJobDetails] = useState({ jobTitle: "", companyName: "", jobDescription: "" });
  const [companyResult, setCompanyResult] = useState<CompanyResearchResult | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [companyCachedAt, setCompanyCachedAt] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [requestState, setRequestState] = useState<RequestProfileResult | "requesting" | null>(null);

  /* ── LinkedIn state ───────────────────────────────────────────── */
  const [linkedinSubmitted, setLinkedinSubmitted] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinResult, setLinkedinResult] = useState<LinkedInAnalysisResult | null>(null);
  const [isLinkedinAnalyzing, setIsLinkedinAnalyzing] = useState(false);
  const [linkedinScreenshot, setLinkedinScreenshot] = useState<ScreenshotResult | null>(null);
  const [isLinkedinCapturing, setIsLinkedinCapturing] = useState(false);
  const [linkedinFile, setLinkedinFile] = useState<{ file: File; objectUrl: string } | null>(null);

  /* ── Market handlers ──────────────────────────────────────────── */
  const handleSaveMarket = async () => {
    if (!marketData || marketSaveState === "saving") return;
    setMarketSaveState("saving");
    try {
      await persistMarketAnalysis({
        jobInput: [formData.role, formData.location, formData.secondaryLocation].filter(Boolean).join(" · "),
        yoe: formData.yoe ?? "",
        level: "",
        marketData,
        companyIntel: null,
        resumeFit: null,
        interviewStrategy: null,
        resumeFileName: null,
      });
      setMarketSaveState("saved");
    } catch (err) {
      console.error(err);
      setMarketSaveState("idle");
    }
  };

  const handleCopyMarket = async () => {
    if (!marketData) return;
    try {
      await navigator.clipboard.writeText(marketToMarkdown(marketData));
      setMarketCopied(true);
      setTimeout(() => setMarketCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  /* ── Company Research handlers ────────────────────────────────── */
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

  const submitProfileRequest = async () => {
    setRequestState("requesting");
    const result = await requestCompanyProfile(companyJobDetails.companyName);
    setRequestState(result);
  };

  /* ── LinkedIn handler ─────────────────────────────────────────── */
  const handleLinkedinSubmit = async ({ file, url, targetRole, screenshotFile }: LinkedInUploadSubmit) => {
    setLinkedinSubmitted(true);
    setLinkedinUrl(url);
    setLinkedinResult(null);
    setLinkedinScreenshot(null);
    setLinkedinFile(prev => { if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl); return { file, objectUrl: URL.createObjectURL(file) }; });
    setIsLinkedinAnalyzing(true);

    if (screenshotFile) {
      const reader = new FileReader();
      reader.onload = () => setLinkedinScreenshot({ image: reader.result as string, blocked: false });
      reader.readAsDataURL(screenshotFile);
    } else if (url) {
      setIsLinkedinCapturing(true);
      captureLinkedInScreenshot(url)
        .then(setLinkedinScreenshot)
        .catch(() => setLinkedinScreenshot(null))
        .finally(() => setIsLinkedinCapturing(false));
    }

    try {
      const text = await parseDocumentToText(file);
      const result = await analyzeLinkedInProfile(text, targetRole);
      setLinkedinResult(result);
      if (result.overallScore != null) {
        void updateProfile({ linkedinScore: result.overallScore, linkedinScoreAt: new Date().toISOString() });
      }
    } catch (err) {
      console.error("LinkedIn analysis failed:", err);
      setLinkedinResult({ profileText: "", overallScore: null, summary: "Analysis failed. Please try again.", improvements: [], designRecommendations: [] });
    } finally {
      setIsLinkedinAnalyzing(false);
    }
  };

  /* ── Market analysis ──────────────────────────────────────────── */
  const tryParseMarketData = (text: string): MarketCompData | null => {
    try {
      const match = text.match(/```json\s*([\s\S]*?)\s*(?:```|$)/);
      if (match?.[1]) {
        const parsed = JSON.parse(match[1]);
        if (parsed.locations && Array.isArray(parsed.locations)) return parsed;
      }
    } catch { /* ignore */ }
    return null;
  };

  const runMarketAnalysis = async (forceRefresh = false) => {
    if (isGeneratingMarketData) return;
    setIsGeneratingMarketData(true);
    setMarketSaveState("idle");
    const parts = {
      role: formData.role ?? "",
      location: formData.location ?? "",
      secondaryLocation: formData.secondaryLocation,
      yoe: formData.yoe ?? "",
    };
    const key = marketCacheKey(parts);
    try {
      if (!forceRefresh) {
        const cached = await getCachedMarketData(key);
        if (cached) {
          setMarketData(cached.data);
          setMarketCachedAt(cached.cachedAt);
          return;
        }
      }
      const prompt = config.generatePrompt(formData);
      const chat = createTechCoachChat(config.systemInstruction, config.enableSearch);
      let full = "";
      await sendMessageStream(chat, prompt as string, chunk => { full += chunk; });
      const parsed = tryParseMarketData(full);
      if (parsed) {
        const prior = forceRefresh ? undefined : (await getStaleRow(key))?.locations;
        const enriched = await enrichWithBls(parsed, parts.role, prior);
        setMarketData(enriched);
        setMarketCachedAt(new Date().toISOString());
        void putCachedMarketData(key, parts, enriched);
      } else {
        setMarketData(null);
        setMarketCachedAt(null);
        setMainDocumentText(full);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingMarketData(false);
    }
  };

  /* ── Form handlers ────────────────────────────────────────────── */
  const handleInputChange = (id: string, value: string) =>
    setFormData(prev => ({ ...prev, [id]: value }));

  const handleFileChange = async (id: string, file: File | null) => {
    if (!file) {
      delete rawFileMap.current[id];
      setFileData(prev => { const n = { ...prev }; if (n[id]?.objectUrl) URL.revokeObjectURL(n[id].objectUrl); delete n[id]; return n; });
      setFormData(prev => { const n = { ...prev }; delete n[id]; return n; });
      return;
    }
    rawFileMap.current[id] = file;
    const objectUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = e => {
      const base64 = (e.target?.result as string).split(",")[1];
      const fd = { data: base64, mimeType: file.type, objectUrl, name: file.name };
      setFileData(prev => ({ ...prev, [id]: fd }));
      setFormData(prev => ({ ...prev, [id]: fd }));
    };
    reader.readAsDataURL(file);
  };

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating || isGeneratingMarketData) return;

    if (workflowId === "market") {
      await runMarketAnalysis(false);
      return;
    }

    if (workflowId === "resume_generation") {
      setResumeGeneratorData(formData);
      return;
    }

    if (workflowId === "cover_letter") {
      return;
    }

    setIsGenerating(true);
    setMainDocumentText(" ");
    const prompt = config.generatePrompt(formData);
    const chat = createTechCoachChat(config.systemInstruction, config.enableSearch);
    try {
      let first = true;
      await sendMessageStream(chat, prompt as string, chunk => {
        setMainDocumentText(prev => { if (first) { first = false; return chunk; } return prev + chunk; });
      });
    } catch { setMainDocumentText("**Error:** Failed to generate response."); }
    finally { setIsGenerating(false); }
  };

  /* ── Resume builder handler ───────────────────────────────────── */
  const handleAnalyzeFromBuilder = (resumeText: string, file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setBuilderAnalysisText(resumeText);
    setBuilderAnalysisFile({ file, objectUrl });
    setBuilderAnalysisResult(null);
    setIsBuilderAnalyzing(true);
    analyzeResume(resumeText, "", "")
      .then(result => {
        setBuilderAnalysisResult(result);
        if (result.overallScore != null) {
          void updateProfile({ resumeScore: result.overallScore, resumeScoreAt: new Date().toISOString() });
        }
      })
      .catch(() => setBuilderAnalysisResult({ resumeText, overallScore: null, summary: "Analysis failed.", improvements: [] }))
      .finally(() => setIsBuilderAnalyzing(false));
  };

  /* ── Saved resume handlers ────────────────────────────────────── */
  const handleOpenSavedResume = async (r: { id: string; storagePath: string }) => {
    setLoadingResumeId(r.id);
    try {
      const text = await downloadResume(r.storagePath);
      setSavedResumeText(text);
    } catch (err) {
      console.error("Failed to load resume:", err);
    } finally {
      setLoadingResumeId(null);
    }
  };

  const handleDeleteSavedResume = async (id: string) => {
    const savedResumes = profile.savedResumes ?? [];
    const resume = savedResumes.find(r => r.id === id);
    if (resume) {
      try { await deleteResume(resume.storagePath); } catch (err) { console.error("Storage delete failed:", err); }
    }
    await updateProfile({ savedResumes: savedResumes.filter((r) => r.id !== id) });
  };

  /* ── Saved cover letter handlers ──────────────────────────────── */
  const handleDeleteSavedLetter = async (id: string, storagePath: string) => {
    const savedLetters = profile.savedCoverLetters ?? [];
    await supabase.storage.from("user-documents").remove([storagePath]);
    await updateProfile({ savedCoverLetters: savedLetters.filter((l) => l.id !== id) });
  };

  const handleOpenLetter = async (storagePath: string) => {
    const { data, error } = await supabase.storage.from("user-documents").download(storagePath);
    if (error || !data) { console.error("Failed to load cover letter:", error); return; }
    try {
      const payload = JSON.parse(await data.text()) as SavedCoverLetterPayload;
      setSavedCoverLetterPayload(payload);
    } catch {
      console.error("Failed to parse cover letter payload");
    }
  };

  return {
    // state
    config,
    profile,
    formData,
    fileData,
    isGenerating,
    resumeGeneratorData,
    savedResumeText,
    coverLetterFormData,
    savedCoverLetterPayload,
    builderAnalysisText,
    builderAnalysisResult,
    isBuilderAnalyzing,
    builderAnalysisFile,
    loadingResumeId,
    showTailor,
    tailorInitialResume,
    marketData,
    marketCachedAt,
    isGeneratingMarketData,
    marketSaveState,
    marketCopied,
    mainDocumentText,
    companyJobDetails,
    companyResult,
    isResearching,
    isRevalidating,
    companyCachedAt,
    companyProfile,
    profileMissing,
    requestState,
    linkedinSubmitted,
    linkedinUrl,
    linkedinResult,
    isLinkedinAnalyzing,
    linkedinScreenshot,
    isLinkedinCapturing,
    linkedinFile,
    // setters
    setResumeGeneratorData,
    setSavedResumeText,
    setCoverLetterFormData,
    setSavedCoverLetterPayload,
    setBuilderAnalysisText,
    setBuilderAnalysisResult,
    setBuilderAnalysisFile,
    setIsBuilderAnalyzing,
    setShowTailor,
    setTailorInitialResume,
    setMarketData,
    setMarketCachedAt,
    setMarketSaveState,
    setCompanyProfile,
    setCompanyResult,
    setCompanyCachedAt,
    setProfileMissing,
    setRequestState,
    setLinkedinSubmitted,
    setLinkedinResult,
    setLinkedinScreenshot,
    setIsLinkedinAnalyzing,
    setIsLinkedinCapturing,
    setLinkedinUrl,
    setLinkedinFile,
    setMainDocumentText,
    setFormData,
    setFileData,
    // handlers
    handleSaveMarket,
    handleCopyMarket,
    startCompanyResearch,
    submitProfileRequest,
    runCompanyResearch,
    handleLinkedinSubmit,
    runMarketAnalysis,
    handleInputChange,
    handleFileChange,
    handleInitialSubmit,
    handleAnalyzeFromBuilder,
    handleOpenSavedResume,
    handleDeleteSavedResume,
    handleDeleteSavedLetter,
    handleOpenLetter,
  };
}
