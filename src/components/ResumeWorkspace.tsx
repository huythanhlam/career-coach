import React, { useState, useEffect, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ResumeRenderer } from "./ResumeRenderer";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Download, Save, Edit3, Eye, CheckCircle2, Sparkles, Send, X,
} from "lucide-react";
import { rewriteResumeSelection } from "@/services/geminiService";
import type { Improvement } from "@/services/geminiService";

interface ResumeWorkspaceProps {
  initialResumeText: string;
  improvements: Improvement[];
  overallScore?: number | null;
  summary?: string;
  isAnalyzing?: boolean;
  onReset: () => void;
}

const priorityStyles: Record<'high' | 'medium' | 'low', React.CSSProperties> = {
  high:   { background: 'rgba(217,119,87,0.15)', border: '1px solid rgba(217,119,87,0.40)', color: 'var(--primary)' },
  medium: { background: 'rgba(110,101,87,0.10)', border: '1px solid rgba(110,101,87,0.25)', color: 'var(--muted-foreground)' },
  low:    { background: 'rgba(110,101,87,0.05)', border: '1px solid rgba(110,101,87,0.15)', color: 'var(--muted-foreground)' },
};

const PRIORITY_ORDER: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 };

interface SelectionToolbar {
  selectedText: string;
  top: number;
  left: number;
  width: number;
}

const QUICK_ACTIONS = [
  { label: "Strengthen", instruction: "Rewrite using a stronger action verb and the XYZ formula (Action + Metric + Result)." },
  { label: "Add metrics", instruction: "Add specific quantified metrics or percentages to make this more data-driven." },
  { label: "Fix grammar", instruction: "Fix any grammar, tense, or punctuation issues." },
  { label: "Simplify", instruction: "Simplify and tighten this — remove filler words and make it more concise." },
];

