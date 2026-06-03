/**
 * ResumeGeneratorWorkspace — thin wrapper around DocumentEditor.
 * Handles resume-specific concerns: initial AI generation from form data,
 * saved variants, and the resume-tuned AI system prompt.
 * When analysisResult is provided, shows the score + improvements panel
 * in the right sidebar instead of the chat.
 */
import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from "react";
import { Loader2, Bookmark, Sparkles, CheckCircle2 } from "lucide-react";
import { createTechCoachChat, sendMessageStream, type ResumeAnalysisResult, type Improvement } from "@/services/geminiService";
import { workflowsConfig } from "@/config/workflows";
import { useUserProfile } from "@/context/UserProfileContext";
import { generateId } from "@/types/userProfile";
import { DocumentEditor, DocMessage, DocumentEditorHandle } from "./DocumentEditor";

export interface ResumeGeneratorWorkspaceHandle {
  applyFix(original: string, suggested: string): void;
}
import { ScrollArea } from "@/components/ui/scroll-area";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Chat = any;

const PRIORITY_ORDER: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 };

const priorityStyles: Record<'high' | 'medium' | 'low', React.CSSProperties> = {
  high:   { background: 'rgba(217,119,87,0.15)', border: '1px solid rgba(217,119,87,0.40)', color: 'var(--primary)' },
  medium: { background: 'rgba(110,101,87,0.10)', border: '1px solid rgba(110,101,87,0.25)', color: 'var(--muted-foreground)' },
  low:    { background: 'rgba(110,101,87,0.05)', border: '1px solid rgba(110,101,87,0.15)', color: 'var(--muted-foreground)' },
};

interface ResumeGeneratorWorkspaceProps {
  initialFormData?: Record<string, any>;
  initialResumeText?: string;
  initialHtml?: string;
  rawHtmlMode?: boolean;
  initialChatMessages?: DocMessage[];
  systemInstruction?: string;
  analysisResult?: ResumeAnalysisResult | null;
  isAnalyzing?: boolean;
  rightSidebarContent?: React.ReactNode;
  onReset: () => void;
}

