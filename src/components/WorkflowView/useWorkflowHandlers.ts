import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserProfile } from "@/context/UserProfileContext";
import {
  createTechCoachChat, sendMessageStream, analyzeResume, ResumeAnalysisResult,
  analyzeLinkedInProfile, LinkedInAnalysisResult,
} from "@/services/geminiService";
import { parseDocumentToText } from "@/services/documentParserService";
import { captureLinkedInScreenshot, ScreenshotResult } from "@/services/linkedinScreenshotService";
import { LinkedInUploadSubmit } from "@/components/LinkedInUploadForm";
import { SavedCoverLetterPayload } from "@/components/CoverLetterWorkspace";
import { CoverLetterFormData } from "@/components/CoverLetterForm";
import { downloadResume, deleteResume } from "@/services/resumeStorageService";
import { WorkflowId } from "@/components/Sidebar";
import { workflowsConfig } from "@/config/workflows";
import { useMarketHandlers } from "./useMarketHandlers";
import { useCompanyResearchHandlers } from "./useCompanyResearchHandlers";

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
  const [mainDocumentText, setMainDocumentText] = useState("");

  /* ── LinkedIn state ───────────────────────────────────────────── */
  const [linkedinSubmitted, setLinkedinSubmitted] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinResult, setLinkedinResult] = useState<LinkedInAnalysisResult | null>(null);
  const [isLinkedinAnalyzing, setIsLinkedinAnalyzing] = useState(false);
  const [linkedinScreenshot, setLinkedinScreenshot] = useState<ScreenshotResult | null>(null);
  const [isLinkedinCapturing, setIsLinkedinCapturing] = useState(false);
  const [linkedinFile, setLinkedinFile] = useState<{ file: File; objectUrl: string } | null>(null);

  /* ── Sub-hooks ────────────────────────────────────────────────── */
  const market = useMarketHandlers(workflowId, formData, setMainDocumentText);
  const company = useCompanyResearchHandlers();

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
    if (isGenerating || market.isGeneratingMarketData) return;

    if (workflowId === "market") {
      await market.runMarketAnalysis(false);
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
    mainDocumentText,
    // market state (delegated)
    ...market,
    // company research state (delegated)
    ...company,
    // linkedin state
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
    handleLinkedinSubmit,
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