export function ResumeWorkspace({ initialResumeText, improvements, overallScore, summary, isAnalyzing, onReset }: ResumeWorkspaceProps) {
  const [resumeText, setResumeText] = useState(initialResumeText);
  const [activeTab, setActiveTab] = useState<"suggestions" | "edit">("suggestions");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "">("");
  const [selectedImprovementId, setSelectedImprovementId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const [selectionToolbar, setSelectionToolbar] = useState<SelectionToolbar | null>(null);
  const [selectionInstruction, setSelectionInstruction] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const instructionInputRef = useRef<HTMLInputElement>(null);

  // Keep resume text in sync when parent updates (after AI analysis completes)
  useEffect(() => {
    setResumeText(initialResumeText);
  }, [initialResumeText]);

  useEffect(() => {
    setSaveStatus("saving");
    const t = setTimeout(() => { setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 2000); }, 1000);
    return () => clearTimeout(t);
  }, [resumeText]);

  const dismissToolbar = useCallback(() => {
    setSelectionToolbar(null);
    setSelectionInstruction("");
  }, []);

  const handleCanvasMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const text = sel.toString().trim();
    if (text.length < 5) return;
    const range = sel.getRangeAt(0);
    if (!canvasRef.current?.contains(range.commonAncestorContainer)) return;
    const rect = range.getBoundingClientRect();
    setSelectionToolbar({ selectedText: text, top: rect.top, left: rect.left, width: rect.width });
    setSelectionInstruction("");
    setTimeout(() => instructionInputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismissToolbar(); };
    const onMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) dismissToolbar();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onMouseDown); };
  }, [dismissToolbar]);

  const handleRewrite = useCallback(async () => {
    if (!selectionToolbar || !selectionInstruction.trim() || isRewriting) return;
    setIsRewriting(true);
    try {
      const rewritten = await rewriteResumeSelection(selectionToolbar.selectedText, selectionInstruction, resumeText);
      if (rewritten && rewritten.trim()) {
        setResumeText(prev => prev.replace(selectionToolbar.selectedText, rewritten.trim()));
      }
    } finally {
      setIsRewriting(false);
      dismissToolbar();
      window.getSelection()?.removeAllRanges();
    }
  }, [selectionToolbar, selectionInstruction, isRewriting, resumeText, dismissToolbar]);

  const handleApplyFix = useCallback((id: string) => {
    const imp = improvements.find(i => i.id === id);
    if (!imp || appliedIds.has(id)) return;
    setResumeText(prev => prev.replace(imp.originalText, imp.suggestedText));
    setAppliedIds(prev => new Set(prev).add(id));
  }, [improvements, appliedIds]);

  const scrollToMark = useCallback((id: string) => {
    setSelectedImprovementId(id);
    setFlashId(id);
    setTimeout(() => setFlashId(null), 1800);
    setTimeout(() => {
      const markEl = canvasRef.current?.querySelector(`mark[data-improvement-id="${id}"]`);
      if (markEl) markEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }, []);

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
    improvements
      .filter(imp => !appliedIds.has(imp.id) && imp.originalText)
      .sort((a, b) => b.originalText.length - a.originalText.length)
      .forEach(imp => {
        const safe = imp.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(
          new RegExp(`(${safe})`, 'g'),
          `<mark data-improvement-id="${imp.id}">$1</mark>`
        );
      });
    return out;
  };

  const sortedImprovements = [...improvements].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
  const pendingCount = improvements.filter(i => !appliedIds.has(i.id)).length;

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
            <div className="font-display text-sm font-semibold" style={{ color: "var(--foreground)" }}>Resume Analyzer</div>
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
        <div className="flex-1 overflow-y-auto no-scrollbar flex justify-center items-start py-10 px-4 sm:px-8 print:p-0"
          style={{ background: "var(--muted)" }}>
          <div
            ref={canvasRef}
            onMouseUp={handleCanvasMouseUp}
            className="w-full max-w-[850px] p-10 sm:p-14 shrink-0 print:shadow-none print:m-0 print:p-0"
            style={{ background: "var(--card)", boxShadow: "0 4px 25px rgba(0,0,0,0.06)" }}>
            <ResumeRenderer
              markdownContent={getHighlightedMarkdown()}
              templateType="Modern & Clean"
              customComponents={{
                mark: ({ node, children, ...props }: any) => {
                  const id = props['data-improvement-id'] as string;
                  const imp = improvements.find(i => i.id === id);
                  if (!imp) return <mark>{children}</mark>;
                  const selected = selectedImprovementId === id;
                  const flashing = flashId === id;
                  return (
                    <mark
                      data-improvement-id={id}
                      className="cursor-pointer px-0.5"
                      style={{
                        background: flashing
                          ? 'rgba(217,119,87,0.40)'
                          : selected
                            ? 'rgba(217,119,87,0.22)'
                            : 'rgba(217,119,87,0.10)',
                        borderBottom: '2px solid var(--primary)',
                        borderRadius: 2,
                        color: 'var(--foreground)',
                        outline: flashing ? '2px solid rgba(217,119,87,0.70)' : 'none',
                        outlineOffset: '2px',
                        boxShadow: flashing ? '0 0 0 4px rgba(217,119,87,0.18)' : 'none',
                        transition: 'background 0.5s ease, outline 0.5s ease, box-shadow 0.5s ease',
                      }}
                      onClick={() => {
                        setActiveTab('suggestions');
                        setSelectedImprovementId(id);
                        setTimeout(() => {
                          document.getElementById(`improvement-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }, 50);
                      }}
                    >
                      {children}
                    </mark>
                  );
                }
              }}
            />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-full lg:w-[400px] flex flex-col shrink-0 print:hidden"
          style={{ background: "var(--card)", borderLeft: "1px solid var(--border)" }}>

          {activeTab === "suggestions" ? (
            <>
              {/* Panel header */}
              <div className="shrink-0 px-5 py-4" style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                    <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
                    Analysis report
                  </div>
                  {!isAnalyzing && improvements.length > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 900, color: "var(--primary)", background: "rgba(217,119,87,0.10)", border: "1px solid rgba(217,119,87,0.25)", padding: "2px 8px", borderRadius: 9999, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {pendingCount} pending
                    </span>
                  )}
                </div>
              </div>

              {isAnalyzing ? (
                /* Loading skeleton */
                <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[80, 64, 64, 64, 56].map((h, i) => (
                    <div key={i} className="animate-pulse rounded-xl" style={{ height: h, background: 'var(--muted)' }} />
                  ))}
                  <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)', marginTop: 8 }}>
                    Analysing your resume…
                  </p>
                </div>
              ) : (
                <ScrollArea className="flex-1 min-h-0">
                  <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Score + summary card */}
                    {(overallScore != null || summary) && (
                      <div style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {overallScore != null && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--muted-foreground)" }}>Resume Score</span>
                            <span className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}>
                              {overallScore}<span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500 }}>/100</span>
                            </span>
                          </div>
                        )}
                        {summary && (
                          <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6, margin: 0 }}>{summary}</p>
                        )}
                      </div>
                    )}

                    {improvements.length === 0 ? (
                      <div style={{ padding: "32px 0", textAlign: "center" }}>
                        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "var(--muted-foreground)" }}>
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                          No improvements found — your résumé looks strong!
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Improvements section header */}
                        <div style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--muted-foreground)", paddingTop: 4 }}>
                          Improvements ({pendingCount} of {improvements.length} remaining)
                        </div>

                        {/* Improvement cards sorted high → medium → low */}
                        {sortedImprovements.map(imp => {
                          const applied = appliedIds.has(imp.id);
                          const selected = selectedImprovementId === imp.id;
                          return (
                            <div
                              key={imp.id}
                              id={`improvement-${imp.id}`}
                              onClick={() => scrollToMark(imp.id)}
                              style={{
                                background: "var(--card)",
                                border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                                borderRadius: 16,
                                padding: 16,
                                cursor: "pointer",
                                transition: "all 0.15s",
                                boxShadow: selected ? "0 0 0 1px var(--primary)" : "none",
                                opacity: applied ? 0.5 : 1,
                              }}
                            >
                              {/* Badges row */}
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                <span style={{
                                  fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em",
                                  padding: "3px 8px", borderRadius: 9999,
                                  ...priorityStyles[imp.priority],
                                }}>
                                  {imp.priority}
                                </span>
                                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-foreground)", opacity: 0.7 }}>
                                  {imp.category}
                                </span>
                              </div>

                              {/* Checklist label */}
                              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: "0 0 4px" }}>
                                {imp.checklistLabel}
                              </p>

                              {/* Description */}
                              <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.55, margin: "0 0 10px" }}>
                                {imp.description}
                              </p>

                              {/* Apply / Applied */}
                              {!applied ? (
                                <button
                                  onClick={e => { e.stopPropagation(); handleApplyFix(imp.id); }}
                                  style={{
                                    width: "100%", height: 32, borderRadius: 8,
                                    border: "1px solid var(--border)", cursor: "pointer",
                                    background: "var(--card)", color: "var(--primary)",
                                    fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                                    transition: "background 0.15s",
                                  }}
                                >
                                  <Sparkles className="w-3 h-3" /> Apply Fix
                                </button>
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--forest)", fontWeight: 600 }}>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Applied
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </ScrollArea>
              )}
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

      {/* Floating selection toolbar */}
      {selectionToolbar && (
        <div
          ref={toolbarRef}
          style={{
            position: "fixed",
            top: selectionToolbar.top - 8,
            left: Math.max(8, selectionToolbar.left + selectionToolbar.width / 2 - 180),
            transform: "translateY(-100%)",
            zIndex: 100,
            width: 360,
            background: "var(--foreground)",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => setSelectionInstruction(action.instruction)}
                style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 9999, cursor: "pointer",
                  background: selectionInstruction === action.instruction ? "var(--primary)" : "rgba(251,247,241,0.10)",
                  color: selectionInstruction === action.instruction ? "#fff" : "rgba(251,247,241,0.75)",
                  border: selectionInstruction === action.instruction ? "1px solid var(--primary)" : "1px solid rgba(251,247,241,0.15)",
                  transition: "all 0.15s",
                }}
              >
                {action.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              ref={instructionInputRef}
              value={selectionInstruction}
              onChange={e => setSelectionInstruction(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleRewrite(); }}
              placeholder="Or type your own instruction…"
              style={{
                flex: 1, height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(251,247,241,0.20)",
                background: "rgba(251,247,241,0.08)", color: "rgba(251,247,241,0.90)", fontSize: 12,
                fontFamily: "inherit", outline: "none",
              }}
            />
            <button
              onClick={handleRewrite}
              disabled={!selectionInstruction.trim() || isRewriting}
              style={{
                width: 34, height: 34, borderRadius: 8, border: "none",
                cursor: selectionInstruction.trim() && !isRewriting ? "pointer" : "not-allowed",
                background: selectionInstruction.trim() && !isRewriting ? "var(--primary)" : "rgba(251,247,241,0.10)",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s",
              }}
            >
              {isRewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
            <button
              onClick={dismissToolbar}
              style={{ width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(251,247,241,0.08)", color: "rgba(251,247,241,0.5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p style={{ fontSize: 10, color: "rgba(251,247,241,0.35)", margin: 0, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            "{selectionToolbar.selectedText}"
          </p>
        </div>
      )}
    </div>
  );
}
