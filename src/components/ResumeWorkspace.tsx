import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ResumeRenderer } from "./ResumeRenderer";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Download, Save, Edit3, Eye, CheckCircle2, AlertCircle, Sparkles, ChevronRight, FileText,
} from "lucide-react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";

interface Annotation {
  textToHighlight: string;
  type: "strength" | "weakness";
  suggestion: string;
}

interface ResumeWorkspaceProps {
  initialResumeText: string;
  annotations: Annotation[];
  onReset: () => void;
}

export function ResumeWorkspace({ initialResumeText, annotations, onReset }: ResumeWorkspaceProps) {
  const [resumeText, setResumeText] = useState(initialResumeText);
  const [activeTab, setActiveTab] = useState<"suggestions" | "edit">("suggestions");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "">("");
  const [selectedAnnotationIndex, setSelectedAnnotationIndex] = useState<number | null>(null);

  useEffect(() => {
    setSaveStatus("saving");
    const t = setTimeout(() => { setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 2000); }, 1000);
    return () => clearTimeout(t);
  }, [resumeText]);

  const handleExportPDF = () => window.print();

  const handleExportDocx = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Resume</title></head><body>";
    const footer = "</body></html>";
    const src = header + "<pre style='font-family: Arial,sans-serif; white-space:pre-wrap;'>" + resumeText.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</pre>" + footer;
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = "data:application/vnd.ms-word;charset=utf-8," + encodeURIComponent(src);
    a.download = "resume.doc";
    a.click();
    document.body.removeChild(a);
  };

  const getHighlightedMarkdown = () => {
    let out = resumeText;
    [...annotations].map((a, i) => ({ ...a, i })).sort((a, b) => b.textToHighlight.length - a.textToHighlight.length).forEach(ann => {
      if (!ann.textToHighlight) return;
      const safe = ann.textToHighlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(${safe})`, "g"), `<mark data-annotation-index="${ann.i}">$1</mark>`);
    });
    return out;
  };

  const strengths = annotations.filter(a => a.type === "strength");
  const suggestions = annotations.filter(a => a.type === "weakness");

  return (
    <div className="flex flex-col h-full w-full absolute inset-0 z-50 overflow-hidden" style={{ background: "var(--muted)" }}>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 shrink-0 print:hidden"
        style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(217,119,87,0.10)", color: "var(--primary)" }}>
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="font-display text-sm font-semibold" style={{ color: "var(--foreground)" }}>Impact Audit</div>
            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {saveStatus === "saving" && <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Syncing…</span>}
              {saveStatus === "saved" && <span className="flex items-center gap-1" style={{ color: "var(--forest)" }}><Save className="w-3 h-3" /> Saved</span>}
              {saveStatus === "" && "Interactive report"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 pr-3 mr-1" style={{ borderRight: "1px solid var(--border)" }}>
            <button onClick={handleExportDocx} style={{ height: 36, padding: "0 14px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--foreground)" }}>
              <Download className="w-3.5 h-3.5" /> DOCX
            </button>
            <button onClick={handleExportPDF} style={{ height: 36, padding: "0 14px", background: "var(--primary)", border: "1px solid var(--primary)", borderRadius: 10, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#FFF" }}>
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
          <button onClick={onReset} style={{ height: 36, padding: "0 14px", background: "transparent", border: "none", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--muted-foreground)" }}>
            Exit
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left mini toolbar */}
        <div className="w-16 flex flex-col items-center py-6 gap-6 shrink-0 print:hidden"
          style={{ background: "var(--foreground)" }}>
          {[
            { id: "suggestions" as const, icon: Eye, label: "Report" },
            { id: "edit" as const, icon: Edit3, label: "Editor" },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", background: "transparent", border: "none" }}>
              <div style={{ padding: 12, borderRadius: 12, background: activeTab === id ? "rgba(217,119,87,0.20)" : "transparent", color: activeTab === id ? "var(--primary)" : "rgba(251,247,241,0.45)", transition: "all 0.2s" }}>
                <Icon className="w-5 h-5" />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: activeTab === id ? "var(--primary)" : "rgba(251,247,241,0.4)", letterSpacing: "0.05em" }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Resume canvas */}
        <div className="flex-1 overflow-y-auto no-scrollbar flex justify-center py-10 px-4 sm:px-8 print:p-0"
          style={{ background: "var(--muted)" }}>
          <div className="w-full max-w-[850px] min-h-[1100px] p-10 sm:p-14 shrink-0 print:shadow-none print:m-0 print:p-0"
            style={{ background: "var(--card)", boxShadow: "0 4px 25px rgba(0,0,0,0.06)" }}>
            <ResumeRenderer
              markdownContent={getHighlightedMarkdown()}
              templateType="Modern & Clean"
              customComponents={{
                mark: ({ node, children, ...props }: any) => {
                  const idx = parseInt(props["data-annotation-index"] as string, 10);
                  const ann = annotations[idx];
                  if (!ann) return <mark>{children}</mark>;
                  const isStrength = ann.type === "strength";
                  const isSelected = selectedAnnotationIndex === idx;
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <mark
                          className={`cursor-pointer px-0.5 transition-all border-b-2 ${isStrength
                            ? `bg-green-100 text-green-900 border-green-500 ${isSelected ? "bg-green-200" : "hover:bg-green-200/50"}`
                            : `border-b-2 ${isSelected ? "bg-orange-100" : "hover:bg-orange-50"}`
                          }`}
                          style={!isStrength ? { background: isSelected ? "rgba(217,119,87,0.18)" : "rgba(217,119,87,0.10)", borderBottomColor: "var(--primary)", color: "var(--foreground)" } : {}}
                          onClick={() => { setActiveTab("suggestions"); setSelectedAnnotationIndex(idx); }}
                        >
                          {children}
                        </mark>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs p-3 text-sm shadow-xl">
                        <p className="font-semibold mb-1 flex items-center gap-1.5">
                          {isStrength ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <AlertCircle className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />}
                          {isStrength ? "Strength" : "Suggestion"}
                        </p>
                        <p className="italic mb-1" style={{ color: "var(--muted-foreground)", fontSize: 11 }}>"{ann.textToHighlight}"</p>
                        <p style={{ lineHeight: 1.5 }}>{ann.suggestion}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }
              }}
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-full lg:w-[420px] flex flex-col shrink-0 print:hidden"
          style={{ background: "var(--card)", borderLeft: "1px solid var(--border)" }}>

          {activeTab === "suggestions" ? (
            <>
              <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
                <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                  <AlertCircle className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  Analysis report
                </div>
                <span style={{ fontSize: 10, fontWeight: 900, color: "var(--primary)", background: "rgba(217,119,87,0.10)", border: "1px solid rgba(217,119,87,0.25)", padding: "2px 8px", borderRadius: 9999, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {annotations.length} finds
                </span>
              </div>
              <ScrollArea className="flex-1">
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ background: "rgba(47,107,79,0.06)", border: "1px solid rgba(47,107,79,0.18)", borderRadius: 14, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--forest)", marginBottom: 4 }}>Strengths</div>
                      <div className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--forest)" }}>{strengths.length}</div>
                    </div>
                    <div style={{ background: "rgba(217,119,87,0.06)", border: "1px solid rgba(217,119,87,0.18)", borderRadius: 14, padding: "12px 14px" }}>
                      <div style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--primary)", marginBottom: 4 }}>Suggestions</div>
                      <div className="font-display" style={{ fontSize: 28, fontWeight: 600, color: "var(--primary)" }}>{suggestions.length}</div>
                    </div>
                  </div>

                  {annotations.length === 0 ? (
                    <div style={{ padding: "32px 0", textAlign: "center" }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "var(--muted-foreground)" }}>
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>No issues found — your résumé looks strong!</p>
                    </div>
                  ) : annotations.map((ann, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedAnnotationIndex(idx)}
                      style={{
                        background: "var(--card)", border: `1px solid ${selectedAnnotationIndex === idx ? "var(--primary)" : "var(--border)"}`,
                        borderRadius: 16, padding: 16, cursor: "pointer", transition: "border-color 0.15s",
                        boxShadow: selectedAnnotationIndex === idx ? "0 0 0 1px var(--primary)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", padding: "3px 8px", borderRadius: 9999,
                          background: ann.type === "strength" ? "rgba(47,107,79,0.10)" : "rgba(217,119,87,0.10)",
                          color: ann.type === "strength" ? "var(--forest)" : "var(--primary)",
                        }}>{ann.type}</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${selectedAnnotationIndex === idx ? "rotate-90" : ""}`} style={{ color: "var(--muted-foreground)" }} />
                      </div>
                      <p style={{ fontSize: 11, fontFamily: "ui-monospace,monospace", fontStyle: "italic", background: "var(--muted)", padding: "6px 10px", borderRadius: 8, color: "var(--muted-foreground)", marginBottom: 8 }}>
                        "{ann.textToHighlight}"
                      </p>
                      <p style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.55 }}>{ann.suggestion}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)", fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                <Edit3 className="w-4 h-4" style={{ color: "var(--primary)" }} />
                Interactive editor
              </div>
              <Textarea
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
                className="flex-1 border-0 focus-visible:ring-0 p-5 resize-none rounded-none font-mono text-xs leading-relaxed"
                style={{ background: "var(--card)", color: "var(--foreground)" }}
                placeholder="Markdown-formatted résumé text…"
              />
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--muted)", fontSize: 11, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles className="w-3 h-3" style={{ color: "var(--primary)" }} />
                Edits here instantly update the highlighted preview.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