export const ResumeGeneratorWorkspace = forwardRef<ResumeGeneratorWorkspaceHandle, ResumeGeneratorWorkspaceProps>(function ResumeGeneratorWorkspace({
  initialFormData,
  initialResumeText,
  initialHtml,
  rawHtmlMode = false,
  initialChatMessages,
  systemInstruction,
  analysisResult,
  isAnalyzing = false,
  rightSidebarContent: rightSidebarContentProp,
  onReset,
}, ref) {
  const docEditorRef = useRef<DocumentEditorHandle>(null);
  useImperativeHandle(ref, () => ({
    applyFix: (original, suggested) => docEditorRef.current?.applyFix(original, suggested),
  }));

  const { profile, updateProfile } = useUserProfile();
  const [content, setContent] = useState(initialResumeText ?? "");
  const [isGenerating, setIsGenerating] = useState(!initialResumeText && !initialChatMessages && !analysisResult && !initialHtml);
  const [chatInstance, setChatInstance] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<DocMessage[]>(() => {
    if (initialChatMessages) return initialChatMessages;
    if (initialResumeText) return [{ role: "model", text: initialResumeText }];
    return [];
  });

  // Analysis panel state
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  // Save-variant dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const config = workflowsConfig["resume_generation"];
    const baseInstruction = systemInstruction ?? config.systemInstruction;
    const systemPrompt =
      baseInstruction +
      "\n\nCRITICAL INSTRUCTION: When you provide the resume, wrap it ENTIRELY in ```markdown\n[content]\n``` so the editor can parse it. Only use that block when you want to update the document.";

    const chat = createTechCoachChat(systemPrompt, config.enableSearch);
    setChatInstance(chat);

    if (initialChatMessages || initialResumeText || analysisResult !== undefined) { setIsGenerating(false); return; }
    if (!initialFormData) { setIsGenerating(false); return; }

    let mounted = true;
    (async () => {
      const prompt = config.generatePrompt(initialFormData);
      setChatMessages([
        { role: "user", text: "Please generate my resume based on my details." },
        { role: "model", text: "" },
      ]);
      try {
        let full = "";
        await sendMessageStream(chat, prompt as string, chunk => {
          full += chunk;
          setChatMessages(prev => {
            const m = [...prev];
            m[m.length - 1] = { role: "model", text: full };
            return m;
          });
          const match = full.match(/```(?:markdown|md)?\s*([\s\S]*?)(?:```|$)/);
          if (match?.[1]) setContent(match[1].trim());
          else if (full.trim().length > 100 && !full.includes("```")) setContent(full.trim());
        });
      } catch (err) {
        console.error("Resume generation failed:", err);
      } finally {
        if (mounted) setIsGenerating(false);
      }
    })();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFix = useCallback((imp: Improvement) => {
    if (appliedIds.has(imp.id)) return;
    setContent(prev => prev.replace(imp.originalText, imp.suggestedText));
    setAppliedIds(prev => new Set(prev).add(imp.id));
  }, [appliedIds]);

  const handleSaveVariant = async () => {
    const name = saveName.trim() || `Resume ${new Date().toLocaleDateString()}`;
    setIsSaving(true);
    try {
      const existing = profile.savedResumes ?? [];
      await updateProfile({
        savedResumes: [
          ...existing,
          { id: generateId(), name, text: content, createdAt: new Date().toISOString() },
        ],
      });
      setShowSaveDialog(false);
      setSaveName("");
    } catch (err) {
      console.error("Failed to save variant:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // rightSidebarContentProp takes priority (e.g. from ResumeAnalysisWorkspace);
  // fall back to the internal AnalysisPanel when analysisResult is passed directly.
  const internalPanel = analysisResult !== undefined ? (
    <AnalysisPanel
      result={analysisResult}
      isAnalyzing={isAnalyzing}
      appliedIds={appliedIds}
      onApply={handleApplyFix}
    />
  ) : undefined;
  const analysisPanel = rightSidebarContentProp ?? internalPanel;

  return (
    <>
      <DocumentEditor
        ref={docEditorRef}
        content={content}
        onChange={setContent}
        isLoading={isGenerating}
        title="Resume"
        aiChat={chatInstance}
        aiMessages={chatMessages}
        aiEnabled={analysisResult === undefined}
        aiPlaceholder="Ask AI to improve, rewrite a section, adjust tone…"
        exportFileName="resume"
        onClose={onReset}
        onSave={() => setShowSaveDialog(true)}
        rightSidebarContent={analysisPanel}
        initialHtml={initialHtml}
        rawHtmlMode={rawHtmlMode}
      />

      {/* Save-variant dialog */}
      {showSaveDialog && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="font-display text-lg font-semibold mb-1" style={{ color: "#202124" }}>
              Save resume variant
            </div>
            <p className="text-xs mb-4" style={{ color: "#5f6368" }}>
              Give this version a name (e.g. "Google SWE Application").
            </p>
            <input
              autoFocus
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSaveVariant(); }}
              placeholder={`Resume ${new Date().toLocaleDateString()}`}
              className="w-full outline-none mb-4"
              style={{ height: 44, padding: "0 14px", background: "#f8f9fa", border: "1px solid #dadce0", borderRadius: 8, fontSize: 14, color: "#202124", fontFamily: "inherit" }}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                style={{ height: 40, padding: "0 16px", background: "transparent", border: "1px solid #dadce0", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "#5f6368" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVariant}
                disabled={isSaving}
                style={{ height: 40, padding: "0 20px", background: "#1a73e8", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: isSaving ? "not-allowed" : "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6, opacity: isSaving ? 0.7 : 1 }}
              >
                {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Bookmark className="w-3.5 h-3.5" /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

/* ── Analysis Panel ──────────────────────────────────────────────── */

export function AnalysisPanel({
  result,
  isAnalyzing,
  appliedIds,
  selectedImpId,
  onSelect,
  onApply,
}: {
  result: ResumeAnalysisResult | null;
  isAnalyzing: boolean;
  appliedIds: Set<string>;
  selectedImpId?: string | null;
  onSelect?: (id: string) => void;
  onApply: (imp: Improvement) => void;
}) {
  const improvements = result?.improvements ?? [];
  const sorted = [...improvements].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const pendingCount = improvements.filter(i => !appliedIds.has(i.id)).length;

  // Boost score as fixes are applied: high +5, medium +3, low +1
  const scoreBoost = [...appliedIds].reduce((acc, id) => {
    const imp = improvements.find(i => i.id === id);
    return acc + (imp ? (imp.priority === "high" ? 5 : imp.priority === "medium" ? 3 : 1) : 0);
  }, 0);
  const displayScore = result?.overallScore != null ? Math.min(100, result.overallScore + scoreBoost) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
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
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {[80, 64, 64, 64, 56].map((h, i) => (
            <div key={i} className="animate-pulse rounded-xl" style={{ height: h, background: "var(--muted)" }} />
          ))}
          <p className="text-xs text-center" style={{ color: "var(--muted-foreground)", marginTop: 8 }}>
            Analysing your resume…
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Score + summary */}
            {(result?.overallScore != null || result?.summary) && (
              <div style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {displayScore != null && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--muted-foreground)" }}>Resume Score</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", transition: "all 0.4s" }}>
                        {displayScore}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500 }}>/100</span>
                      {scoreBoost > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--forest)", background: "rgba(47,107,79,0.10)", border: "1px solid rgba(47,107,79,0.25)", padding: "1px 6px", borderRadius: 9999 }}>
                          +{scoreBoost}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {result?.summary && (
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.6, margin: 0 }}>{result.summary}</p>
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
                <div style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--muted-foreground)", paddingTop: 4 }}>
                  Improvements ({pendingCount} of {improvements.length} remaining)
                </div>
                {sorted.map(imp => {
                  const applied = appliedIds.has(imp.id);
                  const selected = selectedImpId === imp.id;
                  return (
                    <div
                      key={imp.id}
                      id={`imp-card-${imp.id}`}
                      onClick={() => !applied && onSelect?.(imp.id)}
                      style={{
                        background: "var(--card)",
                        border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                        borderRadius: 16,
                        padding: 16,
                        opacity: applied ? 0.5 : 1,
                        transition: "opacity 0.2s, border-color 0.15s, box-shadow 0.15s",
                        cursor: applied ? "default" : "pointer",
                        boxShadow: selected ? "0 0 0 2px rgba(217,119,87,0.25)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", padding: "3px 8px", borderRadius: 9999, ...priorityStyles[imp.priority] }}>
                          {imp.priority}
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-foreground)", opacity: 0.7 }}>
                          {imp.category}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: "0 0 4px" }}>{imp.checklistLabel}</p>
                      <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.55, margin: "0 0 10px" }}>{imp.description}</p>
                      {!applied ? (
                        <button
                          onClick={e => { e.stopPropagation(); onApply(imp); }}
                          style={{ width: "100%", height: 32, borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", background: "var(--card)", color: "var(--primary)", fontSize: 11, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "background 0.15s" }}
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
    </div>
  );
}
