# F3 Slice A — Follow-up & Thank-you Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing stale-application nudge into a real AI-drafted follow-up email, add a new post-interview thank-you nudge, and let users snooze either — all reusing the existing Coach OS `coach_nudges` nightly-cron + Dashboard-card infrastructure.

**Architecture:** Two additive migrations (`job_postings.interviewing_at`, `coach_nudges.draft_kind`/`snoozed_until`), a second pure sequencing rule alongside the existing `buildFollowUpNudges`, a new FAST-tier free-text AI workflow, and a Dashboard modal that streams the draft on demand via the existing `streamWorkflow`/abort infrastructure. No draft text is ever persisted.

**Tech Stack:** Supabase (Postgres migrations, Deno edge function, pg_cron — already wired), React 19 + TypeScript, existing `src/ai/` workflow/client layer, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-09-f3-followup-agent-slice-a-design.md`

---

## Ground rules for this codebase (read before starting)

- `supabase/migrations/**` and `supabase/types.ts` are effectively human-managed: new schema changes are staged in `supabase/pending_migrations/` (see that directory's `README.md`); a human applies them and regenerates `supabase/types.ts` afterward. **Do not** write directly into `supabase/migrations/`.
- The Supabase client (`src/lib/supabaseClient.ts`) is created with `createClient()` — no `Database` generic — so there is no compile-time column checking on `.from(...).select()/.update()/.insert()` calls. New columns can be read/written immediately without waiting on generated types; just follow the existing `row.column_name as Type` cast convention used throughout `src/hooks/useJobPostings.ts` and `src/services/coachNudges.ts`.
- After every file edit, `npm run lint` (tsc, via the repo's `PostToolUse` hook) runs automatically — if a task's step doesn't mention running it explicitly, it still happens.
- Run `npx vitest run <file>` while iterating on a single test file instead of the full `npm test`.

---

## File Structure

| File | Change |
|---|---|
| `supabase/pending_migrations/20260709000000_add_job_postings_interviewing_at.sql` | new — `interviewing_at` column |
| `supabase/pending_migrations/20260709000001_add_coach_nudges_draft_columns.sql` | new — `draft_kind`, `snoozed_until` columns |
| `supabase/functions/_shared/followUpNudges.ts` | modify — add `draft_kind` to the follow-up rule, add `buildThankYouNudges` |
| `supabase/functions/_shared/followUpNudges.test.ts` | modify — assert `draft_kind`, add thank-you rule tests |
| `supabase/functions/generate-nudges/index.ts` | modify — select `interviewing_at`, union both rule outputs |
| `src/types/jobPosting.ts` | modify — add `interviewingAt?: string` |
| `src/hooks/useJobPostings.ts` | modify — map `interviewing_at` both directions |
| `src/components/JobPostingsWorkspace/DetailDrawer.tsx` | modify — stamp `interviewingAt` on first transition to `interviewing` |
| `src/components/JobPostingsWorkspace/index.tsx` | modify — same stamp in `PostingList`'s `onStatus` |
| `src/ai/workflows/followUpDraft.ts` | new — `follow_up_draft` FAST free-text workflow |
| `src/ai/workflows/followUpDraft.test.ts` | new — pure prompt-builder tests |
| `src/services/coachNudges.ts` | modify — `draftKind` field, exclude snoozed rows, `markNudgeDone`, `snoozeNudge` |
| `src/hooks/useCoachNudges.ts` | modify — expose `markDone`, `snooze` |
| `src/components/FollowUpDraftModal.tsx` | new — streams the draft, Copy/Snooze/Dismiss/Mark done |
| `src/components/Dashboard.tsx` | modify — open the modal for draft-kind nudges instead of navigating |

---

### Task 1: `job_postings.interviewing_at` migration

**Files:**
- Create: `supabase/pending_migrations/20260709000000_add_job_postings_interviewing_at.sql`

- [ ] **Step 1: Write the migration**

```sql
-- F3 Slice A: mirrors the existing `applied_at` pattern so the nightly nudge
-- generator can detect "interview happened ~1-2 days ago" for the thank-you
-- draft rule. See docs/superpowers/specs/2026-07-09-f3-followup-agent-slice-a-design.md §3.

alter table public.job_postings
  add column if not exists interviewing_at timestamptz;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/pending_migrations/20260709000000_add_job_postings_interviewing_at.sql
git commit -m "feat(db): stage job_postings.interviewing_at migration (F3 Slice A)"
```

---

### Task 2: `coach_nudges` draft columns migration

**Files:**
- Create: `supabase/pending_migrations/20260709000001_add_coach_nudges_draft_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- F3 Slice A: coach_nudges gains draftable-action support — draft_kind marks
-- a nudge as having a real AI-draftable action (vs. a plain reminder);
-- snoozed_until lets a user temporarily hide a nudge instead of dismissing it
-- forever. See docs/superpowers/specs/2026-07-09-f3-followup-agent-slice-a-design.md §3.

alter table public.coach_nudges
  add column if not exists draft_kind text
    check (draft_kind is null or draft_kind in ('follow_up', 'thank_you'));

alter table public.coach_nudges
  add column if not exists snoozed_until timestamptz;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/pending_migrations/20260709000001_add_coach_nudges_draft_columns.sql
git commit -m "feat(db): stage coach_nudges draft_kind + snoozed_until migration (F3 Slice A)"
```

---

### Task 3: Extend `followUpNudges.ts` with the thank-you rule (TDD)

**Files:**
- Modify: `supabase/functions/_shared/followUpNudges.ts`
- Test: `supabase/functions/_shared/followUpNudges.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `supabase/functions/_shared/followUpNudges.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import {
  buildFollowUpNudges,
  buildThankYouNudges,
  STALE_AFTER_DAYS,
  THANK_YOU_MIN_DAYS,
  THANK_YOU_MAX_DAYS,
  type StalePostingCandidate,
} from "./followUpNudges.ts";

const NOW = new Date("2026-07-08T00:00:00.000Z");

function posting(overrides: Partial<StalePostingCandidate>): StalePostingCandidate {
  return {
    id: "posting-1",
    user_id: "user-1",
    status: "applied",
    title: "Software Engineer",
    company: "Stripe",
    applied_at: null,
    interviewing_at: null,
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

describe("buildFollowUpNudges", () => {
  it("produces a follow_up nudge for a stale applied posting", () => {
    const rows = buildFollowUpNudges(
      [posting({ applied_at: daysAgo(STALE_AFTER_DAYS + 1) })],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: "user-1",
      kind: "follow_up",
      subject_id: "posting-1",
      cta_view: "dashboard",
      draft_kind: "follow_up",
    });
    expect(rows[0].title).toContain("Stripe");
    expect(rows[0].body).toContain("Software Engineer");
    expect(rows[0].body).toContain("Stripe");
  });

  it("includes stale interviewing postings", () => {
    const rows = buildFollowUpNudges(
      [posting({ status: "interviewing", applied_at: daysAgo(STALE_AFTER_DAYS + 5) })],
      NOW,
    );
    expect(rows).toHaveLength(1);
  });

  it("excludes postings not yet past the staleness threshold", () => {
    const rows = buildFollowUpNudges(
      [posting({ applied_at: daysAgo(STALE_AFTER_DAYS - 1) })],
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it("excludes postings in other statuses (saved, offer, rejected, ...)", () => {
    const rows = buildFollowUpNudges(
      [
        posting({ id: "a", status: "saved", applied_at: daysAgo(30) }),
        posting({ id: "b", status: "offer", applied_at: daysAgo(30) }),
        posting({ id: "c", status: "rejected", applied_at: daysAgo(30) }),
        posting({ id: "d", status: "suggested", applied_at: daysAgo(30) }),
      ],
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it("falls back to updated_at when applied_at is null", () => {
    const rows = buildFollowUpNudges(
      [posting({ applied_at: null, updated_at: daysAgo(STALE_AFTER_DAYS + 2) })],
      NOW,
    );
    expect(rows).toHaveLength(1);
  });

  it("falls back to a generic company label when company is missing", () => {
    const rows = buildFollowUpNudges(
      [posting({ company: null, applied_at: daysAgo(STALE_AFTER_DAYS + 1) })],
      NOW,
    );
    expect(rows[0].title).toBe("Follow up with this company?");
    expect(rows[0].body).toContain("this company");
  });

  it("is stable across repeated runs over the same input", () => {
    const input = [posting({ applied_at: daysAgo(STALE_AFTER_DAYS + 3) })];
    const first = buildFollowUpNudges(input, NOW);
    const second = buildFollowUpNudges(input, NOW);
    expect(second).toEqual(first);
  });

  it("returns no rows for an empty posting list", () => {
    expect(buildFollowUpNudges([], NOW)).toEqual([]);
  });
});

describe("buildThankYouNudges", () => {
  it("produces a thank_you nudge for an interview 1-2 days ago", () => {
    const rows = buildThankYouNudges(
      [
        posting({
          status: "interviewing",
          interviewing_at: daysAgo((THANK_YOU_MIN_DAYS + THANK_YOU_MAX_DAYS) / 2),
        }),
      ],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: "user-1",
      kind: "thank_you",
      subject_id: "posting-1",
      cta_view: "dashboard",
      draft_kind: "thank_you",
    });
    expect(rows[0].title).toContain("Stripe");
    expect(rows[0].body).toContain("Software Engineer");
  });

  it("excludes interviews less than THANK_YOU_MIN_DAYS ago", () => {
    const rows = buildThankYouNudges(
      [posting({ status: "interviewing", interviewing_at: daysAgo(THANK_YOU_MIN_DAYS - 0.5) })],
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it("excludes interviews more than THANK_YOU_MAX_DAYS ago", () => {
    const rows = buildThankYouNudges(
      [posting({ status: "interviewing", interviewing_at: daysAgo(THANK_YOU_MAX_DAYS + 1) })],
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it("excludes postings with no interviewing_at", () => {
    const rows = buildThankYouNudges(
      [posting({ status: "interviewing", interviewing_at: null })],
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it("excludes non-interviewing statuses even with an interviewing_at set", () => {
    const rows = buildThankYouNudges(
      [
        posting({
          status: "offer",
          interviewing_at: daysAgo((THANK_YOU_MIN_DAYS + THANK_YOU_MAX_DAYS) / 2),
        }),
      ],
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it("falls back to a generic company label when company is missing", () => {
    const rows = buildThankYouNudges(
      [
        posting({
          status: "interviewing",
          company: null,
          interviewing_at: daysAgo((THANK_YOU_MIN_DAYS + THANK_YOU_MAX_DAYS) / 2),
        }),
      ],
      NOW,
    );
    expect(rows[0].title).toBe("Send a thank-you to this company?");
  });

  it("returns no rows for an empty posting list", () => {
    expect(buildThankYouNudges([], NOW)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run supabase/functions/_shared/followUpNudges.test.ts`
Expected: FAIL — `buildThankYouNudges`, `THANK_YOU_MIN_DAYS`, `THANK_YOU_MAX_DAYS` are not exported yet, and the `draft_kind` assertion on the follow-up row fails.

- [ ] **Step 3: Implement**

Replace the full contents of `supabase/functions/_shared/followUpNudges.ts` with:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/followUpNudges.test.ts`
Expected: PASS (all tests in both `describe` blocks).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/followUpNudges.ts supabase/functions/_shared/followUpNudges.test.ts
git commit -m "feat(coach): add thank-you nudge rule alongside follow-up (F3 Slice A)"
```

---

### Task 4: Wire the thank-you rule into the `generate-nudges` cron

**Files:**
- Modify: `supabase/functions/generate-nudges/index.ts`

- [ ] **Step 1: Update the function**

In `supabase/functions/generate-nudges/index.ts`, change the import and the two spots that reference postings/rows:

```ts
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildFollowUpNudges,
  buildThankYouNudges,
  type StalePostingCandidate,
} from "../_shared/followUpNudges.ts";
```

Replace the `.select(...)` call:

```ts
  const { data: postings, error } = await admin
    .from("job_postings")
    .select("id, user_id, status, title, company, applied_at, interviewing_at, updated_at")
    .in("status", ["applied", "interviewing"]);
```

Replace the `rows` line:

```ts
  const candidates = (postings ?? []) as StalePostingCandidate[];
  const rows = [...buildFollowUpNudges(candidates, new Date()), ...buildThankYouNudges(candidates, new Date())];
```

Everything else in the file (the `upsert` call with `onConflict: "user_id,kind,subject_id"`, the response shape) is unchanged — the unique index already covers the new `kind: "thank_you"` rows since they use the same `(user_id, kind, subject_id)` triple with a distinct `kind` value.

- [ ] **Step 2: Sanity-check with the type checker**

Run: `npm run lint`
Expected: PASS (this file has no dedicated test — it's a thin Deno HTTP handler around the two pure functions already covered by Task 3's tests).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/generate-nudges/index.ts
git commit -m "feat(coach): generate-nudges also runs the thank-you rule (F3 Slice A)"
```

---

### Task 5: `interviewingAt` on the `JobPosting` type

**Files:**
- Modify: `src/types/jobPosting.ts`

- [ ] **Step 1: Add the field**

In `src/types/jobPosting.ts`, in the `JobPosting` interface, add `interviewingAt` right after `appliedAt`:

```ts
  appliedAt?: string;
  interviewingAt?: string;
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run lint`
Expected: PASS (an additional optional field doesn't break any existing usage).

- [ ] **Step 3: Commit**

```bash
git add src/types/jobPosting.ts
git commit -m "feat(coach): add interviewingAt to JobPosting type (F3 Slice A)"
```

---

### Task 6: Map `interviewing_at` in `useJobPostings.ts`

**Files:**
- Modify: `src/hooks/useJobPostings.ts:9-34` (`rowToPosting`), `src/hooks/useJobPostings.ts:37-62` (`postingToRow`)

- [ ] **Step 1: Update `rowToPosting`**

In `src/hooks/useJobPostings.ts`, add one line to `rowToPosting` right after the `appliedAt` line (line 29):

```ts
    appliedAt: (row.applied_at as string) ?? undefined,
    interviewingAt: (row.interviewing_at as string) ?? undefined,
```

- [ ] **Step 2: Update `postingToRow`**

Add one line to `postingToRow` right after the `applied_at` line (line 59):

```ts
  set("applied_at", p.appliedAt ?? null);
  set("interviewing_at", p.interviewingAt ?? null);
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useJobPostings.ts
git commit -m "feat(coach): read/write interviewing_at in useJobPostings (F3 Slice A)"
```

---

### Task 7: Stamp `interviewingAt` at both status-change call sites

**Files:**
- Modify: `src/components/JobPostingsWorkspace/DetailDrawer.tsx:421-430`
- Modify: `src/components/JobPostingsWorkspace/index.tsx:813-821`

- [ ] **Step 1: Update `DetailDrawer.tsx`**

Replace the `onChange` handler at `src/components/JobPostingsWorkspace/DetailDrawer.tsx:421-430`:

```tsx
                onChange={(e) => {
                  const s = e.target.value as JobStatus;
                  onUpdate({
                    status: s,
                    appliedAt:
                      s === "applied" && !posting.appliedAt
                        ? new Date().toISOString()
                        : posting.appliedAt,
                    interviewingAt:
                      s === "interviewing" && !posting.interviewingAt
                        ? new Date().toISOString()
                        : posting.interviewingAt,
                  });
                }}
```

- [ ] **Step 2: Update `index.tsx`**

Replace the `onStatus` callback at `src/components/JobPostingsWorkspace/index.tsx:813-821`:

```tsx
          onStatus={(posting, s) =>
            updatePosting(posting.id, {
              status: s,
              appliedAt:
                s === "applied" && !posting.appliedAt
                  ? new Date().toISOString()
                  : posting.appliedAt,
              interviewingAt:
                s === "interviewing" && !posting.interviewingAt
                  ? new Date().toISOString()
                  : posting.interviewingAt,
            })
          }
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Manual smoke check (dev server)**

Run `npm run dev` (and `npm run server` in a second process), open a saved job posting, change its status to "Interviewing", and confirm no console errors. (Deferred to the final verification pass if a dev server isn't already running — see Task 13.)

- [ ] **Step 5: Commit**

```bash
git add src/components/JobPostingsWorkspace/DetailDrawer.tsx src/components/JobPostingsWorkspace/index.tsx
git commit -m "feat(coach): stamp interviewingAt on first transition to interviewing (F3 Slice A)"
```

---

### Task 8: `followUpDraft` AI workflow (TDD)

**Files:**
- Create: `src/ai/workflows/followUpDraft.ts`
- Test: `src/ai/workflows/followUpDraft.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/ai/workflows/followUpDraft.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { followUpDraftWorkflow } from "@/ai/workflows/followUpDraft";

describe("followUpDraftWorkflow", () => {
  it("is a free-text FAST workflow with no output schema or search", () => {
    expect(followUpDraftWorkflow.id).toBe("follow_up_draft");
    expect(followUpDraftWorkflow.tier).toBe("FAST");
    expect(followUpDraftWorkflow.enableSearch).toBe(false);
    expect(followUpDraftWorkflow.outputSchema).toBeUndefined();
  });

  it("builds a follow-up system prompt for kind='follow_up'", () => {
    const sys = followUpDraftWorkflow.buildSystem({
      kind: "follow_up",
      jobTitle: "Software Engineer",
      company: "Acme",
      jobDescription: "",
      resumeText: "",
      baseline: "",
    });
    expect(sys).toContain("follow-up email");
    expect(sys).not.toContain("thank-you email");
  });

  it("builds a thank-you system prompt for kind='thank_you'", () => {
    const sys = followUpDraftWorkflow.buildSystem({
      kind: "thank_you",
      jobTitle: "Software Engineer",
      company: "Acme",
      jobDescription: "",
      resumeText: "",
      baseline: "",
    });
    expect(sys).toContain("thank-you email");
    expect(sys).not.toContain("follow-up email");
  });

  it("includes job title, company, description, resume, and baseline in the prompt", () => {
    const prompt = followUpDraftWorkflow.buildPrompt({
      kind: "follow_up",
      jobTitle: "Software Engineer",
      company: "Acme",
      jobDescription: "Build things.",
      resumeText: "Did stuff.",
      baseline: "Senior engineer.",
    }) as string;
    expect(prompt).toContain("Software Engineer");
    expect(prompt).toContain("Acme");
    expect(prompt).toContain("Build things.");
    expect(prompt).toContain("Did stuff.");
    expect(prompt).toContain("Senior engineer.");
  });

  it("falls back to placeholders when job description/resume are empty", () => {
    const prompt = followUpDraftWorkflow.buildPrompt({
      kind: "follow_up",
      jobTitle: "Software Engineer",
      company: "Acme",
      jobDescription: "",
      resumeText: "",
      baseline: "",
    }) as string;
    expect(prompt).toContain("(not provided)");
  });

  it("rejects an invalid kind", () => {
    const bad = followUpDraftWorkflow.inputSchema.safeParse({
      kind: "withdraw",
      jobTitle: "x",
      company: "y",
      jobDescription: "",
      resumeText: "",
      baseline: "",
    });
    expect(bad.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ai/workflows/followUpDraft.test.ts`
Expected: FAIL — cannot resolve `@/ai/workflows/followUpDraft`.

- [ ] **Step 3: Implement the workflow**

Create `src/ai/workflows/followUpDraft.ts`:

```ts
import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { basePersona } from "@/config/workflows";

/**
 * Draft a short follow-up or post-interview thank-you email for a tracked
 * job application. Free-text (no `outputSchema`) — `runWorkflow`/
 * `streamWorkflow` return the email body verbatim.
 */

