# Auto Job Recommendations from Profile — Design

**Date:** 2026-07-11
**Status:** Approved

## Goal

Once a user has **employment history** (`profile.workHistory`) or a **resume-derived target role** in their profile, the **Job Postings** feature should automatically start recommending matching postings — no manual "set up job alerts" step required. Concretely: `profile.targetRoles` (the structured list that drives both the client-side fit scorer and the weekly suggestion cron) gets **auto-derived** from `workHistory` / `targetRole` whenever it's empty, so the existing "Suggested this week" lane and match-scoring pipeline just start working.

## Why (problem with the current approach)

The matching machinery already exists and works well once configured:
- [`src/services/jobRecommendation.ts`](../../../src/services/jobRecommendation.ts) deterministically scores every posting 0–100 against a profile (skills, role-title, experience, work-history overlap) — zero API cost, runs on every posting.
- [`supabase/functions/refresh-suggestions/index.ts`](../../../supabase/functions/refresh-suggestions/index.ts) is a weekly `pg_cron` job that scans ATS boards + web aggregators for each user's `target_roles` and writes `job_postings` rows with `status='suggested'`.

But both are gated on `profile.targetRoles: TargetRole[]` being non-empty, and **nothing populates that array automatically**. Resume import ([`src/ai/workflows/profileExtraction.ts`](../../../src/ai/workflows/profileExtraction.ts)) only extracts a singular `profile.targetRole` string; `target_roles` stays `[]` until a user manually visits Profile Settings' "job alerts" section and clicks Save. [`ProfileSettings.tsx:215-220`](../../../src/components/ProfileSettings.tsx#L215-L220) already has a *local, one-off* seed-from-`targetRole` trick, but it only runs in React state when that page mounts, and only from `targetRole` — never from `workHistory` — and never persists until the user explicitly saves that page.

Net effect: a user who uploads a resume (or fills in work history during onboarding) and never visits Profile Settings' job-alerts section sees an empty "Set up job alerts" prompt in Job Postings forever, even though the profile has everything needed to generate matches. This also affects **existing** users whose profiles already have `workHistory`/`targetRole` but empty `target_roles` — the cron silently skips them today.

## Design

### 1. `src/lib/targetRoleDerivation.ts` (new) — shared derivation logic

```ts
export const MAX_AUTO_TARGET_ROLES = 3;

export function deriveTargetRoles(profile: UserProfile): TargetRole[]
```

Pure, deterministic, framework-agnostic function (no I/O). Builds up to `MAX_AUTO_TARGET_ROLES` `TargetRole` entries from, in priority order:
1. `profile.targetRole` (resume-derived singular field), if set.
2. `workHistory` entries marked `current: true` first, then the rest in existing array order (most-recent-first, per `normalizeWorkHistory`), taking distinct `role` titles.

