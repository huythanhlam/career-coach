import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { WorkflowId } from "@/components/Sidebar";
import { workflowsConfig } from "@/config/workflows";
import { useUserProfile } from "@/context/UserProfileContext";
import { createTechCoachChat, sendMessageStream, analyzeResume, ResumeAnalysisResult, analyzeLinkedInProfile, LinkedInAnalysisResult } from "@/services/geminiService";
import { parseDocumentToText } from "@/services/documentParserService";
import { captureLinkedInScreenshot, ScreenshotResult } from "@/services/linkedinScreenshotService";
import { LinkedInUploadForm, LinkedInUploadSubmit } from "@/components/LinkedInUploadForm";
import { LinkedInOptimizationWorkspace } from "@/components/LinkedInOptimizationWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Sparkles, FileText, Link as LinkIcon,
  ChevronLeft, ChevronRight, Bookmark, Trash2, Plus,
} from "lucide-react";
import Markdown from "react-markdown";
import type { Chat } from "@google/genai";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ResumeGeneratorWorkspace } from "@/components/ResumeGeneratorWorkspace";
import { ResumeGenerationForm } from "@/components/ResumeGenerationForm";
import { ResumeAnalysisWorkspace } from "@/components/ResumeAnalysisWorkspace";
import { TailorResumeWorkspace } from "@/components/TailorResumeWorkspace";
import { downloadResume, deleteResume } from "@/services/resumeStorageService";
import { useEffect } from "react";
import { MarketCompensationViz, MarketCompData, marketToMarkdown } from "@/components/MarketCompensationViz";
import { marketCacheKey, getCachedMarketData, putCachedMarketData, getStaleRow } from "@/services/marketDataCache";
import { enrichWithBls } from "@/services/blsService";
import { useSavedAnalyses } from "@/hooks/useSavedAnalyses";
import { CoverLetterWorkspace, SavedCoverLetterPayload } from "@/components/CoverLetterWorkspace";
import { CoverLetterForm, CoverLetterFormData } from "@/components/CoverLetterForm";
import { GoalPlanningWorkspace } from "@/components/GoalPlanningWorkspace";
import { MockInterviewWorkspace } from "@/components/MockInterviewWorkspace";
import { type JobDetailsValue } from "@/components/JobDetailsSection";
import { researchCompanyProfile, researchCompanyNews, assembleCompanyResearch, CompanyResearchResult } from "@/services/geminiService";
import { CompanyResearchViz } from "@/components/companyResearch";
import { CompanyProfileViz } from "@/components/companyResearch/CompanyProfileViz";
import { RequestProfileBanner } from "@/components/companyResearch/RequestProfileBanner";
import { CompanyBrowser } from "@/components/companyResearch/CompanyBrowser";
import { getCachedCompanyResearch, putCachedCompanyResearch } from "@/config/companyResearchCache";
import { getCompanyProfile, requestCompanyProfile, type RequestProfileResult } from "@/services/companyProfileService";
import type { CompanyProfile } from "@/types/companyProfile";
import type { ViewId } from "@/components/Sidebar";
import { configurePdfWorker } from "@/lib/pdfWorker";

configurePdfWorker(pdfjs);

async function extractPDFText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .filter((x: any) => 'str' in x)
        .map((x: any) => x.str)
        .join(' ')
    );
  }
  return pages.join('\n\n');
}

interface FileData { data: string; mimeType: string; objectUrl: string; name: string; }

interface WorkflowViewProps { workflowId: WorkflowId; onNavigate?: (view: ViewId) => void; }

/* shared inline styles */
const fieldStyle: React.CSSProperties = {
  width: "100%", height: 52, background: "var(--muted)", border: "1px solid var(--border)",
  borderRadius: 14, padding: "0 16px", fontFamily: "inherit", fontSize: 14,
  color: "var(--foreground)", outline: "none",
};