const SHARED_RULES = `Never invent interviewer names, specific dates, or details not present in the context below — if a specific would help and you don't have it, leave a short [bracketed] placeholder (e.g. [interviewer name]). Return ONLY the email body text — no subject line, no markdown fences, no preamble.`;

const FOLLOW_UP_SYSTEM = `${basePersona}

Now draft a brief, professional follow-up email (roughly 80-150 words) checking in on a job application that has gone quiet. Structure: a short reiteration of genuine interest in the role, one sentence naming a specific differentiator from the candidate's background, and a polite close asking about next steps or timeline. Warm but not desperate — this is a light touch, not a plea. ${SHARED_RULES}`;

const THANK_YOU_SYSTEM = `${basePersona}

Now draft a brief, professional post-interview thank-you email (roughly 80-150 words). Structure: genuine thanks for the interviewer's time, one sentence referencing a specific topic or priority from the job description (you don't have an interview transcript, so reference the role's stated priorities rather than inventing what was "discussed"), and a closing line reaffirming enthusiasm and fit. ${SHARED_RULES}`;

export const followUpDraftWorkflow = defineWorkflow({
  id: "follow_up_draft",
  tier: "FAST",
  inputSchema: z.object({
    kind: z.enum(["follow_up", "thank_you"]),
    jobTitle: z.string(),
    company: z.string(),
    jobDescription: z.string(),
    resumeText: z.string(),
    baseline: z.string(),
  }),
  buildSystem: ({ kind }) => (kind === "thank_you" ? THANK_YOU_SYSTEM : FOLLOW_UP_SYSTEM),
  buildPrompt: ({ jobTitle, company, jobDescription, resumeText, baseline }) =>
    `JOB TITLE: ${jobTitle}
COMPANY: ${company}

JOB DESCRIPTION:
${jobDescription || "(not provided)"}

CANDIDATE RESUME:
${resumeText || "(not provided)"}

${baseline ? `CANDIDATE PROFILE:\n${baseline}\n` : ""}
Write the email per the rules.`,
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/ai/workflows/followUpDraft.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/workflows/followUpDraft.ts src/ai/workflows/followUpDraft.test.ts
git commit -m "feat(coach): add follow_up_draft AI workflow (F3 Slice A)"
```

---

### Task 9: Extend `coachNudges.ts` service (draftKind, markNudgeDone, snoozeNudge)

**Files:**
- Modify: `src/services/coachNudges.ts`

- [ ] **Step 1: Replace the file contents**

Replace the full contents of `src/services/coachNudges.ts` with:

```ts
import { supabase } from "@/lib/supabaseClient";

/**
 * Client-side store for Coach OS nudges (`coach_nudges`, Roadmap F1 Slice B;
 * draftKind/snooze added in F3 Slice A). Rows are server-generated only
 * (nightly `generate-nudges` cron, service-role insert) — the client reads,
 * dismisses, marks done, and snoozes. Fail-soft: reading/mutating must never
 * break the Dashboard render.
 */

export interface CoachNudge {
  id: string;
  kind: string;
  subjectId: string | null;
  title: string;
  body: string;
  ctaView: string | null;
  createdAt: string;
  /** Non-null when this nudge has a real AI-draftable action attached. */
  draftKind: "follow_up" | "thank_you" | null;
}

function rowToNudge(row: Record<string, unknown>): CoachNudge {
  return {
    id: row.id as string,
    kind: row.kind as string,
    subjectId: (row.subject_id as string) ?? null,
    title: row.title as string,
    body: row.body as string,
    ctaView: (row.cta_view as string) ?? null,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    draftKind: (row.draft_kind as CoachNudge["draftKind"]) ?? null,
  };
}

/**
 * Active, non-snoozed nudges for the current user, most recent first.
 * `[]` on error.
 */
export async function listActiveNudges(): Promise<CoachNudge[]> {
  const { data, error } = await supabase
    .from("coach_nudges")
    .select("id, kind, subject_id, title, body, cta_view, created_at, draft_kind")
    .eq("status", "active")
    .or(`snoozed_until.is.null,snoozed_until.lt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false });
  if (error || !data) {
    if (error) console.error("listActiveNudges failed:", error.message);
    return [];
  }
  return (data as Record<string, unknown>[]).map(rowToNudge);
}

/** Dismiss a nudge so it never resurfaces. Best-effort; errors are logged, not thrown. */
export async function dismissNudge(id: string): Promise<void> {
  const { error } = await supabase
    .from("coach_nudges")
    .update({ status: "dismissed" })
    .eq("id", id);
  if (error) console.error("dismissNudge failed:", error.message);
}

/** Mark a nudge as done (the user completed the action). Best-effort. */
export async function markNudgeDone(id: string): Promise<void> {
  const { error } = await supabase
    .from("coach_nudges")
    .update({ status: "done" })
    .eq("id", id);
  if (error) console.error("markNudgeDone failed:", error.message);
}

/** Hide a nudge for `days` days, after which it resurfaces (unless dismissed/done meanwhile). */
export async function snoozeNudge(id: string, days: number): Promise<void> {
  const snoozedUntil = new Date(Date.now() + days * 86_400_000).toISOString();
  const { error } = await supabase
    .from("coach_nudges")
    .update({ snoozed_until: snoozedUntil })
    .eq("id", id);
  if (error) console.error("snoozeNudge failed:", error.message);
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/services/coachNudges.ts
git commit -m "feat(coach): coachNudges service gains draftKind, markNudgeDone, snoozeNudge (F3 Slice A)"
```

---

### Task 10: Extend `useCoachNudges.ts` with `markDone`/`snooze`

**Files:**
- Modify: `src/hooks/useCoachNudges.ts`

- [ ] **Step 1: Replace the file contents**

Replace the full contents of `src/hooks/useCoachNudges.ts` with:

```ts
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  listActiveNudges,
  dismissNudge,
  markNudgeDone,
  snoozeNudge,
  type CoachNudge,
} from "@/services/coachNudges";

/** Active Coach OS nudges (`coach_nudges`) for the Dashboard, with optimistic mutations. */
export function useCoachNudges() {
  const { user } = useAuth();
  const [nudges, setNudges] = useState<CoachNudge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNudges([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listActiveNudges().then((rows) => {
      if (!cancelled) {
        setNudges(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dismiss = useCallback((id: string) => {
    setNudges((prev) => prev.filter((n) => n.id !== id));
    void dismissNudge(id);
  }, []);

  const markDone = useCallback((id: string) => {
    setNudges((prev) => prev.filter((n) => n.id !== id));
    void markNudgeDone(id);
  }, []);

  const snooze = useCallback((id: string, days: number) => {
    setNudges((prev) => prev.filter((n) => n.id !== id));
    void snoozeNudge(id, days);
  }, []);

  return { nudges, loading, dismiss, markDone, snooze };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCoachNudges.ts
git commit -m "feat(coach): useCoachNudges exposes markDone and snooze (F3 Slice A)"
```

---

### Task 11: `FollowUpDraftModal` component

**Files:**
- Create: `src/components/FollowUpDraftModal.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/FollowUpDraftModal.tsx`:

```tsx
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
    await navigator.clipboard.writeText(draft);
    toast("Copied to clipboard", "success");
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
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 16 }}>
          {posting.title} at {posting.company ?? "this company"}
        </div>

        {error ? (
          <div style={{ fontSize: 13, color: "#B3422F", marginBottom: 12 }}>{error}</div>
        ) : null}

        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
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
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/FollowUpDraftModal.tsx
git commit -m "feat(coach): add FollowUpDraftModal (F3 Slice A)"
```

---

### Task 12: Wire the modal into `Dashboard.tsx`

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Update imports**

In `src/components/Dashboard.tsx`, change the `JobPosting`/`JobStatus` type import (currently `import type { JobStatus } from "@/types/jobPosting";`) to:

```ts
import type { JobPosting, JobStatus } from "@/types/jobPosting";
```

Add these new imports near the other hook/service imports (after the `useCoachNudges` import):

```ts
import { downloadResume } from "@/services/resumeStorageService";
import { buildProfileBaseline } from "@/lib/careerBaseline";
import { FollowUpDraftModal } from "@/components/FollowUpDraftModal";
import type { CoachNudge } from "@/services/coachNudges";
```

- [ ] **Step 2: Update the `useCoachNudges` destructure**

Change line 131 from:

```ts
  const { nudges, dismiss: dismissNudge } = useCoachNudges();
```

to:

```ts
  const { nudges, dismiss: dismissNudge, markDone: markNudgeDone, snooze: snoozeNudge } =
    useCoachNudges();
```

- [ ] **Step 3: Add modal state and the open handler**

Immediately after the `useCoachNudges` destructure from Step 2, add:

```ts
  const [draftModal, setDraftModal] = useState<{
    nudge: CoachNudge;
    posting: JobPosting;
    resumeText: string;
  } | null>(null);

  const openDraftNudge = async (nudge: CoachNudge) => {
    const posting = allPostings.find((p) => p.id === nudge.subjectId);
    if (!posting) return;
    const resume = profile.savedResumes?.find((r) => r.id === posting.appliedResumeId);
    let resumeText = resume?.text ?? "";
    if (!resumeText && resume?.storagePath) {
      try {
        resumeText = await downloadResume(resume.storagePath);
      } catch {
        resumeText = "";
      }
    }
    setDraftModal({ nudge, posting, resumeText });
  };
```

(`allPostings` and `profile` are already destructured earlier in the component from `useJobPostings()`/`useUserProfile()` — see lines 126 and 132.)

- [ ] **Step 4: Branch the nudge card's click handler**

Replace the nudge card's inner button `onClick` (currently `onClick={() => go((nudge.ctaView as ViewId) ?? "job_postings")}`) with:

```tsx
              onClick={() =>
                nudge.draftKind ? openDraftNudge(nudge) : go((nudge.ctaView as ViewId) ?? "job_postings")
              }
```

- [ ] **Step 5: Render the modal**

The `Dashboard` component's `return (...)` is a single root `<div>` (no top-level Fragment) that closes at `src/components/Dashboard.tsx:1399` (`</div>`), right after the "Add to pipeline" form's conditional block closes on the line above (`)}` at line 1398). Since the modal is `position: fixed` (`className="fixed inset-0 z-50 ..."`), it renders as a full-viewport overlay regardless of where it sits in the tree, so no Fragment wrapper is needed — just add it as the last child before that closing `</div>`. Change:

```tsx
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

to:

```tsx
            </form>
          </div>
        </div>
      )}
      {draftModal && (
        <FollowUpDraftModal
          draftKind={draftModal.nudge.draftKind as "follow_up" | "thank_you"}
          posting={draftModal.posting}
          resumeText={draftModal.resumeText}
          baseline={buildProfileBaseline(profile)}
          onClose={() => setDraftModal(null)}
          onMarkDone={() => {
            markNudgeDone(draftModal.nudge.id);
            setDraftModal(null);
          }}
          onSnooze={() => {
            snoozeNudge(draftModal.nudge.id, 3);
            setDraftModal(null);
          }}
          onDismiss={() => {
            dismissNudge(draftModal.nudge.id);
            setDraftModal(null);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verify typecheck**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS (no existing Dashboard tests exercise this path — no jsdom/RTL in this repo, consistent with the codebase convention of leaving React wiring untested and covering pure logic instead).

- [ ] **Step 8: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat(coach): open FollowUpDraftModal from draftable Dashboard nudges (F3 Slice A)"
```

---

### Task 13: Full gauntlet + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full gauntlet**

```bash
npm run lint
npm test
npm run build
```

Expected: all three pass.

- [ ] **Step 2: Manual smoke test in the browser preview**

Start both processes (`npm run dev` on :3000, `npm run server` on :4000), log in with a test account, and:
1. In `job_postings`, manually set a saved posting's `status` to `interviewing` via the Detail Drawer dropdown; confirm no console errors and (via Supabase dashboard or a quick `select`) that `interviewing_at` got stamped.
2. If a `coach_nudges` row with a non-null `draft_kind` exists for the current user (may require manually inserting a test row via SQL, since the nightly cron won't have fired yet in dev), click it on the Dashboard and confirm the modal opens and streams a draft, the Stop button appears while streaming, and Copy/Snooze/Dismiss/Mark done all remove the nudge from the list without a page reload.

Document any gaps found (e.g. no logged-in test account, gateway not running) rather than skipping — this mirrors how the F2 PR (#101) documented its own unverified gap.

- [ ] **Step 3: Remind the user about pending migrations**

Tell the user: the two new migrations are staged in `supabase/pending_migrations/` and need to be applied (`supabase db push` or pasted into the SQL editor) and `supabase/types.ts` regenerated (`supabase gen types typescript --linked > supabase/types.ts`) before this ships to production — per this repo's established convention (see `supabase/pending_migrations/README.md`).

---

## Self-review notes

- **Spec coverage:** §3 (schema) → Tasks 1, 2, 5, 6. §5 (sequencing) → Tasks 3, 4. §6 (workflow) → Task 8. §7 (UI: streamed draft, stop button, Copy/Mark done/Snooze/Dismiss, no mailto) → Tasks 9-12. §8 (error handling) → Task 11's `error` state. All spec sections have a task.
- **Type consistency checked:** `draftKind: "follow_up" | "thank_you" | null` (Task 9's `CoachNudge`) narrows to `"follow_up" | "thank_you"` via the `nudge.draftKind ? ... : ...` guard before reaching `FollowUpDraftModal`'s required `draftKind` prop (Task 12 Step 4/5) — consistent with Task 11's prop type. `followUpDraftWorkflow`'s `kind` field (Task 8) matches `FollowUpDraftModal`'s `draftKind` prop name difference intentionally: the workflow input field is called `kind` (matching its own domain), the modal prop is called `draftKind` (matching the nudge's field) — Task 12 Step 5 passes `draftModal.nudge.draftKind as "follow_up" | "thank_you"` into the modal's `draftKind` prop, and the modal internally passes its own `draftKind` prop value as the workflow's `kind` input (Task 11's `streamWorkflow` call: `kind: draftKind`). Verified no naming collision causes a mismatch.
- **No placeholders:** every step above has concrete, complete code — nothing deferred to "add validation" or "similar to Task N".
