import { Loader2, DatabaseZap, Check, CircleAlert } from "lucide-react";
import type { RequestProfileResult } from "@/services/companyProfileService";
import { MentorCard } from "./shared";

interface Props {
  company: string;
  state: RequestProfileResult | "requesting" | null;
  onRequest: () => void;
}

/**
 * Shown above an AI-fallback result when no deterministic profile exists yet.
 * Lets the user queue the company for the build routine (which fetches verified
 * data from structured sources and opens a PR to push it into the DB).
 */
export function RequestProfileBanner({ company, state, onRequest }: Props) {
  const done = state === "queued" || state === "duplicate" || state === "exists";
  const msg =
    state === "queued"
      ? "Queued — we'll fetch verified data from public sources and open a PR for review."
      : state === "duplicate"
        ? "Already in the queue — we're on it."
        : state === "exists"
          ? "A verified profile now exists — look it up again to see it."
          : state === "error"
            ? "Couldn't submit the request. Please try again."
            : null;

  return (
    <MentorCard
      style={{
        overflow: "hidden",
        borderColor: "color-mix(in srgb, var(--primary) 30%, var(--border))",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "color-mix(in srgb, var(--primary) 14%, transparent)",
          }}
        >
          <DatabaseZap className="w-4 h-4" style={{ color: "var(--primary)" }} />
        </span>
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
            No verified profile for {company || "this company"} yet
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--muted-foreground)",
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
            {msg ??
              "The results below are AI-generated. Request a verified profile built from structured sources (Wikipedia, Wikidata, SEC, news) — no AI."}
          </div>
        </div>
        {!done && (
          <button
            onClick={onRequest}
            disabled={state === "requesting"}
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 10,
              border: "1px solid var(--primary)",
              background: "var(--primary)",
              color: "#FFF",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              cursor: state === "requesting" ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              flexShrink: 0,
            }}
          >
            {state === "requesting" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : state === "error" ? (
              <CircleAlert className="w-4 h-4" />
            ) : (
              <DatabaseZap className="w-4 h-4" />
            )}
            {state === "requesting"
              ? "Requesting…"
              : state === "error"
                ? "Retry"
                : "Request verified profile"}
          </button>
        )}
        {done && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "#2F6B4F",
              flexShrink: 0,
            }}
          >
            <Check className="w-4 h-4" /> Done
          </span>
        )}
      </div>
    </MentorCard>
  );
}
