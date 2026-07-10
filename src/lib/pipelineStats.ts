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

  return {
    applied,
    responses,
    responseRate: applied > 0 ? responses / applied : null,
    interviews,
    interviewRate: applied > 0 ? interviews / applied : null,
    offers,
    staleApplications,
  };
}

/** Minimum applications a single resume-variant group needs before it's shown. */
const MIN_VARIANT_APPLICATIONS = 3;
/** Minimum total applied applications before the variant breakdown is shown at all. */
const MIN_TOTAL_FOR_VARIANT_BREAKDOWN = 10;
/** Minimum number of qualifying variant groups before the variant breakdown is shown. */
const MIN_VARIANT_GROUPS = 2;

export interface ResumeVariantStat {
  /** Saved-resume id this group is keyed by, or null for "no resume attached". */
  id: string | null;
  /** Display label — resume name, "No resume attached", or "Deleted resume"[ + suffix]. */
  label: string;
  /** Applications submitted with this variant. */
  applied: number;
  /** Applications in this group that got a response. */
  responses: number;
  /** responses / applied for this group. */
  responseRate: number;
}

/**
 * Response rate broken down by which resume variant was attached at
 * application time. Returns null unless there's enough data for the
 * breakdown to be meaningful (≥10 total applications AND ≥2 variant groups
 * with ≥3 applications each). Groups below the per-variant minimum are
 * simply omitted, not merged into an "other" bucket.
 */
export function computeResumeVariantStats(
  postings: JobPosting[],
  savedResumes: { id: string; name: string }[] | undefined,
): ResumeVariantStat[] | null {
  const appliedPostings = postings.filter((p) => APPLIED_SET.has(p.status));
  if (appliedPostings.length < MIN_TOTAL_FOR_VARIANT_BREAKDOWN) return null;

  const groups = new Map<string | null, JobPosting[]>();
  for (const p of appliedPostings) {
    const key = p.appliedResumeId ?? null;
    const group = groups.get(key);
    if (group) group.push(p);
    else groups.set(key, [p]);
  }

  // Disambiguate colliding "Deleted resume" labels with a short id suffix.
  const deletedIds = [...groups.keys()].filter(
    (id): id is string => id !== null && !savedResumes?.some((r) => r.id === id),
  );
  const labelFor = (id: string | null): string => {
    if (id === null) return "No resume attached";
    const saved = savedResumes?.find((r) => r.id === id);
    if (saved) return saved.name;
    return deletedIds.length > 1 ? `Deleted resume (${id.slice(0, 6)})` : "Deleted resume";
  };

  const stats: ResumeVariantStat[] = [...groups.entries()]
    .filter(([, group]) => group.length >= MIN_VARIANT_APPLICATIONS)
    .map(([id, group]) => {
      const responses = group.filter((p) => RESPONSE_SET.has(p.status)).length;
      return {
        id,
        label: labelFor(id),
        applied: group.length,
        responses,
        responseRate: responses / group.length,
      };
    })
    .sort((a, b) => b.responseRate - a.responseRate);

  if (stats.length < MIN_VARIANT_GROUPS) return null;
  return stats;
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
