import { useState } from "react";
import { X, Loader2, Sparkles, Save, Copy, Check } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { draftOutreachMessage } from "@/services/networkingService";
import type {
  OutreachTarget,
  OutreachType,
  OutreachTone,
  NewOutreachContact,
} from "@/types/outreach";
import { OUTREACH_LABELS, TONE_LABELS, PERSONA_LABELS } from "@/types/outreach";

interface OutreachComposerProps {
  company: string;
  companyIntel?: string;
  target: OutreachTarget;
  onClose: () => void;
  onSave: (contact: NewOutreachContact) => Promise<void>;
}

const OUTREACH_TYPES: OutreachType[] = ["linkedin_note", "referral", "cold_email", "coffee_chat"];
const TONES: OutreachTone[] = ["warm", "professional", "direct"];

export function OutreachComposer({
  company,
  companyIntel,
  target,
  onClose,
  onSave,
}: OutreachComposerProps) {
  const { profile } = useUserProfile();
  const [outreachType, setOutreachType] = useState<OutreachType>("linkedin_note");
  const [tone, setTone] = useState<OutreachTone>("warm");
  const [draft, setDraft] = useState("");
  const [contactName, setContactName] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setIsDrafting(true);
    try {
      const text = await draftOutreachMessage({
        company,
        companyIntel,
        profile,
        personaType: target.personaType,
        contactTitle: target.title,
        outreachType,
        tone,
      });
      setDraft(text);
    } catch (err) {
      console.error("Draft failed:", err);
    } finally {
      setIsDrafting(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave({
        company,
        contactName: contactName.trim() || undefined,
        contactTitle: target.title,
        personaType: target.personaType,
        outreachType,
        tone,
        messageDraft: draft,
      });
      setSaved(true);
      setTimeout(onClose, 800);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const pill = (active: boolean): React.CSSProperties => ({
    background: active ? "rgba(217,119,87,0.12)" : "var(--muted)",
    border: active ? "1px solid rgba(217,119,87,0.40)" : "1px solid var(--border)",
    color: active ? "var(--primary)" : "var(--muted-foreground)",
    cursor: "pointer",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2
              className="font-display text-lg font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Draft outreach
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {PERSONA_LABELS[target.personaType]} · {target.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted-foreground)",
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Channel */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
              Channel
            </label>
            <div className="flex flex-wrap gap-2">
              {OUTREACH_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setOutreachType(t)}
                  className="h-8 px-3 rounded-lg text-xs font-medium"
                  style={pill(outreachType === t)}
                >
                  {OUTREACH_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
              Tone
            </label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className="h-8 px-3 rounded-lg text-xs font-medium"
                  style={pill(tone === t)}
                >
                  {TONE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generate}
            disabled={isDrafting}
            className="h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              opacity: isDrafting ? 0.6 : 1,
              cursor: isDrafting ? "not-allowed" : "pointer",
            }}
          >
            {isDrafting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Drafting…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> {draft ? "Regenerate" : "Generate draft"}
              </>
            )}
          </button>

          {draft && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                  Message (edit freely)
                </label>
                <button
                  onClick={copy}
                  className="text-xs flex items-center gap-1"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--muted-foreground)",
                  }}
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3" style={{ color: "var(--forest)" }} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={8}
                className="w-full rounded-xl p-3 text-sm resize-y"
                style={{
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                Replace any [bracketed] placeholders with your own specifics before sending.
              </p>

              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Contact name (optional — once you find them)"
                className="w-full h-10 rounded-xl px-3 text-sm"
                style={{
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {draft && (
          <div className="px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              onClick={save}
              disabled={isSaving || saved}
              className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{
                background: saved ? "var(--forest)" : "var(--foreground)",
                color: "var(--background)",
                border: "none",
                opacity: isSaving ? 0.6 : 1,
                cursor: isSaving ? "not-allowed" : "pointer",
              }}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" /> Saved to tracker
                </>
              ) : isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save to tracker
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
