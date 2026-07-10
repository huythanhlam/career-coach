import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StopGeneratingButton } from "@/components/ui/stop-generating-button";
import { streamWorkflow } from "@/ai/client";
import { followUpDraftWorkflow } from "@/ai/workflows/followUpDraft";
import { toast } from "@/components/ui/toast";
import type { JobPosting } from "@/types/jobPosting";

interface FollowUpDraftModalProps {
  draftKind: "follow_up" | "thank_you";
  posting: JobPosting;
  resumeText: string;
  baseline: string;
  onClose: () => void;
  onMarkDone: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
}

const MODAL_TITLE: Record<"follow_up" | "thank_you", string> = {
  follow_up: "Draft a follow-up",
  thank_you: "Draft a thank-you note",
};

/**
 * Streams a follow-up/thank-you email draft on demand (F3 Slice A) — never
 * persisted, generated fresh every time the user opens a draftable nudge.
 * Reuses the F2 streaming + abort infrastructure (`streamWorkflow`,
 * `StopGeneratingButton`).
 */
export function FollowUpDraftModal({
  draftKind,
  posting,
  resumeText,
  baseline,
  onClose,
  onMarkDone,
  onSnooze,
  onDismiss,
}: FollowUpDraftModalProps) {
  const [draft, setDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    let full = "";
    setIsGenerating(true);
    setError("");
    streamWorkflow(
      followUpDraftWorkflow,
      {
        kind: draftKind,
        jobTitle: posting.title,
        company: posting.company ?? "",
        jobDescription: posting.description ?? "",
        resumeText,
        baseline,
      },
      {
        signal: controller.signal,
        onToken: (delta) => {
          full += delta;
          setDraft(full);
        },
      },
    )
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("Follow-up draft failed:", err);
        setError("Couldn't generate the draft. Make sure the AI gateway is reachable, then try again.");
      })
      .finally(() => {
        setIsGenerating(false);
        abortRef.current = null;
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast("Copied to clipboard", "success");
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(31,27,22,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full mx-4 overflow-hidden"
        style={{
          maxWidth: 560,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 24,
          boxShadow: "0 24px 80px rgba(31,27,22,0.22)",
          padding: 28,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            color: "var(--muted-foreground)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="font-display" style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          {MODAL_TITLE[draftKind]}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 4 }}>
          {posting.title} at {posting.company ?? "this company"}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>
          We never send anything automatically — copy this draft and send it yourself.
        </div>

        {error ? (
          <div style={{ fontSize: 13, color: "#B3422F", marginBottom: 12 }}>{error}</div>
        ) : null}

        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={isGenerating}
          rows={10}
          style={{ width: "100%", resize: "vertical" }}
          aria-label="Draft text"
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16,
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {isGenerating ? <StopGeneratingButton onStop={() => abortRef.current?.abort()} /> : <div />}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button type="button" variant="outline" size="sm" onClick={onSnooze}>
              Snooze 3 days
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
              Dismiss
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onMarkDone}>
              Mark done
            </Button>
            <Button type="button" size="sm" onClick={handleCopy} disabled={!draft}>
              Copy
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
