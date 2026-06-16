# Product Differentiators: Making TechCoach AI the App Users Keep

**Date:** June 2026
**Status:** Strategy / roadmap proposal

## The retention problem

TechCoach AI already has real moats that competitors lack:

- **Privacy-first architecture** — all AI calls proxied through our own gateway; user documents never leave our infrastructure for a third-party SaaS.
- **Deterministic, sourced data** — company profiles built from SEC filings, Blind, and Wikipedia with citations; salary bands grounded in U.S. BLS OEWS percentiles. Competitors show LLM guesses; we show provenance.
- **End-to-end integration** — resume, LinkedIn, interviews, salary negotiation, company research, and a job pipeline in one workspace instead of five subscriptions.

Those moats answer *"why try this app?"* They do not answer *"why open it again on Tuesday?"* Today nearly every workflow is **one-shot**: the user generates a resume, a plan, or a negotiation script, takes the artifact, and has no structural reason to return. That is exactly where competitors win — Teal's daily tracker habit, Final Round AI's practice loops, LinkedIn's feed.

The differentiators below are all **retention loops**. They are ordered by impact-per-effort, and a key finding from the codebase audit is that the top items are already 50–90% built — the strategy doubles as a list of cheap wins.

## Three retention pillars

1. **The app works while you're away** — something new is waiting every time you open it (#1).
2. **Every artifact compounds** — each application, tailored resume, score, and milestone increases switching cost (#2, #3, #5, #6).
3. **The coach knows you** — a coach with memory is a relationship, not a tool; no point-solution competitor can copy it without our data plumbing (#4).

---

## 1. Proactive weekly job matches — "the app found these for you"

**Effort: SMALL · Pillar: works while you're away**

Every Monday, the app surfaces fresh postings scraped from the user's *target companies'* ATS boards (Greenhouse, Lever, Ashby, Workable, SmartRecruiters), pre-scored against their coached profile with explainable fit factors. Dashboard shows "12 new matches this week."

**Why it beats competitors:** LinkedIn job alerts are keyword matches against a thin profile. Our matches are scored deterministically (`scoreJobFit()`) against the user's full work history, skills, and target roles — and they come from company career pages directly, including postings that never hit aggregators.

**What already exists:** the *entire server pipeline*. `supabase/migrations/20260610000002_suggested_postings_cron.sql` schedules a weekly pg_cron job hitting the `refresh-suggestions` Edge Function, which scans ATS feeds per user, dedupes, scores, and writes `status='suggested'` rows that `useJobPostings` already handles.

**The gap (and the unlock):** no UI anywhere writes `profiles.target_roles` or `target_companies` — `ProfileSettings.tsx` only edits a free-text string — so the cron currently serves **zero users**. The fix is roughly one day:

- A "Job alerts" editor in `ProfileSettings.tsx` for target roles + followed companies (the `TargetRole`/`TargetCompany` types and `detectAtsFromUrl()` helper in `src/services/jobScanService.ts` are already written).
- A "Suggested this week" lane at the top of `JobPostingsWorkspace.tsx` with save/dismiss.
- A Dashboard card with the new-match count, deep-linking to the lane.

**Later:** email digest (~50 lines in `refresh-suggestions` + a Resend key) and company-watchlist news refresh riding the existing `company_profiles` pipeline.

---

## 2. One-click resume tailoring from a job posting

**Effort: SMALL · Pillar: artifacts compound**

From any posting in the pipeline: one click opens the tailoring workspace pre-filled with that job, produces structured suggestions (rewrite / add keyword / strengthen, with before→after and rationale), and saves the result as a variant attached to that application.

**Why it beats competitors:** this is Teal's and Kickresume's flagship *paid* feature — but theirs is detached from a coaching context. Ours ties the variant to the tracked application (`applied_resume_id` already exists on `job_postings`), which later powers attribution analytics (#3): "tailored applications convert 2.4× better."

**What already exists:** `src/components/TailorResumeWorkspace.tsx` is complete and polished — suggestion sidebar, apply/dismiss/undo into `DocumentEditor`, save-as-variant. It's just buried inside the Resume Builder and unreachable from the job board. `JobPostingsWorkspace` meanwhile has an inferior parallel path (raw textarea dump, saved with a broken empty `storagePath` so variants can't be reopened).

**The gap:** add an `initialJobDetails` prop to `TailorResumeWorkspace`, launch it from the posting detail drawer, write the saved variant id back to the posting, and delete the textarea path (fixing the `storagePath: ""` bug while there). 1–2 days.

**Retention loop:** every job the user finds — a recurring weekly event — becomes a 2-minute product session that leaves an artifact in the app.

---

## 3. Application pipeline intelligence

**Effort: SMALL–MEDIUM · Pillar: artifacts compound**

Turn the tracker from a passive table into the user's daily home screen:

- **Funnel analytics:** applied→interview rate, interview→offer rate, median days-in-stage — all derivable client-side from `applied_at`/`created_at`/`updated_at` already in `useJobPostings` state.
- **Stale-application nudges:** "3 applications need a follow-up" (applied >10 days, no status change), with a one-click AI-drafted follow-up email reusing the existing `generateWorkflowData` cover-letter pattern.
- **Outcome attribution:** because tailored resumes link to applications (#2), we can show "your tailored applications get replies 2.4× more often" — closing the loop between features.

**Why it beats competitors:** Teal's tracker is the benchmark, but it's bookkeeping. Outcome analytics plus AI follow-up drafts make ours *advise*, not just record. Job seekers check their pipeline obsessively; give them numbers that change daily and the dashboard becomes a habit.

**Implementation:** a `pipelineStats.ts` lib + Dashboard stats row + nudge card; no migration needed for v1. While in this area, ship the missing `saved_analyses` migration — `src/hooks/useSavedAnalyses.ts` reads/writes a table no migration creates, so Strategy Engine saves silently fail on fresh environments.

---

## 4. A coach that remembers you

**Effort: SMALL (tier 1) → LARGE (tier 3) · Pillar: the coach knows you**

The compounding moat. A coach that opens with "Last time we talked about your Stripe interview — how did the system-design round go?" is a relationship; every other feature (scores, pipeline, plans, interview history) feeds its memory, and a competitor can't copy it without the same integrated data.

**Today it's near-broken:** `createTechCoachChat` (`src/services/geminiService.ts:618`) sends only the latest message — the global Coach forgets turn 1 by turn 2 — and injects no user context at all (the avatar is even hardcoded "HL"). Meanwhile `createCoachingChat` (same file) does correct history replay and is used only by Goal Planning.

**Tiered build:**

- **Tier 1 (~half a day, transformative):** switch `GlobalChatPanel` to `createCoachingChat` and prepend a context block from the existing `buildProfileBaseline(profile)` (`src/services/careerBaseline.ts`) plus a pipeline summary and latest scores.
- **Tier 2 (medium):** persist conversations (reuse the storage-payload pattern from saved career plans) and resume the last session on open.
- **Tier 3 (large):** a rolling per-user memory document, refreshed after each session by a cheap model pass, injected into every workflow's system prompt.

---

## 5. A living career plan with milestone check-ins

**Effort: MEDIUM · Pillar: artifacts compound**

Career plans become tracked commitments instead of one-shot documents: structured milestones with status and target dates, progress bars, and a weekly "Check in" that drops the user back into the coaching chat with "Milestone X done, Y stuck — adjust the plan."

**Why it beats competitors:** none of LinkedIn/Teal/Levels/Final Round does longitudinal goal tracking with a coach that *reacts to progress*. This is the literal "coach" in career coach.

**What already exists:** `GoalPlanningWorkspace` is the app's richest feature — intake survey, profile baseline, multi-turn coaching chat with memory, saved/branched plans — and plan output already mandates a "Milestones" section, just as unstructured markdown.

**The gap:** extract structured `milestones[]` via a cheap JSON pass at save time (same pattern as the existing fit-scoring extraction), a checklist UI with per-plan progress, "Check in" seeding `createCoachingChat` with plan + progress, and a Dashboard card — "Career plan: 3/8 milestones · next: AWS cert by Jul 15" — with a nudge after 14 quiet days.

---

## 6. Interview performance history and skill progression

**Effort: MEDIUM–LARGE · Pillar: artifacts compound**

Mock interviews produce scored sessions (communication / structure / depth, 0–100) persisted over time, with a Dashboard trend chart and weak dimensions seeding the next session's focus.

**Why it beats competitors:** this is the Duolingo mechanic applied to interview prep — "your behavioral score went 62 → 71 → 78 over three weeks." Final Round AI runs mock interviews but doesn't show progression; visible improvement is what makes inherently repetitive practice feel worth repeating.

**Today:** the three mock workflows (`mock_behavioral`, `mock_tech`, `mock_case_study`) persist nothing — and due to the stateless-chat bug (#4) can't even remember their own previous question. Score-card and sparkline precedents already exist (resume/LinkedIn scores on Dashboard, recharts).

**Implementation:** a `MockInterviewWorkspace` modeled directly on `GoalPlanningWorkspace` (which already solves stateful chat + session save/resume), an `interview_sessions` table copying the `job_postings` RLS template, a rubric-extraction JSON pass over the transcript, and a score-trend card on the Dashboard. Sequence after #4 tier 1, which it depends on.

---

## Recommended sequencing

| Order | Item | Effort | Why now |
|---|---|---|---|
| 1 | Target-roles editor + suggested-postings lane (#1) | ~1 day | Unlocks an already-built weekly retention engine serving zero users |
| 2 | Tailor-from-posting wiring (#2) | 1–2 days | UI fully built; completes the find→tailor→apply loop |
| 3 | Pipeline stats + nudges, `saved_analyses` migration fix (#3) | small–medium | Pure client work; makes Dashboard a daily destination |
| 4 | Coach memory tier 1 (#4) | ~half day | Fixes a near-bug; immediately differentiating |
| 5 | Plan milestones + check-ins (#5) | medium | Builds on the strongest existing workspace |
| 6 | Interview score history (#6) | medium–large | Highest practice-loop payoff; needs #4's chat fix |
| 7 | Email digest, longitudinal memory store | larger | After the in-app loops prove out |

The first four items are roughly a week of work combined and would shift the product from "impressive toolbox" to "the app a job seeker opens every day until they sign an offer — and keeps for the next negotiation."
