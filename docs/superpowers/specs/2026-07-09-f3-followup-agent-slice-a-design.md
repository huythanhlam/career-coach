# F3 Slice A — Follow-up & thank-you agent

**Date:** 2026-07-09
**Status:** Approved
**Roadmap:** `docs/rebuild/ROADMAP.md` F3 (P0 · L · R2), lines 90–105 — this spec covers the drafting-agent half only. Response-rate analytics per resume variant is deliberately deferred to **Slice B** (independent: reads existing data, no new schema, no cron).

## 1. Problem

`application_packages`/`job_postings` tracking is manual bookkeeping. Once a package is generated and marked applied, the product goes silent — no reminder to follow up, no help drafting a thank-you after an interview. The existing Coach OS nudge system (`coach_nudges`, F1 Slice B) already surfaces a plain-text "this application has gone quiet" reminder, but it doesn't draft anything; the user still writes the follow-up from scratch.

## 2. Scope

**In scope (Slice A):**
- Upgrade the existing stale-`applied` nudge into a real, on-demand AI-drafted follow-up email.
- Add a new post-interview thank-you nudge + draft.
- Snooze support on nudges (server-side, persists across devices).

**Explicitly deferred:**
- Withdraw-application suggestions and interview-prep CTA links (other roadmap-described nudge kinds) — later slice.
- Response-rate analytics per resume variant (Slice B).
- A general `application_events` audit-log table — not needed by anything in this slice (see §4).
- Auto-sending anything. The product never sends on the user's behalf (roadmap §6, standing product stance) — every draft ends at copy-to-clipboard.

## 3. Data model

### `job_postings` (new migration, extends `20260610000001_add_job_postings.sql`)
Add one column, mirroring the existing `applied_at` pattern exactly:

```sql
alter table public.job_postings add column if not exists interviewing_at timestamptz;
```

