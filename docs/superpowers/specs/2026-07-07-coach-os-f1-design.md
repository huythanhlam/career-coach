# Coach OS (Roadmap F1) — Design

**Date:** 2026-07-07
**Status:** Approved

**Decisions (2026-07-07):** implement **Slice A first** (memory + context + settings; no cron/edge-function); nudge copy is **templated/deterministic** in Slice B.
**Roadmap ref:** `docs/rebuild/ROADMAP.md` §F1 (P0 · L · R1). Builds on the AI Core v2 substrate (`docs/superpowers/specs/2026-07-02-ai-gateway-v2-design.md`, Phase 1 slices #81/#82/#84/#86/#87).

## Goal

Turn the flagship coach from a context-blind chatbot into a coach that **remembers you**. Concretely:

- A per-user **memory store** — durable **facts**, **preferences**, and **episodes** — written by a lightweight **extraction pass** after meaningful events (mock interview completed, application package generated, career plan saved / checked-in).
- A reusable **context assembler** that injects the profile baseline, pipeline summary, recent scores, **and top-k memories** into every coach turn — so the coach references "the mock interview you did yesterday and its rubric scores" without the user restating them.
- Nightly **coach nudges** (server-generated via pg_cron) surfaced on the **Dashboard** — e.g. "Your application to Stripe has been quiet for 12 days — draft a follow-up?" — created **idempotently** and dismissible.
- A **"What the coach knows about me"** section in Profile Settings where the user **views and deletes** memories.

## Why (problem with the current approach)

Most of what the F1 write-up called for on the *chat surface itself* **already landed in Phase 1** and should not be re-done:

- `GlobalChatPanel.tsx` already **streams** token-by-token via `streamWorkflow(coachingChatWorkflow, …)`, already **persists** a durable conversation (`createConversation` → `ai_conversations`, gateway appends turns to `ai_messages`; see `src/ai/conversation.ts`), and already **injects context** via `buildContextualInstruction()` (profile baseline + pipeline summary + resume/LinkedIn scores). It has abort, retry, and localStorage fast-restore.
- So the roadmap line "GlobalChatPanel is **rebuilt** on streaming + persistence" is **done**. F1's remaining change to the panel is **additive**: route its context through a shared assembler that also injects memories.

What is genuinely missing — the actual F1 unlock — is everything about **state that outlives one conversation**:

1. **No memory.** The coach knows the profile snapshot and current pipeline, but nothing *episodic*: it can't say "last week's behavioral interview scored low on Result — let's work on that," because nothing writes that fact down after the interview.
2. **No proactive surface.** Dashboard nudges are recomputed client-side on each load (`computePipelineStats` → `staleApplications`), so they're ephemeral, can't be dismissed durably, and nothing runs while the user is away.
3. **No transparency/control.** There's no place to see or delete what the coach "knows."

## Design

Two new tables, one new AI workflow, one new service, one reusable assembler, one new edge function + cron, and additive wiring into four existing surfaces. Each component is independently testable.

### 1. Data model — `user_memories` (new migration)

New file **`supabase/pending_migrations/20260707000000_add_user_memories.sql`** (staged in `pending_migrations/` because `migrations/**` is write-protected; a human applies it and regenerates `supabase/types.ts`).

```sql
create table if not exists public.user_memories (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  kind           text not null check (kind in ('fact', 'preference', 'episode')),
  content        text not null,
  source_feature text,                              -- 'mock_interview' | 'autopilot' | 'goal_planner' | …
  salience       int  not null default 3 check (salience between 1 and 5),
  created_at     timestamptz not null default now()
);

-- Top-k retrieval order: most salient, then most recent (no embeddings — Roadmap §6).
create index if not exists user_memories_user_salience_idx
  on public.user_memories (user_id, salience desc, created_at desc);
```

**RLS — owner-only, plain form (mirrors `ai_conversations`/`ai_usage`, NOT the MFA-gated `job_postings` form).** Rationale: the coach and its memory writes happen during normal use at `aal1`; gating on `session_aal_ok(current_user_mfa_enrolled())` would block MFA-enrolled users mid-chat. The `ai_*` family already made this choice.

```sql
alter table public.user_memories enable row level security;
create policy user_memories_select_own on public.user_memories
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_memories_insert_own on public.user_memories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_memories_delete_own on public.user_memories
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on table public.user_memories to authenticated;
grant all privileges on table public.user_memories to service_role;
```

The client (`coachMemory.ts`, §4) inserts rows after running the extraction workflow, and the settings UI (§8) selects/deletes them — all under these policies.

### 2. Data model — `coach_nudges` (new migration)

New file **`supabase/pending_migrations/20260707000001_add_coach_nudges.sql`**.

```sql
create table if not exists public.coach_nudges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null,                        -- 'follow_up' (v1); extensible
  subject_id  uuid,                                 -- the job_postings row a nudge is about (nullable)
  title       text not null,
  body        text not null,
  cta_view    text,                                 -- ViewId to deep-link to, e.g. 'dashboard'
  status      text not null default 'active'
                check (status in ('active', 'dismissed', 'done')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Idempotency: one live nudge per (user, kind, subject). ON CONFLICT DO NOTHING on
-- re-run; a dismissed row keeps its key so it is never recreated (AC: dismiss suppresses).
create unique index if not exists coach_nudges_unique_subject
  on public.coach_nudges (user_id, kind, subject_id);
create index if not exists coach_nudges_user_status_idx
  on public.coach_nudges (user_id, status, created_at desc);
```

**RLS — owner-only read + status-update; inserts are service-role only** (the cron creates nudges; clients never do):

```sql
alter table public.coach_nudges enable row level security;
create policy coach_nudges_select_own on public.coach_nudges
  for select to authenticated using (user_id = (select auth.uid()));
create policy coach_nudges_update_own on public.coach_nudges          -- dismiss / mark done
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, update on table public.coach_nudges to authenticated;
grant all privileges on table public.coach_nudges to service_role;
```

### 3. Memory-writer workflow — `src/ai/workflows/memoryWriter.ts` (new)

A **FAST-tier**, structured-output workflow (Run-cost §: "FAST for memory extraction"). Follows the `defineWorkflow` pattern; the event summary is user-derived data, so it is wrapped in `uc()` + `injectionTrailer()`.

```ts
export const memoryWriterWorkflow = defineWorkflow({
  id: "memory_writer",
  tier: "FAST",
  inputSchema: z.object({
    sourceFeature: z.enum(["mock_interview", "autopilot", "goal_planner"]),
    eventSummary: z.string(), // compact text: interview scores+gaps / package fit / plan milestones
  }),
  outputSchema: z.object({
    memories: z
      .array(
        z.object({
          kind: z.enum(["fact", "preference", "episode"]),
          content: z.string().max(280),
          salience: z.number().int().min(1).max(5),
        }),
      )
      .max(5), // bound cost + noise
  }),
  buildSystem: () => /* extract durable, coach-useful facts/preferences + one episodic summary;
                        be conservative; career context only; no re-stating the raw profile */,
  buildPrompt: ({ eventSummary }) => `${uc(eventSummary)}${injectionTrailer()}`,
});
```

Because all tiers currently resolve to `gemini-3.1-flash-lite` (`src/config/models.ts`), `FAST` is a label today but keeps the assignment correct for when tiers diverge. Ships with an eval fixture (§Testing).

### 4. Memory store client — `src/services/coachMemory.ts` (new)

Thin, **fail-soft** service (persistence must never break the triggering event, matching `conversation.ts`):

- `recordEvent(sourceFeature, eventSummary): Promise<void>` — runs `memoryWriterWorkflow` via `runWorkflow`, then `insert`s the returned memories into `user_memories`. Any failure is logged and swallowed.
- `listMemories(): Promise<UserMemory[]>` — for settings; ordered by `salience desc, created_at desc`.
- `topMemories(k = 6): Promise<UserMemory[]>` — for the context assembler.
- `deleteMemory(id): Promise<void>`.

Tables are referenced by name (the Supabase client is untyped for pending tables, exactly like `conversation.ts`).

### 5. Post-event hooks (additive edits to existing code)

Fire-and-forget `coachMemory.recordEvent(...)` after each event's own persistence succeeds:

| Event | Hook site | Summary passed |
|---|---|---|
| Mock interview completed | `src/hooks/useInterviewSessions.ts` `addSession()`, after the insert resolves | role/focus + overall + per-dimension scores + top improvements |
| Package generated | the caller of `applicationAutopilot.generatePackage()` in `AutopilotWorkspace` (the service is pure; the hook lives in the UI) | target title/company + fit score |
| Plan saved / checked-in | `src/components/GoalPlanningWorkspace/useGoalPlanningActions.ts` `handleSave()` / `handleCheckIn()` | goal type/summary + milestone titles + completion state |

Each call is wrapped so a failure never blocks the user flow.

### 6. Context assembler — `src/ai/coach/context.ts` (new)

A **pure function** so it is trivially unit-testable; the coach panel supplies live data:

```ts
export function assembleCoachContext(input: {
  profile: UserProfile;
  postings: JobPosting[];
  memories: UserMemory[];        // top-k, already fetched
}): string
```

It returns the same profile-baseline + pipeline-summary + scores block that `buildContextualInstruction()` builds today, **plus** a `WHAT THE COACH REMEMBERS ABOUT THIS USER:` section listing the top-k memories (salience-ordered). `GlobalChatPanel.tsx` replaces its inline `buildContextualInstruction()` with a call to this assembler; a small `useCoachMemories()` hook fetches `topMemories()` on panel open (cached; no per-turn fetch). No other change to the panel's streaming/persistence path.

### 7. Nudge generator — `supabase/functions/generate-nudges/` + cron (new)

Edge function mirroring `refresh-suggestions` (cron-auth via `Authorization: Bearer <CRON_SECRET>`, service-role admin client). **Trigger detection is deterministic** (no AI, for reliability + zero run cost): for each profile, read `job_postings` and reuse the existing `STALE_AFTER_DAYS` staleness rule (status `applied`/`interviewing`, no movement past the threshold). For each stale posting it `insert … on conflict (user_id, kind, subject_id) do nothing` a `follow_up` nudge with a **templated** title/body ("Your application to {company} has been quiet for {n} days — draft a follow-up?"). AI-drafted copy is deferred (template first keeps this FAST/free and deterministic).

The deterministic core (posting list → nudge rows) is extracted into a pure `buildFollowUpNudges(postings, now)` helper so it can be unit-tested without Supabase.

New migration **`supabase/pending_migrations/20260707000002_generate_nudges_cron.sql`** schedules it nightly, following `20260610000002_suggested_postings_cron.sql` verbatim (idempotent `cron.unschedule` → `cron.schedule`, `net.http_post` to `…/functions/v1/generate-nudges`, vault `project_url`/`cron_secret`). Deploy note: add `generate-nudges` to the `supabase functions deploy` list and the CI deploy workflow.

### 8. Dashboard nudges + Settings memory panel (additive UI)

- **Dashboard** (`src/components/Dashboard.tsx`): a `useCoachNudges()` hook reads `coach_nudges where status='active'`; render them in the existing nudge area, each with a **Dismiss** action that sets `status='dismissed'` (owner update policy). This supersedes the ephemeral client-computed follow-up card for stale applications; the other client-side cards (profile completion, new matches) stay.
- **Profile Settings** (`src/components/ProfileSettings.tsx`): a new **"What the coach knows about me"** section lists `user_memories` grouped by `kind`, each with a **Delete** button (`deleteMemory`). View + delete are core (satisfy the AC); inline content **edit** is a stretch nice-to-have, not required for this spec's acceptance.

### 9. Types + CI

After the three migrations are applied, regenerate `supabase/types.ts` (`supabase gen types`) so `user_memories` and `coach_nudges` are typed; the existing types-staleness CI check covers this.

## Testing

- **`memoryWriter`** — a `scripts/evals/` golden fixture (interview event → asserts `memories` parses the schema, ≤5 items, at least one `episode`); schema-validity assertion like other workflow evals.
- **`assembleCoachContext`** — pure-function vitest: given a profile + postings + memories, asserts the output includes the baseline, the pipeline summary, the scores, and the memories in salience order; empty-memories case degrades to today's context string.
- **`coachMemory`** — vitest mocking `@/ai/client` `runWorkflow` and the `supabase` client: `recordEvent` inserts what the workflow returned; a workflow/insert failure resolves without throwing (fail-soft).
- **`buildFollowUpNudges`** — pure-function vitest for the nudge trigger: only stale (`> STALE_AFTER_DAYS`) applied/interviewing postings produce rows; re-running over the same input is stable (idempotency of the *content*; DB `ON CONFLICT` covers row-level idempotency).
- **RLS policy test** — extend the existing policy-test suite: user A cannot select user B's `user_memories` or `coach_nudges`; authenticated cannot `insert` into `coach_nudges` (service-role only).
- Streaming/metering ACs (TTFT p50, `ai_usage`) are already satisfied by the Phase-1 substrate and are not re-implemented here.

## Suggested slicing (for implementation PRs)

- **Slice A — Memory + context** (§1, §3–§6, §8-settings): delivers the "coach remembers yesterday's interview" AC and the settings view/delete AC. No cron, no new edge function — lowest risk, highest visible payoff.
- **Slice B — Nudges** (§2, §7, §8-dashboard): the pg_cron + edge-function surface, landed after Slice A proves the memory loop.

## Out of scope

- **F5 weekly digest email** (Resend, `send-digest`) — nudges are *surfaced on the Dashboard* here; the email channel is a separate roadmap item.
- **AI-drafted nudge copy** and non-`follow_up` nudge kinds — v1 is deterministic templated follow-ups only.
- **Semantic / embedding-based memory retrieval** — recency + salience only (Roadmap §6 rejects pgvector until evals prove the need).
- **Memory summarization / dedup / consolidation** and **memory editing** (delete only for v1).
- **Cross-device DB-backed chat history load** (`loadMessages`) — the localStorage fast-restore already satisfies the reopen-in-<500ms AC; DB history render is a later enhancement.
- **Context caching for the enlarged coach prompt** — a Run-cost mitigation to revisit under F4, not required for correctness here.
