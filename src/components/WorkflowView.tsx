import { useState } from "react";
import { WorkflowId } from "@/components/Sidebar";
import { workflowsConfig } from "@/config/workflows";
import { useUserProfile } from "@/context/UserProfileContext";
import { createTechCoachChat, sendMessageStream, analyzeResume } from "@/services/geminiService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Sparkles, FileText, Link as LinkIcon,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import Markdown from "react-markdown";
import type { Chat } from "@google/genai";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ResumeWorkspace } from "@/components/ResumeWorkspace";
import { ResumeGeneratorWorkspace } from "@/components/ResumeGeneratorWorkspace";
import { ResumeGenerationForm } from "@/components/ResumeGenerationForm";
import { MarketCompensationViz, MarketCompData } from "@/components/MarketCompensationViz";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FileData { data: string; mimeType: string; objectUrl: string; name: string; }

interface WorkflowViewProps { workflowId: WorkflowId; }

/* shared inline styles */
const fieldStyle: React.CSSProperties = {
  width: "100%", height: 52, background: "var(--muted)", border: "1px solid var(--border)",
  borderRadius: 14, padding: "0 16px", fontFamily: "inherit", fontSize: 14,
  color: "var(--foreground)", outline: "none",
};

export function WorkflowView({ workflowId }: WorkflowViewProps) {
  const config = workflowsConfig[workflowId];
  const { profile } = useUserProfile();
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    if (workflowId === "resume" && profile.resumeText)
      return { resumeText: profile.resumeText };
    if (workflowId === "linkedin")
      return { url: profile.linkedin ?? "", profile: profile.linkedinText ?? "" };
    return {};
  });
  const [fileData, setFileData] = useState<Record<string, FileData>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [resumeWorkspaceData, setResumeWorkspaceData] = useState<{ resumeText: string; annotations: any[] } | null>(null);
  const [resumeGeneratorData, setResumeGeneratorData] = useState<Record<string, any> | null>(null);
  const [marketData, setMarketData] = useState<MarketCompData | null>(null);
  const [isGeneratingMarketData, setIsGeneratingMarketData] = useState(false);
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState(1);
  const [mainDocumentText, setMainDocumentText] = useState("");

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

  const handleInputChange = (id: string, value: string) =>
    setFormData(prev => ({ ...prev, [id]: value }));

  const handleFileChange = async (id: string, file: File | null) => {
    if (!file) {
      setFileData(prev => { const n = { ...prev }; if (n[id]?.objectUrl) URL.revokeObjectURL(n[id].objectUrl); delete n[id]; return n; });
      setFormData(prev => { const n = { ...prev }; delete n[id]; return n; });
      return;
    }
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
      setIsGeneratingMarketData(true);
      const prompt = config.generatePrompt(formData);
      const chat = createTechCoachChat(config.systemInstruction, config.enableSearch);
      try {
        let full = "";
        await sendMessageStream(chat, prompt as string, chunk => { full += chunk; });
        setMarketData(tryParseMarketData(full) ?? null);
        if (!tryParseMarketData(full)) setMainDocumentText(full);
      } catch (err) { console.error(err); }
      finally { setIsGeneratingMarketData(false); }
      return;
    }

    if (workflowId === "resume") {
      setIsGenerating(true);
      try {
        const result = await analyzeResume(
          formData.resumeText || "", fileData.resumeFile || null, formData.jd || "", formData.jdUrl || ""
        );
        setResumeWorkspaceData(result);
      } catch { alert("Failed to analyze resume."); }
      finally { setIsGenerating(false); }
      return;
    }

    if (workflowId === "resume_generation") {
      setResumeGeneratorData(formData);
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

  /* ── Resume & Generator pass-through ─────────────────────────── */
  if (workflowId === "resume" && resumeWorkspaceData) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <ResumeWorkspace
          initialResumeText={resumeWorkspaceData.resumeText}
          annotations={resumeWorkspaceData.annotations}
          onReset={() => setResumeWorkspaceData(null)}
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

  if (workflowId === "resume_generation") {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
        <PageHeader title={config.title} description={config.description} />
        <div className="flex-1 overflow-auto no-scrollbar p-8">
          <ResumeGenerationForm isGenerating={isGenerating} onSubmit={data => setResumeGeneratorData(data)} />
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
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {!isGeneratingMarketData && !marketData && <FormCard config={config} formData={formData} fileData={fileData} isGenerating={isGenerating} handleInputChange={handleInputChange} handleFileChange={handleFileChange} handleInitialSubmit={handleInitialSubmit} />}

            {isGeneratingMarketData && (
              <MentorCard style={{ padding: 48, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--primary)" }} />
                <div className="font-display" style={{ fontSize: 20, fontWeight: 600, color: "var(--foreground)" }}>Researching compensation</div>
                <div style={{ fontSize: 14, color: "var(--muted-foreground)" }}>Analysing market data — just a moment…</div>
              </MentorCard>
            )}

            {marketData && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <MarketCompensationViz data={marketData} />
                <button onClick={() => { setMarketData(null); setMainDocumentText(""); }} style={{ height: 48, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}>
                  Start new analysis
                </button>
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