Stamped client-side at the same two call sites that already stamp `applied_at` on first transition to `'applied'`:
- `src/components/JobPostingsWorkspace/DetailDrawer.tsx` (status `<select>` `onChange`)
- `src/components/JobPostingsWorkspace/index.tsx` (`PostingList`'s `onStatus` callback)

Both add a parallel `status === "interviewing" && !posting.interviewingAt ? { interviewingAt: new Date().toISOString() } : {}` alongside the existing `appliedAt` stamp. `src/types/jobPosting.ts` and `postingToRow`/`rowToPosting` mappers gain the new field.

### `coach_nudges` (new migration, extends `20260707000002_add_coach_nudges.sql`)

```sql
alter table public.coach_nudges add column if not exists draft_kind text
  check (draft_kind is null or draft_kind in ('follow_up', 'thank_you'));
alter table public.coach_nudges add column if not exists snoozed_until timestamptz;
```

- `draft_kind` is null for plain reminders (forward-compatible with non-draft nudge kinds already in the table), `'follow_up'` or `'thank_you'` for the two new draftable kinds this slice adds.
- No `draft_content` column — draft text is generated fresh client-side each time the user opens the panel, never persisted. Simpler (no staleness/edit-conflict handling for stored drafts) and avoids storing AI-drafted personal correspondence at rest.
- No RLS changes needed — existing `coach_nudges` policies (plain owner-only, `20260707000002`) already cover `select`/`update` on the new columns.

## 4. Why no `application_events` table

The original roadmap text names a general append-only `application_events` log. Investigation showed nothing in this slice actually needs it:
- The follow-up rule only needs `job_postings.status` + `applied_at` (both already exist).
- The thank-you rule only needs a single `interviewing_at` timestamp (added above).
- Slice B's response-rate analytics reads `job_postings.status` + `applied_resume_id` (both already exist) — no event history needed either.

Building a general event log now would be speculative — nothing in the current roadmap consumes per-transition history (e.g. multiple interview rounds, time-in-stage funnels). Revisit only if a future slice has a concrete need for it.

## 5. Sequencing engine (nightly cron)

Extends the existing nightly `generate-nudges` edge function and its pure helper `supabase/functions/_shared/followUpNudges.ts` (`buildFollowUpNudges`) — same cron schedule (`20260707000003_generate_nudges_cron.sql`, `'0 9 * * *'`), same idempotent `upsert ... on conflict (user_id, kind, subject_id) do nothing` pattern.

Two rules, both pure/deterministic (no AI call in the cron — drafting is on-demand, see §6):

- **Follow-up** (existing rule, unchanged trigger): `status = 'applied'` and `applied_at` older than `STALE_AFTER_DAYS` (currently 10; the roadmap's example AC uses 7 — this is a config constant, not re-litigated here). Now upserts with `draft_kind: 'follow_up'` instead of a plain reminder, same `kind: 'follow_up'` value on the row (only `draft_kind` is new).
- **Thank-you** (new rule): `status = 'interviewing'` and `interviewing_at` is between 1 and 2 days in the past. Tight window deliberately — thank-you notes are time-sensitive, unlike follow-ups, so this doesn't use the same 10-day staleness constant. Upserts `kind: 'thank_you'`, `draft_kind: 'thank_you'`.
- Snoozed nudges are excluded from the Dashboard's active-nudges query (`snoozed_until is null or snoozed_until < now()`) rather than touched by the cron — snoozing is a read-side filter, dismissal (existing `status = 'dismissed'`) is what the idempotent upsert respects.

## 6. Draft workflow

New `src/ai/workflows/followUpDraft.ts`, following the `coverLetter.ts` free-text convention (no `outputSchema` — `runWorkflow`/`streamWorkflow` return prose verbatim):

```ts
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
  buildSystem: ({ kind }) => kind === "thank_you" ? THANK_YOU_SYSTEM : FOLLOW_UP_SYSTEM,
  buildPrompt: ({ jobTitle, company, jobDescription, resumeText, baseline }) =>
    `JOB TITLE: ${jobTitle}\nCOMPANY: ${company}\n\nJOB DESCRIPTION:\n${jobDescription || "(not provided)"}\n\nCANDIDATE RESUME:\n${resumeText}\n\n${baseline ? `CANDIDATE PROFILE:\n${baseline}\n` : ""}`,
});
```

`FOLLOW_UP_SYSTEM`/`THANK_YOU_SYSTEM` are two constant system-prompt strings (tone rules described below), matching the `COVER_LETTER_SYSTEM` constant pattern in `coverLetter.ts` — `buildPrompt` itself is identical in shape between the two kinds (same job/resume/profile context), only the system prompt's instructions differ.

- `tier: "FAST"` (not `QUALITY` like the cover letter) — a 3-5 sentence email, lower stakes, cost-sensitive since it's generated on every open (no caching/storage, see §3).
- System prompt branches by `kind`: `follow_up` = brief reiteration of interest + one differentiator, closes asking about next steps; `thank_you` = references a specific detail from the interview context available (role/company/JD), reaffirms fit, closes warmly. Both inherit the cover letter workflow's anti-hallucination rule: never invent names/specifics not in context — use a short `[bracketed]` placeholder (e.g. `[interviewer name]`) instead.
- Input assembly (`jobDescription`, `resumeText`, `baseline`) reuses the same data already fetched for `applicationAutopilot.ts`'s cover-letter generation — no new data-fetching path.

## 7. UI

Clicking a nudge with a non-null `draft_kind` opens a modal (instead of navigating to `ctaView`, which is what plain nudges still do) — new component, e.g. `src/components/Dashboard/FollowUpDraftModal.tsx`:

- On open, immediately calls `streamWorkflow(followUpDraftWorkflow, {...}, { onToken, signal })`, rendering the growing text into an editable `<textarea>` — user can freely edit before copying.
- Reuses the F2 streaming infra: the shared `stop-generating-button` component + `AbortController` wired to the same `signal`, so the user can stop mid-stream.
- Footer actions:
  - **Copy to clipboard** — primary action, no `mailto:` prefill (job postings have no reliable contact email; consistent with "drafts only, human sends," roadmap §6).
  - **Mark done** — sets nudge `status: 'done'`.
  - **Snooze 3 days** — sets `snoozed_until = now() + interval '3 days'`, closes the modal, nudge disappears from the active list until then.
  - **Dismiss** — existing behavior (permanent, via the unique-index/`ON CONFLICT DO NOTHING` idempotency), also closes the modal.
- Dashboard's nudge-list query gains the `snoozed_until` filter; `useCoachNudges.ts` gains `snoozeNudge(id, days)` alongside the existing `dismissNudge`.

## 8. Error handling

- Draft generation failure (network/gateway error) → the modal shows an inline retriable error state (same pattern as other streaming surfaces post-F2), never a silent hang.
- If `jobDescription`/`resumeText` context is missing or empty for a given posting (e.g. user never uploaded a resume), the workflow still runs — the anti-hallucination system prompt rule naturally produces a shorter, more placeholder-heavy draft rather than erroring.

## 9. Testing

- Unit: `buildFollowUpNudges`'s two rules (follow-up unchanged behavior + new thank-you window), pure and already-covered-by-pattern (existing tests in `supabase/functions/_shared/followUpNudges.test.ts` or equivalent — extend, don't rewrite).
- Unit: `followUpDraftWorkflow`'s prompt-building functions (pure, like other workflow tests in `src/ai/workflows/*.test.ts`).
- Manual/E2E smoke: open a draft-kind nudge, confirm streaming renders progressively (≥3 paint updates, consistent with the F2 acceptance criterion), confirm Copy/Mark done/Snooze/Dismiss each mutate `coach_nudges` correctly and the Dashboard list reflects it without reload.

## 10. Acceptance criteria (mapped from roadmap F3, Slice A subset)

- [ ] Given an application marked applied 7+ days ago with no status change, a drafted follow-up is one click away from the Dashboard nudge card, personalized from that package's JD + resume.
- [ ] Given a posting's status becomes `interviewing`, a thank-you draft nudge appears 1-2 days later (not immediately — the interview needs time to actually happen).
- [ ] No email is ever sent by the system — copy-to-clipboard only, stated in the UI.
- [ ] Snoozing or dismissing a nudge persists server-side and is reflected across devices/reloads.
- [ ] RLS: user A can never see or act on user B's nudges (already covered by existing `coach_nudges` policies — regression-tested, not newly introduced).