Titles are deduped case-insensitively/whitespace-normalized (reuse the existing `tokenize`-style normalization approach from `jobRecommendation.ts` — extract a small shared `normalizeTitle(title: string): string` helper if convenient, or duplicate the one-liner; not worth a bigger refactor). Each derived role gets `{ id: generateId(), title }` — no `keywords`/`exclude`/`location` (left for the user to refine manually later in Profile Settings, same as today's manual flow). Returns `[]` when the profile has neither signal — callers must treat that as "nothing to derive," not an error.

This function is the **single source of truth** for "what target roles should we infer from this profile" — both the client save-path and `ProfileSettings.tsx`'s local seeding reuse it (see #3).

### 2. `src/lib/profileMapper.ts` — auto-fill on every save

In `profileToRow(profile, userId)`: if the incoming `profile.targetRoles` is empty/undefined, call `deriveTargetRoles(profile)` and use that for the `target_roles` column instead of `[]`. If the caller already supplied any `targetRoles` (including a deliberately-emptied array from a manual edit), leave it untouched — we only fill the gap, never override.

Since `UserProfileContext.tsx`'s `updateProfile()` always merges into the full profile object and calls `profileToRow` before every upsert ([`UserProfileContext.tsx:54-61`](../../../src/context/UserProfileContext.tsx#L54-L61)), this one change covers every write path: resume import, onboarding, and manual Profile Settings edits alike — with no changes needed at each call site.

Accepted tradeoff (documented, not solved): because there's no separate "user intentionally cleared their alerts" flag, a user who empties `target_roles` on purpose while resume/work-history data still exists will see it silently re-derived on their next profile save. This matches the pre-existing behavior of `ProfileSettings.tsx`'s own seed logic today, so it's not a regression — just now it also applies outside that one page. Out of scope to add an opt-out flag for this iteration.

### 3. `src/components/ProfileSettings.tsx` — dedupe seeding logic

Replace the inline seed at lines 215-220 (`profile.targetRole?.trim() ? [{ id: generateId(), title: ... }] : []`) with a call to `deriveTargetRoles(profile)`. This is a strict improvement: it now also seeds from `workHistory` when `targetRole` is blank, matching #1/#2 exactly, and removes the duplicate logic.

### 4. `supabase/functions/refresh-suggestions/index.ts` — backfill for existing profiles

Existing users may already have `workHistory`/`targetRole` with `target_roles` still `[]` (they haven't saved their profile since this ships). Since the cron is the only server-side process touching every profile weekly, add a fallback right where it currently does `if (roles.length === 0) continue;` (line 65):

- When `roles.length === 0`, check `work_history` / `target_role` on the row. If either has signal, derive a small role list inline (a minimal, self-contained Deno mirror of #1's priority order — this repo's Edge Functions don't import from `src/`, consistent with the existing `scan-jobs`/`job-search` functions being self-contained; keep it to ~15 lines, not full parity with synonym expansion).
- If roles were derived, persist them back via `admin.from("profiles").update({ target_roles: derived }).eq("id", p.id)` **before** running discovery for that user, then proceed with the normal flow using the derived roles. This makes it a one-time backfill per user — subsequent weekly runs read the already-populated column and never hit this branch again for them.
- If neither `workHistory` nor `targetRole` has signal, `continue` as today (nothing to derive, nothing to do).

No migration needed — `target_roles jsonb` already exists on `profiles` ([`20260610000000_add_job_targets.sql`](../../../supabase/migrations/20260610000000_add_job_targets.sql)).

### 5. `src/components/JobPostingsWorkspace/index.tsx` — empty-state gap

The existing "Set up job alerts" prompt (lines 746-795, gated on `profile.targetRoles?.length === 0`) will now only show for genuinely empty profiles — correct, no change needed there.

New gap to cover: once `target_roles` auto-populates (client save) but the weekly cron hasn't run yet, `suggested.length === 0 && targetRoles.length > 0` renders nothing between the "Featured opportunities" lane and the full posting list — a silent dead zone where a user might think the feature is broken. Add a lightweight state for this case: reuse the existing `cardStyle` prompt pattern with a message like "We're setting up your matches — check back Monday for fresh picks based on your profile," no action button needed (target roles are already set).

## Testing

- **`src/lib/targetRoleDerivation.test.ts` (new, vitest):**
  - Empty profile (no `targetRole`, no `workHistory`) → `[]`.
  - `targetRole` only → single role, correct title.
  - `workHistory` only (mix of `current: true` and past entries) → current role first, capped at `MAX_AUTO_TARGET_ROLES`, correct dedupe when two entries share a normalized title.
  - `targetRole` + overlapping `workHistory[0].role` (same title, different case/whitespace) → deduped to one entry, not two.
  - Verify no throw / sane output for malformed `workHistory` entries (empty `role` string).
- **`src/lib/profileMapper.test.ts` (extend existing file):**
  - `profileToRow` with empty `targetRoles` + non-empty `workHistory` → `target_roles` column populated via derivation.
  - `profileToRow` with existing non-empty `targetRoles` → passed through unchanged (derivation not invoked / doesn't override).
  - `profileToRow` with neither signal → `target_roles: []`, unchanged from today.
- **`ProfileSettings.tsx` seeding:** covered indirectly by #1's unit tests since it now calls the same pure function; no new component test needed given the existing codebase doesn't unit-test this component's render tree.
- **`refresh-suggestions` Edge Function:** no automated test, consistent with the existing convention for this file (and its siblings `scan-jobs`/`job-search`) — none of them have test coverage today. Verify manually via a local Supabase function invocation with a seeded profile row (`work_history` set, `target_roles: []`) and confirm the row gets backfilled and suggestions are generated in the same run.

## Out of scope

- An explicit "pause/opt-out of auto alerts" flag on `profiles` — the accepted-tradeoff behavior in #2 covers this iteration; revisit if users report unwanted role churn.
- On-demand/immediate suggestion refresh right after resume import (still waits for the next Monday cron run) — a "refresh now" button is a separate, addable enhancement.
- Improving the derived roles with AI-based normalization/synonym expansion (e.g. reusing `expandRoleTokens`) beyond simple case/whitespace dedupe — the derived `TargetRole.title` stays literal, matching how `scan-jobs`/`job-search` already consume plain title strings today.
- Any change to `scoreJobFit`/`buildDefaultQuery` in `jobRecommendation.ts` — those already read `workHistory`/`targetRole` directly and don't depend on `target_roles` being populated; this spec only closes the gap for the **cron-driven "Suggested this week"** lane.
