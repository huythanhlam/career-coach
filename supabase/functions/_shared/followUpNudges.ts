// Deterministic nudge generation for the nightly `generate-nudges` cron
// (Coach OS F1 Slice B; extended by F3 Slice A). Template-only — no AI — so
// the run is free and reliable. See
// docs/superpowers/specs/2026-07-07-coach-os-f1-design.md §7 and
// docs/superpowers/specs/2026-07-09-f3-followup-agent-slice-a-design.md §5.
//
// STALE_AFTER_DAYS mirrors src/lib/pipelineStats.ts; duplicated here because
// Supabase Edge Functions (Deno) can't import from the Vite `src` tree (see
// jobTaxonomy.ts for the same pattern). Keep the two values in sync.

export const STALE_AFTER_DAYS = 10;

/** Thank-you window: long enough for the interview to have happened, short
 * enough that the note is still timely. A 24h-wide window guarantees the
 * once-daily cron catches it regardless of what time of day the interview
 * was stamped. */
export const THANK_YOU_MIN_DAYS = 1;
export const THANK_YOU_MAX_DAYS = 2;

/** The subset of a `job_postings` row this helper needs. */
export interface StalePostingCandidate {
  id: string;
  user_id: string;
  status: string;
  title: string;
  company: string | null;
  applied_at: string | null;
  interviewing_at: string | null;
  updated_at: string;
}

export interface FollowUpNudgeRow {
  user_id: string;
  kind: "follow_up";
  subject_id: string;
  title: string;
  body: string;
  cta_view: "dashboard";
  draft_kind: "follow_up";
}

export interface ThankYouNudgeRow {
  user_id: string;
  kind: "thank_you";
  subject_id: string;
  title: string;
  body: string;
  cta_view: "dashboard";
  draft_kind: "thank_you";
}

const STALE_STATUSES = new Set(["applied", "interviewing"]);

function daysSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 86_400_000;
}

/**
 * Pure, deterministic: given a user's job postings, returns one `follow_up`
 * nudge row per posting that has sat in `applied`/`interviewing` longer than
 * STALE_AFTER_DAYS with no movement. Re-running over the same input yields
 * the same rows (row-level idempotency is enforced by the DB's unique
 * `(user_id, kind, subject_id)` index via `ON CONFLICT DO NOTHING`).
 */
export function buildFollowUpNudges(
  postings: StalePostingCandidate[],
  now: Date,
): FollowUpNudgeRow[] {
  return postings
    .filter((p) => STALE_STATUSES.has(p.status))
    .filter((p) => daysSince(p.applied_at ?? p.updated_at, now) > STALE_AFTER_DAYS)
    .map((p) => {
      const days = Math.floor(daysSince(p.applied_at ?? p.updated_at, now));
      const company = p.company?.trim() || "this company";
      return {
        user_id: p.user_id,
        kind: "follow_up" as const,
        subject_id: p.id,
        title: `Follow up with ${company}?`,
        body: `Your application to ${company} for ${p.title} has been quiet for ${days} days — draft a follow-up?`,
        cta_view: "dashboard" as const,
        draft_kind: "follow_up" as const,
      };
    });
}

/**
 * Pure, deterministic: one `thank_you` nudge per posting that moved to
 * `interviewing` between THANK_YOU_MIN_DAYS and THANK_YOU_MAX_DAYS ago —
 * enough time for the interview to plausibly have happened, before the
 * moment has passed. Same idempotency guarantee as buildFollowUpNudges.
 */
export function buildThankYouNudges(
  postings: StalePostingCandidate[],
  now: Date,
): ThankYouNudgeRow[] {
  return postings
    .filter((p) => p.status === "interviewing" && p.interviewing_at)
    .filter((p) => {
      const days = daysSince(p.interviewing_at as string, now);
      return days >= THANK_YOU_MIN_DAYS && days <= THANK_YOU_MAX_DAYS;
    })
    .map((p) => {
      const company = p.company?.trim() || "this company";
      return {
        user_id: p.user_id,
        kind: "thank_you" as const,
        subject_id: p.id,
        title: `Send a thank-you to ${company}?`,
        body: `You interviewed for ${p.title} at ${company} — draft a thank-you note?`,
        cta_view: "dashboard" as const,
        draft_kind: "thank_you" as const,
      };
    });
}