export function WorkflowView({ workflowId, onNavigate }: WorkflowViewProps) {
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
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState(1);
  const [mainDocumentText, setMainDocumentText] = useState("");

  /* ── Research Company state ───────────────────────────────────── */
  const [companyJobDetails, setCompanyJobDetails] = useState<JobDetailsValue>({ jobTitle: "", companyName: "", jobDescription: "" });
  const [companyResult, setCompanyResult] = useState<CompanyResearchResult | null>(null);
  const [isResearching, setIsResearching] = useState(false);   // first load (no cache → full loader)
  const [isRevalidating, setIsRevalidating] = useState(false); // background / explicit refresh
  const [companyCachedAt, setCompanyCachedAt] = useState<string | null>(null);
  // Deterministic profile (reliable, non-AI). Preferred over the AI path.
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false); // checked, none in DB → offer "request"
  const [requestState, setRequestState] = useState<RequestProfileResult | "requesting" | null>(null);

  /**
   * Entry point: research a company (picked from the browser or typed in the
   * search box). Prefers the deterministic DB profile; only falls back to the
   * AI path when none exists, surfacing a "request a profile" affordance so the
   * user can queue it for the build routine.
   */
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
    // No deterministic profile yet → use the existing AI research as a fallback.
    await runCompanyResearch("auto", company);
  };

  const submitProfileRequest = async () => {
    setRequestState("requesting");
    const result = await requestCompanyProfile(companyJobDetails.companyName);
    setRequestState(result);
  };

  // Fetch a fresh tier (one grounded call) and persist it to the cache. Company
  // research is company-level — no job title/description needed.
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

  /**
   * mode "auto"  → stale-while-revalidate: serve cache instantly, refresh only
   *                stale tiers in the background. Miss → fetch missing tiers.
   * mode "news"  → re-ground news only (cheap), reuse cached profile.
   * mode "all"   → re-ground both tiers.
   */
  const runCompanyResearch = async (mode: "auto" | "news" | "all" = "auto", companyArg?: string) => {
    const company = (companyArg ?? companyJobDetails.companyName).trim();
    if (!company || isResearching || isRevalidating) return;

    if (mode === "auto") {
      const [cp, cn] = await Promise.all([
        getCachedCompanyResearch(company, "profile"),
        getCachedCompanyResearch(company, "news"),
      ]);
      if (cp && cn) {
        // Serve cached immediately (even if stale), then revalidate stale tiers.
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
      // Partial or total miss → fetch only the missing tier(s).
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

    // Explicit refresh — re-ground the requested tier(s), reuse cache for the rest.
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

  /* ── LinkedIn Optimization state ──────────────────────────────── */
  const [linkedinSubmitted, setLinkedinSubmitted] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinResult, setLinkedinResult] = useState<LinkedInAnalysisResult | null>(null);
  const [isLinkedinAnalyzing, setIsLinkedinAnalyzing] = useState(false);
  const [linkedinScreenshot, setLinkedinScreenshot] = useState<ScreenshotResult | null>(null);
  const [isLinkedinCapturing, setIsLinkedinCapturing] = useState(false);
  const [linkedinFile, setLinkedinFile] = useState<{ file: File; objectUrl: string } | null>(null);

  const handleLinkedinSubmit = async ({ file, url, targetRole, screenshotFile }: LinkedInUploadSubmit) => {
    setLinkedinSubmitted(true);
    setLinkedinUrl(url);
    setLinkedinResult(null);
    setLinkedinScreenshot(null);
    setLinkedinFile(prev => { if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl); return { file, objectUrl: URL.createObjectURL(file) }; });
    setIsLinkedinAnalyzing(true);

    if (screenshotFile) {
      // A screenshot the user took while logged in is the best visual — it has the
      // real headshot, cover photo, and layout. Use it directly, skip live capture.
      const reader = new FileReader();
      reader.onload = () => setLinkedinScreenshot({ image: reader.result as string, blocked: false });
      reader.readAsDataURL(screenshotFile);
    } else if (url) {
      // Best-effort live capture; LinkedIn often serves an authwall → PDF fallback.
      setIsLinkedinCapturing(true);
      captureLinkedInScreenshot(url)
        .then(setLinkedinScreenshot)
        .catch(() => setLinkedinScreenshot(null))
        .finally(() => setIsLinkedinCapturing(false));
    }

    // Content + design analysis from the uploaded PDF.
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

  /* ── Career Goal Planning ────────────────────────────────────── */
  if (workflowId === "goal_planning") {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <GoalPlanningWorkspace onNavigate={onNavigate} />
      </div>
    );
  }

  /* ── Mock interviews — stateful sessions with scored, persisted history ── */
  if (workflowId === "mock_behavioral" || workflowId === "mock_case_study" || workflowId === "mock_tech") {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <MockInterviewWorkspace workflowId={workflowId} />
      </div>
    );
  }

  /* ── LinkedIn Optimization ───────────────────────────────────── */
  if (workflowId === "linkedin") {
    if (!linkedinSubmitted) {
      return (
        <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
          <PageHeader title={config.title} description={config.description} />
          <div className="flex-1 overflow-auto no-scrollbar p-8">
            <LinkedInUploadForm
              initialUrl={profile.linkedin ?? ""}
              initialTargetRole={profile.targetRole ?? ""}
              isSubmitting={false}
              onSubmit={handleLinkedinSubmit}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <LinkedInOptimizationWorkspace
          result={linkedinResult}
          isAnalyzing={isLinkedinAnalyzing}
          screenshot={linkedinScreenshot}
          isCapturing={isLinkedinCapturing}
          profileUrl={linkedinUrl}
          file={linkedinFile?.file ?? null}
          fileObjectUrl={linkedinFile?.objectUrl ?? null}
          onReset={() => {
            if (linkedinFile?.objectUrl) URL.revokeObjectURL(linkedinFile.objectUrl);
            setLinkedinSubmitted(false);
            setLinkedinResult(null);
            setLinkedinScreenshot(null);
            setIsLinkedinAnalyzing(false);
            setIsLinkedinCapturing(false);
            setLinkedinUrl("");
            setLinkedinFile(null);
          }}
        />
      </div>
    );
  }

  /* ── Resume & Generator pass-through ─────────────────────────── */
  if (workflowId === "resume_generation" && builderAnalysisText !== null && builderAnalysisFile) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <ResumeAnalysisWorkspace
          file={builderAnalysisFile.file}
          fileObjectUrl={builderAnalysisFile.objectUrl}
          resumeText={builderAnalysisText}
          analysisResult={builderAnalysisResult}
          isAnalyzing={isBuilderAnalyzing}
          onReset={() => {
            URL.revokeObjectURL(builderAnalysisFile.objectUrl);
            setBuilderAnalysisText(null);
            setBuilderAnalysisResult(null);
            setBuilderAnalysisFile(null);
            setIsBuilderAnalyzing(false);
          }}
        />
      </div>
    );
  }

  if (workflowId === "resume_generation" && resumeGeneratorData) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <ResumeGeneratorWorkspace
          initialFormData={resumeGeneratorData}
          onReset={() => setResumeGeneratorData(null)}
        />
      </div>
    );
  }

  if (workflowId === "resume_generation" && savedResumeText !== null) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <ResumeGeneratorWorkspace
          initialResumeText={savedResumeText}
          onReset={() => setSavedResumeText(null)}
        />
      </div>
    );
  }

  if (workflowId === "cover_letter" && coverLetterFormData) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <CoverLetterWorkspace
          initialFormData={coverLetterFormData}
          onReset={() => setCoverLetterFormData(null)}
        />
      </div>
    );
  }

  if (workflowId === "resume_generation" && showTailor) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <TailorResumeWorkspace
          onBack={() => { setShowTailor(false); setTailorInitialResume(null); }}
          initialResumeText={tailorInitialResume?.text}
          initialResumeName={tailorInitialResume?.name}
        />
      </div>
    );
  }

  if (workflowId === "cover_letter" && savedCoverLetterPayload !== null) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <CoverLetterWorkspace
          initialPayload={savedCoverLetterPayload}
          onReset={() => setSavedCoverLetterPayload(null)}
        />
      </div>
    );
  }

  if (workflowId === "cover_letter") {
    const savedLetters = profile.savedCoverLetters ?? [];
    const handleDeleteSavedLetter = async (id: string, storagePath: string) => {
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
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
        <PageHeader title={config.title} description={config.description} />
        <div className="flex-1 overflow-auto no-scrollbar p-8">
          {savedLetters.length > 0 && (
            <div style={{ maxWidth: 760, margin: "0 auto 40px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <Bookmark className="w-3.5 h-3.5" /> Saved Cover Letters
              </div>
              <div className="flex flex-col gap-3">
                {savedLetters.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((l) => (
                  <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14 }}>
                    <FileText className="w-5 h-5 shrink-0" style={{ color: "var(--primary)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                        {l.jobTitle && l.company ? `${l.jobTitle} at ${l.company} · ` : ""}{new Date(l.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenLetter(l.storagePath)}
                      style={{ height: 36, padding: "0 16px", background: "var(--primary)", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedLetter(l.id, l.storagePath)}
                      style={{ height: 36, width: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", color: "var(--muted-foreground)" }}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ margin: "28px 0 4px", borderTop: "1px solid var(--border)" }} />
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", margin: "20px 0 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus className="w-3.5 h-3.5" /> Write New Cover Letter
              </div>
            </div>
          )}
          <CoverLetterForm isGenerating={false} onSubmit={(data) => setCoverLetterFormData(data)} />
        </div>
      </div>
    );
  }

  if (workflowId === "resume_generation") {
    const savedResumes = profile.savedResumes ?? [];
    const handleOpenSaved = async (r: { id: string; storagePath: string }) => {
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
    const handleDeleteSaved = async (id: string) => {
      const resume = savedResumes.find(r => r.id === id);
      if (resume) {
        try { await deleteResume(resume.storagePath); } catch (err) { console.error("Storage delete failed:", err); }
      }
      await updateProfile({ savedResumes: savedResumes.filter((r) => r.id !== id) });
    };
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
        <PageHeader title={config.title} description={config.description} />
        <div className="flex-1 overflow-auto no-scrollbar p-8">
          {savedResumes.length > 0 && (
            <div style={{ maxWidth: 760, margin: "0 auto 40px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <Bookmark className="w-3.5 h-3.5" /> Saved Resumes
              </div>
              <div className="flex flex-col gap-3">
                {savedResumes.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14 }}>
                    <FileText className="w-5 h-5 shrink-0" style={{ color: "var(--primary)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenSaved(r)}
                      disabled={loadingResumeId === r.id}
                      style={{ height: 36, padding: "0 16px", background: "var(--primary)", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", cursor: loadingResumeId === r.id ? "not-allowed" : "pointer", opacity: loadingResumeId === r.id ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {loadingResumeId === r.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening…</> : "Open"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSaved(r.id)}
                      style={{ height: 36, width: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", color: "var(--muted-foreground)" }}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ margin: "28px 0 4px", borderTop: "1px solid var(--border)" }} />
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", margin: "20px 0 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus className="w-3.5 h-3.5" /> Build New Resume
              </div>
            </div>
          )}
          <ResumeGenerationForm isGenerating={isGenerating} onSubmit={data => setResumeGeneratorData(data)} onAnalyze={handleAnalyzeFromBuilder} onTailor={(text, name) => { setTailorInitialResume({ text, name }); setShowTailor(true); }} onImportToEditor={markdown => setSavedResumeText(markdown)} />
        </div>
      </div>
    );
  }

  /* ── Market workflow ──────────────────────────────────────────── */
  if (workflowId === "market") {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
        <PageHeader title={config.title} description={config.description} />
        <div className="flex-1 overflow-auto no-scrollbar p-8">
          <div style={{ maxWidth: marketData ? 1180 : 760, margin: "0 auto" }}>
            {!isGeneratingMarketData && !marketData && (
              <div style={{ maxWidth: 760, margin: "0 auto" }}>
                <FormCard config={config} formData={formData} fileData={fileData} isGenerating={isGenerating} handleInputChange={handleInputChange} handleFileChange={handleFileChange} handleInitialSubmit={handleInitialSubmit} />
              </div>
            )}

            {isGeneratingMarketData && !marketData && (
              <div style={{ maxWidth: 760, margin: "0 auto" }}>
                <MentorCard style={{ padding: 48, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
                  <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--primary)" }} />
                  <div className="font-display" style={{ fontSize: 20, fontWeight: 600, color: "var(--foreground)" }}>Researching compensation</div>
                  <div style={{ fontSize: 14, color: "var(--muted-foreground)" }}>Analysing market data — just a moment…</div>
                </MentorCard>
              </div>
            )}

            {marketData && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <MarketCompensationViz data={marketData} cachedAt={marketCachedAt ?? undefined} onRefresh={() => runMarketAnalysis(true)} isRefreshing={isGeneratingMarketData} onNavigate={onNavigate} />
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button onClick={handleSaveMarket} disabled={marketSaveState !== "idle"} style={{ flex: "1 1 160px", height: 48, background: marketSaveState === "saved" ? "var(--muted)" : "var(--card)", border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: marketSaveState === "idle" ? "pointer" : "default", color: "var(--foreground)" }}>
                    {marketSaveState === "saving" ? "Saving…" : marketSaveState === "saved" ? "Saved ✓" : "Save comparison"}
                  </button>
                  <button onClick={handleCopyMarket} style={{ flex: "1 1 160px", height: 48, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}>
                    {marketCopied ? "Copied ✓" : "Copy summary"}
                  </button>
                  <button onClick={() => { setMarketData(null); setMarketCachedAt(null); setMainDocumentText(""); setMarketSaveState("idle"); }} style={{ flex: "1 1 160px", height: 48, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}>
                    Start new analysis
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Research Company ─────────────────────────────────────────── */
  if (workflowId === "company_research") {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
        <PageHeader title={config.title} description={config.description} />
        <div className="flex-1 overflow-auto no-scrollbar p-8">
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {!companyResult && !companyProfile && !isResearching && (
              <CompanyBrowser onPick={startCompanyResearch} />
            )}

            {isResearching && !companyResult && !companyProfile && (
              <MentorCard style={{ padding: 48, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--primary)" }} />
                <div className="font-display" style={{ fontSize: 20, fontWeight: 600, color: "var(--foreground)" }}>
                  Researching {companyJobDetails.companyName || "the company"}
                </div>
                <div style={{ fontSize: 14, color: "var(--muted-foreground)" }}>Checking our verified company database, then careers pages, news, and financials…</div>
              </MentorCard>
            )}

            {companyProfile && (
              <CompanyProfileViz
                profile={companyProfile}
                onReset={() => { setCompanyProfile(null); setProfileMissing(false); setRequestState(null); }}
              />
            )}

            {companyResult && !companyProfile && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {profileMissing && (
                  <RequestProfileBanner
                    company={companyJobDetails.companyName}
                    state={requestState}
                    onRequest={submitProfileRequest}
                  />
                )}
                <CompanyResearchViz
                  data={companyResult}
                  companyName={companyJobDetails.companyName}
                  isRevalidating={isRevalidating}
                  cachedAt={companyCachedAt ?? undefined}
                  onRefreshNews={() => runCompanyResearch("news")}
                  onRefreshAll={() => runCompanyResearch("all")}
                  onReset={() => { setCompanyResult(null); setCompanyCachedAt(null); setProfileMissing(false); setRequestState(null); }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Generic text workflows ───────────────────────────────────── */
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
      <PageHeader title={config.title} description={config.description} />
      <div className="flex-1 overflow-auto no-scrollbar p-8">
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Form state */}
          {!mainDocumentText && !isGenerating && (
            <FormCard config={config} formData={formData} fileData={fileData} isGenerating={isGenerating} handleInputChange={handleInputChange} handleFileChange={handleFileChange} handleInitialSubmit={handleInitialSubmit} />
          )}

          {/* File preview */}
          {(mainDocumentText || isGenerating) && Object.values(fileData).length > 0 && (
            <MentorCard style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <FileText className="w-4 h-4" style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                  {Object.values(fileData)[0].name}
                </span>
              </div>
              <div style={{ background: "var(--muted)", display: "flex", flexDirection: "column", alignItems: "center", padding: 16 }}>
                {Object.values(fileData)[0].mimeType === "application/pdf" ? (
                  <>
                    <Document
                      file={Object.values(fileData)[0].objectUrl}
                      onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                      loading={<div style={{ padding: 16, color: "var(--muted-foreground)" }}>Loading PDF…</div>}
                      error={<div style={{ padding: 16, color: "var(--destructive)" }}>Failed to load PDF.</div>}
                    >
                      <Page pageNumber={pageNumber} renderTextLayer={false} renderAnnotationLayer={false} width={420} />
                    </Document>
                    {numPages && numPages > 1 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 9999, padding: "6px 12px" }}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={pageNumber <= 1} onClick={() => setPageNumber(p => Math.max(p - 1, 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{pageNumber} of {numPages}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={pageNumber >= numPages} onClick={() => setPageNumber(p => Math.min(p + 1, numPages))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: 16, color: "var(--muted-foreground)", fontSize: 14 }}>Preview not available for this file type.</div>
                )}
              </div>
            </MentorCard>
          )}

          {/* URL reference */}
          {(mainDocumentText || isGenerating) && formData.url && (
            <MentorCard style={{ padding: "16px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <LinkIcon className="w-4 h-4" style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Linked URL</span>
              </div>
              <a href={formData.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--primary)", wordBreak: "break-all" }}>{formData.url}</a>
            </MentorCard>
          )}

          {/* Main AI result */}
          {(mainDocumentText || isGenerating) && (
            <MentorCard style={{ overflow: "hidden" }} className="animate-in fade-in duration-300">
              <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                {isGenerating && !mainDocumentText.trim()
                  ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
                  : <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />}
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                  {isGenerating && !mainDocumentText.trim() ? "Analysing…" : "Results"}
                </span>
              </div>
              <div style={{ padding: "20px 22px" }}>
                {mainDocumentText.trim() ? (
                  <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
                    <Markdown>{mainDocumentText}</Markdown>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48, color: "var(--muted-foreground)" }}>
                    <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: "var(--primary)" }} />
                    <p style={{ fontSize: 14 }}>Processing your request…</p>
                  </div>
                )}
              </div>
            </MentorCard>
          )}

          {mainDocumentText && (
            <button onClick={() => { setMainDocumentText(""); setFormData({}); setFileData({}); }} style={{ height: 48, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}>
              Start new analysis
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Shared helper components ──────────────────────────────────── */

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", background: "var(--background)", flexShrink: 0 }}>
      <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--foreground)", margin: "0 0 4px" }}>
        {title}
      </h2>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{description}</p>
    </header>
  );
}

function MentorCard({ children, style = {}, className = "" }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, boxShadow: "0 8px 30px rgba(0,0,0,0.04)", ...style }}>
      {children}
    </div>
  );
}

function FormCard({ config, formData, fileData, isGenerating, handleInputChange, handleFileChange, handleInitialSubmit }: any) {
  const fieldStyle: React.CSSProperties = {
    width: "100%", background: "var(--muted)", border: "1px solid var(--border)",
    borderRadius: 14, padding: "0 16px", fontFamily: "inherit", fontSize: 14,
    color: "var(--foreground)", outline: "none",
  };

  return (
    <MentorCard>
      <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>Details</div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>Provide the info below to get started.</div>
      </div>
      <form onSubmit={handleInitialSubmit} style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
        {config.fields.map((field: any) => (
          <div key={field.id}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
              {field.label}
              {field.required === false && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted-foreground)", marginLeft: 6 }}>(optional)</span>}
            </label>
            {field.type === "textarea" ? (
              <textarea
                required={field.required !== false}
                placeholder={field.placeholder}
                value={formData[field.id] || ""}
                onChange={e => handleInputChange(field.id, e.target.value)}
                style={{ ...fieldStyle, height: "auto", minHeight: 120, padding: "12px 16px", resize: "vertical" }}
              />
            ) : field.type === "file" ? (
              <input
                type="file"
                accept={field.accept}
                onChange={e => handleFileChange(field.id, e.target.files?.[0] || null)}
                style={{ ...fieldStyle, height: 48, cursor: "pointer" }}
              />
            ) : field.type === "select" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <select
                  required={field.required !== false && formData[`${field.id}_select`] !== "Other"}
                  value={formData[`${field.id}_select`] || ""}
                  onChange={e => {
                    const v = e.target.value;
                    handleInputChange(`${field.id}_select`, v);
                    handleInputChange(field.id, v === "Other" ? "" : v);
                  }}
                  style={{ ...fieldStyle, height: 52, cursor: "pointer" }}
                >
                  <option value="" disabled={field.required !== false}>Select an option…</option>
                  {field.options?.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {field.allowCustom && formData[`${field.id}_select`] === "Other" && (
                  <input
                    type="text"
                    required={field.required !== false}
                    placeholder="Please specify…"
                    value={formData[field.id] || ""}
                    onChange={e => handleInputChange(field.id, e.target.value)}
                    style={{ ...fieldStyle, height: 52 }}
                  />
                )}
              </div>
            ) : (
              <input
                type={field.type}
                required={field.required !== false}
                placeholder={field.placeholder}
                value={formData[field.id] || ""}
                onChange={e => handleInputChange(field.id, e.target.value)}
                style={{ ...fieldStyle, height: 52 }}
              />
            )}
          </div>
        ))}
        <button
          type="submit"
          disabled={isGenerating}
          style={{
            height: 52, background: "var(--primary)", color: "#FFF",
            border: "1px solid var(--primary)", borderRadius: 14,
            fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: isGenerating ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 4px 14px rgba(217,119,87,0.25)", opacity: isGenerating ? 0.7 : 1,
          }}
        >
          {isGenerating
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
            : <><Sparkles className="w-4 h-4" /> Start session</>}
        </button>
      </form>
    </MentorCard>
  );
}
