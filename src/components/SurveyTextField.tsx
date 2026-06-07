import React, { useRef, useState } from "react";
import { Mic, Square, Wand2, Lightbulb, Loader2, Check, X, HelpCircle } from "lucide-react";
import { useDictation } from "@/hooks/useDictation";
import { improveSurveyAnswer, type ImproveMode } from "@/services/geminiService";
import { UNSURE } from "@/types/userProfile";

interface SurveyTextFieldProps {
  id: string;
  /** Plain-text label, also used as the question context for AI improvement. */
  label: string;
  /** Optional rich label to render in place of `label` (e.g. colored markup). */
  labelNode?: React.ReactNode;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  /** Show the "Unsure" pill. Defaults to true (survey use); set false elsewhere. */
  showUnsure?: boolean;
}

const fieldStyle: React.CSSProperties = {
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 14,
  color: "var(--foreground)",
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--foreground)",
  marginBottom: 8,
  display: "block",
};

const pillBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 12px",
  borderRadius: 9999,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const MODE_META: Record<ImproveMode, { title: string; accent: string }> = {
  refine: { title: "Refined", accent: "var(--primary)" },
  suggest: { title: "Suggestion", accent: "var(--marigold)" },
};

export function SurveyTextField({ id, label, labelNode, value, placeholder, onChange, showUnsure = true }: SurveyTextFieldProps) {
  const [suggestion, setSuggestion] = useState<{ mode: ImproveMode; text: string } | null>(null);
  const [busy, setBusy] = useState<ImproveMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Snapshot the field when recording starts; interim results replace (not
  // duplicate) the live session text appended onto that base.
  const baseRef = useRef("");

  const { supported, listening, toggle } = useDictation({
    onText: (sessionText) => {
      const base = baseRef.current.trim();
      onChange(base ? `${base} ${sessionText}` : sessionText);
    },
    onError: (message) => setVoiceError(message),
  });

  const handleMic = () => {
    if (!listening) {
      baseRef.current = value;
      setVoiceError(null);
    }
    toggle();
  };

  const runImprove = async (mode: ImproveMode) => {
    const text = value.trim();
    if (!text || busy) return;
    setBusy(mode);
    setError(null);
    try {
      const out = await improveSurveyAnswer(label, text, mode);
      setSuggestion({ mode, text: out });
    } catch (err) {
      console.error("AI improve failed:", err);
      setError("Couldn't reach the AI — is the gateway running?");
    } finally {
      setBusy(null);
    }
  };

  const acceptSuggestion = () => {
    if (suggestion) onChange(suggestion.text);
    setSuggestion(null);
  };
  const rejectSuggestion = () => setSuggestion(null);

  const isUnsure = value === UNSURE;

  const toggleUnsure = () => {
    setSuggestion(null);
    setError(null);
    setVoiceError(null);
    if (listening) toggle();
    onChange(isUnsure ? "" : UNSURE);
  };

  const hasText = !isUnsure && value.trim().length > 0;
  const panel = suggestion ? MODE_META[suggestion.mode] : null;

  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{labelNode ?? label}</label>

      <div style={{ position: "relative" }}>
        <textarea
          id={id}
          value={isUnsure ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isUnsure ? "Marked as unsure — tap Unsure again to answer" : placeholder}
          rows={2}
          disabled={isUnsure}
          style={{ ...fieldStyle, padding: "12px 44px 12px 14px", resize: "vertical", lineHeight: 1.6, opacity: isUnsure ? 0.6 : 1, cursor: isUnsure ? "not-allowed" : "auto" }}
        />
        {supported && !isUnsure && (
          <button
            type="button"
            onClick={handleMic}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            aria-pressed={listening}
            title={listening ? "Stop recording" : "Dictate your answer"}
            style={{
              position: "absolute", top: 8, right: 8,
              width: 32, height: 32, borderRadius: 9999,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px solid ${listening ? "var(--primary)" : "var(--border)"}`,
              background: listening ? "var(--primary)" : "var(--card)",
              color: listening ? "#fff" : "var(--muted-foreground)",
              cursor: "pointer",
            }}
          >
            {listening
              ? <Square className="w-3.5 h-3.5" fill="currentColor" />
              : <Mic className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, minHeight: 20, flexWrap: "wrap" }}>
        {listening ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--primary)" }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 9999, background: "var(--primary)" }} className="animate-pulse" />
            Listening… speak now
          </span>
        ) : (
          <>
            {!isUnsure && (
              <>
                <FieldTooltip label="Polishes how it's written — grammar, clarity, concision, tone & stronger wording — without adding new ideas.">
                  <button
                    type="button"
                    onClick={() => runImprove("refine")}
                    disabled={!hasText || busy !== null}
                    style={{ ...pillBtn, opacity: !hasText || busy !== null ? 0.5 : 1, cursor: !hasText || busy !== null ? "not-allowed" : "pointer", color: "var(--primary)", borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)" }}
                  >
                    {busy === "refine" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    Refine
                  </button>
                </FieldTooltip>
                <FieldTooltip label="Reviews your answer and proposes a fuller version to help complete your thought.">
                  <button
                    type="button"
                    onClick={() => runImprove("suggest")}
                    disabled={!hasText || busy !== null}
                    style={{ ...pillBtn, opacity: !hasText || busy !== null ? 0.5 : 1, cursor: !hasText || busy !== null ? "not-allowed" : "pointer", color: "var(--foreground)", borderColor: "color-mix(in srgb, var(--marigold) 55%, transparent)" }}
                  >
                    {busy === "suggest" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" style={{ color: "var(--marigold)" }} />}
                    Suggest
                  </button>
                </FieldTooltip>
              </>
            )}
            {showUnsure && (
              <FieldTooltip label="Mark this question as unsure if you don't know how to answer it yet.">
                <button
                  type="button"
                  onClick={toggleUnsure}
                  aria-pressed={isUnsure}
                  style={{ ...pillBtn, background: isUnsure ? "color-mix(in srgb, var(--muted-foreground) 18%, transparent)" : "var(--card)", borderColor: isUnsure ? "var(--muted-foreground)" : "var(--border)", color: "var(--muted-foreground)" }}
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Unsure
                </button>
              </FieldTooltip>
            )}
          </>
        )}
        {error && <span style={{ fontSize: 12, color: "var(--destructive, #ef4444)" }}>{error}</span>}
      </div>

      {voiceError && (
        <div role="alert" style={{ fontSize: 12, color: "var(--destructive, #ef4444)", marginTop: 6, lineHeight: 1.5 }}>
          {voiceError}
        </div>
      )}

      {/* Suggestion / refinement panel */}
      {suggestion && panel && (
        <div
          role="region"
          aria-label={panel.title}
          style={{ marginTop: 10, borderRadius: 14, border: `1px solid color-mix(in srgb, ${panel.accent} 40%, transparent)`, background: `color-mix(in srgb, ${panel.accent} 8%, transparent)`, overflow: "hidden" }}
        >
          <div style={{ padding: "10px 14px", borderBottom: `1px solid color-mix(in srgb, ${panel.accent} 22%, transparent)`, display: "flex", alignItems: "center", gap: 8 }}>
            {suggestion.mode === "refine"
              ? <Wand2 className="w-3.5 h-3.5" style={{ color: panel.accent }} />
              : <Lightbulb className="w-3.5 h-3.5" style={{ color: panel.accent }} />}
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{panel.title}</span>
          </div>
          <div style={{ padding: "12px 14px", fontSize: 14, lineHeight: 1.6, color: "var(--foreground)", whiteSpace: "pre-wrap" }}>
            {suggestion.text}
          </div>
          <div style={{ display: "flex", gap: 8, padding: "0 14px 12px" }}>
            <button
              type="button"
              onClick={acceptSuggestion}
              style={{ ...pillBtn, background: "var(--primary)", color: "#fff", border: "none" }}
            >
              <Check className="w-3.5 h-3.5" /> Accept
            </button>
            <button
              type="button"
              onClick={rejectSuggestion}
              style={{ ...pillBtn }}
            >
              <X className="w-3.5 h-3.5" /> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Lightweight tooltip. The wrapper span (not the inner control) carries the
 * hover/focus handlers, so the tooltip still shows when the button it wraps is
 * disabled — unlike the native `title` attribute.
 */
function FieldTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "max-content",
            maxWidth: 240,
            padding: "7px 10px",
            borderRadius: 8,
            background: "var(--foreground)",
            color: "var(--background)",
            fontSize: 11,
            fontWeight: 500,
            lineHeight: 1.4,
            textAlign: "center",
            boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
            zIndex: 60,
            pointerEvents: "none",
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
