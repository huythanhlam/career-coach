import React from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import Markdown from "react-markdown";
import { maskDocumentForDisplay, DOC_START, DOC_END } from "@/lib/aiDocFormat";
import { DocMessage } from "./index";

export interface AiSuggestionsPanelProps {
  aiMessages: DocMessage[];
  isAiGenerating: boolean;
  chatInput: string;
  setChatInput: (v: string) => void;
  selectedContext: string;
  setSelectedContext: (v: string) => void;
  aiPlaceholder: string;
  aiChat: unknown;
  showTailorPrompt: boolean;
  showTailorJd: boolean;
  setShowTailorJd: (v: boolean) => void;
  tailorJdInput: string;
  setTailorJdInput: (v: string) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  handleAiSubmit: (e?: React.FormEvent) => void;
}

export const AiSuggestionsPanel = React.memo(function AiSuggestionsPanel({
  aiMessages,
  isAiGenerating,
  chatInput,
  setChatInput,
  selectedContext,
  setSelectedContext,
  aiPlaceholder,
  aiChat,
  showTailorPrompt,
  showTailorJd,
  setShowTailorJd,
  tailorJdInput,
  setTailorJdInput,
  scrollRef,
  handleAiSubmit,
}: AiSuggestionsPanelProps) {
  return (
    <div className="flex flex-col shrink-0 print:hidden"
      style={{ width: 340, background: "var(--card)", borderLeft: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 px-4 shrink-0"
        style={{ height: 46, borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
        <Sparkles style={{ width: 15, height: 15, color: "var(--primary)" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>AI Coach</span>
        {selectedContext && (
          <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: "var(--primary)", background: "rgba(217,119,87,0.10)", padding: "2px 8px", borderRadius: 20 }}>TEXT SELECTED</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!aiMessages.filter(m => m.text).length && !isAiGenerating && (
          <div style={{ color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5, padding: "16px 0" }}>
            <p style={{ marginBottom: 8 }}>Highlight any text in the document, then ask me to:</p>
            <ul style={{ paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
              {["Rewrite it in a stronger tone", "Make it more concise", "Fix grammar and clarity", "Expand with more detail"].map(s => (
                <li key={s} style={{ fontSize: 12 }}>· {s}</li>
              ))}
            </ul>
          </div>
        )}
        {aiMessages.filter(m => m.text).map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "88%", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "9px 13px", background: msg.role === "user" ? "var(--primary)" : "var(--muted)", color: msg.role === "user" ? "#fff" : "var(--foreground)", fontSize: 13, lineHeight: 1.5 }}>
              <div className="prose prose-sm max-w-none" style={{ color: "inherit" }}>
                <Markdown>{maskDocumentForDisplay(msg.text)}</Markdown>
              </div>
            </div>
          </div>
        ))}
        {isAiGenerating && (!aiMessages.length || aiMessages[aiMessages.length - 1].role !== "model" || !aiMessages[aiMessages.length - 1].text) && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ background: "var(--muted)", borderRadius: "16px 16px 16px 4px", padding: "9px 13px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted-foreground)" }}>
              <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> Thinking…
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
      <div style={{ padding: "10px 12px 12px", borderTop: "1px solid var(--border)", background: "var(--muted)" }}>
        {showTailorPrompt && !showTailorJd && !selectedContext && (
          <div style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setShowTailorJd(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 20, border: "1px solid var(--border)", background: "var(--card)", fontSize: 11, fontWeight: 600, color: "var(--primary)", cursor: "pointer", fontFamily: "inherit" }}
            >
              ✦ Tailor to job description
            </button>
          </div>
        )}
        {showTailorPrompt && showTailorJd && (
          <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 6, padding: "10px", background: "rgba(217,119,87,0.06)", border: "1px solid rgba(217,119,87,0.2)", borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.04em" }}>PASTE JOB DESCRIPTION</div>
            <textarea
              autoFocus
              value={tailorJdInput}
              onChange={e => setTailorJdInput(e.target.value)}
              placeholder="Paste the full job description here…"
              rows={5}
              style={{ width: "100%", resize: "vertical", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", padding: "8px 10px", fontSize: 12, color: "var(--foreground)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  if (!tailorJdInput.trim()) return;
                  const prompt = `Tailor this entire resume to the job description below. Follow these rules strictly:

1. KEYWORDS: Naturally weave in keywords and phrases from the JD where my actual experience supports them. Do not force-fit terms I have no background in.
2. SUMMARY: Rewrite the summary to directly address the top 3–4 requirements of this role.
3. WORK BULLETS: For each job, reorder and strengthen bullets to front-load the most relevant experience. Use the XYZ formula (Action + metric/result) where the existing context supports quantification.
4. SKILLS: Reorder the skills section to lead with skills that appear in the JD and are already in my resume.
5. NO FABRICATION: Never invent new companies, roles, dates, projects, metrics, or skills that do not already exist in this resume. Only strengthen and reframe what is already there.
6. OUTPUT: Return the full tailored resume in Markdown, wrapped between ${DOC_START} and ${DOC_END} markers.

Job Description:
---
${tailorJdInput.trim()}
---`;
                  setChatInput(prompt);
                  setShowTailorJd(false);
                  setTailorJdInput("");
                }}
                style={{ flex: 1, height: 30, borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: tailorJdInput.trim() ? "pointer" : "not-allowed", opacity: tailorJdInput.trim() ? 1 : 0.5, fontFamily: "inherit" }}
              >
                Build prompt →
              </button>
              <button
                type="button"
                onClick={() => { setShowTailorJd(false); setTailorJdInput(""); }}
                style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--muted-foreground)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {selectedContext && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 8, background: "rgba(217,119,87,0.08)", border: "1px solid rgba(217,119,87,0.2)", borderRadius: 8, padding: "7px 10px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.05em", marginBottom: 2 }}>SELECTED</div>
              <div style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                "{selectedContext.length > 120 ? selectedContext.slice(0, 117) + "…" : selectedContext}"
              </div>
            </div>
            <button onClick={() => setSelectedContext("")} style={{ flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: 2, borderRadius: 4, display: "flex", alignItems: "center" }}>
              <X style={{ width: 12, height: 12 }} />
            </button>
          </div>
        )}
        <form onSubmit={handleAiSubmit} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <Textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
              placeholder={selectedContext ? "What would you like to do with the selection?" : aiPlaceholder}
              className="min-h-[40px] max-h-28 resize-y"
              style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, flex: 1, padding: "8px 10px", fontFamily: "inherit", color: "var(--foreground)" }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiSubmit(); } }} />
            <button type="submit" disabled={!chatInput.trim() || isAiGenerating || !aiChat}
              style={{ width: 38, height: 38, borderRadius: 10, background: "var(--primary)", border: "none", color: "#fff", cursor: chatInput.trim() && !isAiGenerating && aiChat ? "pointer" : "not-allowed", opacity: !chatInput.trim() || isAiGenerating || !aiChat ? 0.45 : 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "opacity 0.15s" }}>
              <Send style={{ width: 15, height: 15 }} />
            </button>
          </div>
          {!selectedContext && (
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.4 }}>
              Tip: highlight text in the document to give the AI specific context.
            </p>
          )}
        </form>
      </div>
    </div>
  );
});
