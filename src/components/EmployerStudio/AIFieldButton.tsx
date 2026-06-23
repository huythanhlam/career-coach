import React, { useState } from "react";
import { Wand2, Sparkles, Loader2, Check, X } from "lucide-react";
import { rewriteEmployerField } from "@/services/employerService";
import { labelStyle, textareaStyle, pillBtn } from "./styles";

const AI_DOWN = "Couldn't reach the AI — is the gateway running?";

interface AITextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  /** Full document/field context handed to the rewrite model. */
  context: string;
  /** Default instruction for the one-click "Improve" action. */
  improveInstruction?: string;
  /** When provided, shows a "Generate" button that produces fresh content. */
  onGenerate?: () => Promise<string>;
  generateLabel?: string;
}

type Suggestion = { kind: "improve" | "generate"; text: string };

/**
 * A textarea with inline AI assistance — "Improve" rewrites the current text,
 * "Generate" (optional) drafts fresh content. Both surface an accept/reject
 * panel, mirroring the SurveyTextField UX. AI calls go through employerService.
 */
export function AITextField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  context,
  improveInstruction = "Improve clarity, impact, and professionalism while keeping the meaning.",
  onGenerate,
  generateLabel = "Generate",
}: AITextFieldProps) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState<Suggestion["kind"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasText = value.trim().length > 0;

  const runImprove = async () => {
    if (!hasText || busy) return;
    setBusy("improve");
    setError(null);
    try {
      const text = await rewriteEmployerField(value, improveInstruction, context || value);
      if (text.trim()) setSuggestion({ kind: "improve", text });
    } catch (err) {
      console.error("AI improve failed:", err);
      setError(AI_DOWN);
    } finally {
      setBusy(null);
    }
  };

  const runGenerate = async () => {
    if (!onGenerate || busy) return;
    setBusy("generate");
    setError(null);
    try {
      const text = await onGenerate();
      if (text.trim()) setSuggestion({ kind: "generate", text });
    } catch (err) {
      console.error("AI generate failed:", err);
      setError(AI_DOWN);
    } finally {
      setBusy(null);
    }
  };

  const accept = () => {
    if (suggestion) onChange(suggestion.text);
    setSuggestion(null);
  };

  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={textareaStyle}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {onGenerate && (
          <button
            type="button"
            onClick={runGenerate}
            disabled={busy !== null}
            style={{ ...pillBtn, color: "var(--primary)", borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)", opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer" }}
          >
            {busy === "generate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {value.trim() ? `${generateLabel} again` : generateLabel}
          </button>
        )}
        <button
          type="button"
          onClick={runImprove}
          disabled={!hasText || busy !== null}
          style={{ ...pillBtn, opacity: !hasText || busy !== null ? 0.5 : 1, cursor: !hasText || busy !== null ? "not-allowed" : "pointer" }}
        >
          {busy === "improve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          Improve with AI
        </button>
        {error && <span style={{ fontSize: 12, color: "var(--destructive, #ef4444)" }}>{error}</span>}
      </div>

      {suggestion && (
        <div
          role="region"
          aria-label="AI suggestion"
          style={{ marginTop: 10, borderRadius: 14, border: "1px solid color-mix(in srgb, var(--primary) 40%, transparent)", background: "color-mix(in srgb, var(--primary) 8%, transparent)", overflow: "hidden" }}
        >
          <div style={{ padding: "10px 14px", borderBottom: "1px solid color-mix(in srgb, var(--primary) 22%, transparent)", display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {suggestion.kind === "generate" ? "Generated draft" : "Suggested rewrite"}
            </span>
          </div>
          <div style={{ padding: "12px 14px", fontSize: 14, lineHeight: 1.6, color: "var(--foreground)", whiteSpace: "pre-wrap", maxHeight: 280, overflow: "auto" }}>
            {suggestion.text}
          </div>
          <div style={{ display: "flex", gap: 8, padding: "0 14px 12px" }}>
            <button type="button" onClick={accept} style={{ ...pillBtn, background: "var(--primary)", color: "#fff", border: "none" }}>
              <Check className="w-3.5 h-3.5" /> {value.trim() ? "Replace" : "Use this"}
            </button>
            <button type="button" onClick={() => setSuggestion(null)} style={pillBtn}>
              <X className="w-3.5 h-3.5" /> Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
