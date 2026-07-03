import type { JobPosting, JobStatus } from "@/types/jobPosting";

// Application-pipeline analytics — pure, deterministic functions over the
// postings the user already tracks. Everything here is derivable client-side
// from `job_postings` rows (status + timestamps), so the Dashboard can show
// funnel rates and follow-up nudges with zero API calls.

/** Statuses meaning the user actually applied (rejected implies an application). */
const APPLIED_SET: ReadonlySet<JobStatus> = new Set([
  "applied",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
]);
/** Statuses meaning the company responded after the application. */
const RESPONSE_SET: ReadonlySet<JobStatus> = new Set([
  "interviewing",
  "offer",
  "accepted",
  "rejected",
]);
/** Statuses meaning the user reached at least the interview stage. */
const INTERVIEW_SET: ReadonlySet<JobStatus> = new Set(["interviewing", "offer", "accepted"]);
/** Statuses meaning an offer was extended. */
const OFFER_SET: ReadonlySet<JobStatus> = new Set(["offer", "accepted"]);

/** An application still sitting in "applied" longer than this needs a follow-up. */
export const STALE_AFTER_DAYS = 10;

export interface TailoredEdge {
  /** Response rate (0–1) for applications with a tailored/attached resume. */
  tailoredRate: number;
  /** Response rate (0–1) for applications without one. */
  untailoredRate: number;
}

export interface PipelineStats {
  /** Applications submitted (applied or any later stage). */
  applied: number;
  /** Applications that got any response (interview or rejection). */
  responses: number;
  /** Share of applications that got a response; null until something was applied to. */
  responseRate: number | null;
  /** Applications that reached at least an interview. */
  interviews: number;
  interviewRate: number | null;
  /** Offers received (offer or accepted). */
  offers: number;
  /** Still in "applied" with no movement for more than STALE_AFTER_DAYS. */
  staleApplications: JobPosting[];
  /** Tailored-resume vs plain response rates; null until both groups have ≥3 applications. */
  tailoredEdge: TailoredEdge | null;
}

function daysSince(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / 86_400_000;
}

export function computePipelineStats(
  postings: JobPosting[],
  now: Date = new Date(),
): PipelineStats {
  const appliedPostings = postings.filter((p) => APPLIED_SET.has(p.status));
  const applied = appliedPostings.length;
  const responses = appliedPostings.filter((p) => RESPONSE_SET.has(p.status)).length;
  const interviews = appliedPostings.filter((p) => INTERVIEW_SET.has(p.status)).length;
  const offers = appliedPostings.filter((p) => OFFER_SET.has(p.status)).length;

  const staleApplications = postings
    .filter((p) => {
      if (p.status !== "applied") return false;
      const age = daysSince(p.appliedAt ?? p.updatedAt, now);
      return age != null && age > STALE_AFTER_DAYS;
    })
    .sort(
      (a, b) =>
        new Date(a.appliedAt ?? a.updatedAt).getTime() -
        new Date(b.appliedAt ?? b.updatedAt).getTime(),
    );

  // Outcome attribution: does attaching a tailored resume change the response
  // rate? Only meaningful once both groups have a few data points.
  const tailored = appliedPostings.filter((p) => p.appliedResumeId);
  const untailored = appliedPostings.filter((p) => !p.appliedResumeId);
  const rate = (group: JobPosting[]) =>
    group.filter((p) => RESPONSE_SET.has(p.status)).length / group.length;
  const tailoredEdge: TailoredEdge | null =
    tailored.length >= 3 && untailored.length >= 3
      ? { tailoredRate: rate(tailored), untailoredRate: rate(untailored) }
      : null;

  return {
    applied,
    responses,
    responseRate: applied > 0 ? responses / applied : null,
    interviews,
    interviewRate: applied > 0 ? interviews / applied : null,
    offers,
    staleApplications,
    tailoredEdge,
  };
}

const STATUS_ORDER: JobStatus[] = [
  "applied",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "saved",
];

/**
 * Prompt-ready snapshot of the user's pipeline for the coach — counts per
 * stage plus the most active applications, so the coach can talk about the
 * user's actual search instead of asking.
 */
export function buildPipelineSummary(postings: JobPosting[]): string {
  const tracked = postings.filter((p) => p.status !== "suggested" && p.status !== "archived");
  if (tracked.length === 0) return "";

  const counts = STATUS_ORDER.map((s) => ({ s, n: tracked.filter((p) => p.status === s).length }))
    .filter(({ n }) => n > 0)
    .map(({ s, n }) => `${n} ${s}`)
    .join(", ");

  const active = tracked
    .filter((p) => p.status === "applied" || p.status === "interviewing" || p.status === "offer")
    .slice(0, 5)
    .map((p) => `- ${p.title}${p.company ? ` at ${p.company}` : ""} (${p.status})`);

  const lines = [`Job pipeline: ${tracked.length} tracked (${counts}).`];
  if (active.length) lines.push("Most active applications:", ...active);
  return lines.join("\n");
}
