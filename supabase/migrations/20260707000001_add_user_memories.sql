-- Coach OS memory store (Roadmap F1, Slice A). A per-user set of durable,
-- coach-useful notes — facts, preferences, and time-anchored episodes — written
-- by the memory-writer extraction pass (src/ai/workflows/memoryWriter.ts) after
-- meaningful events (mock interview, generated package, saved/checked-in plan),
-- and injected top-k into every coach turn (src/ai/coach/context.ts).
--
-- Owner-only RLS in the PLAIN form (user_id = auth.uid()), mirroring
-- ai_conversations / ai_messages / ai_usage — NOT the MFA-step-up form used by
-- job_postings. The coach and its memory writes happen during normal use at
-- aal1; gating on session_aal_ok() would block MFA-enrolled users mid-chat.
--
-- The client both writes (memory-writer runs client-side, inserts under RLS) and
-- reads/deletes (context assembler + the "What the coach knows about me" settings
-- section). Retrieval is recency + salience only — no embeddings (Roadmap §6).
--
-- Numbered to sort AFTER 20260703000001_add_ai_conversations.sql and all applied
-- migrations. Move into supabase/migrations/ in filename order to apply, then
-- regenerate supabase/types.ts.

create table if not exists public.user_memories (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  kind           text not null check (kind in ('fact', 'preference', 'episode')),
  content        text not null,
  source_feature text,                                  -- 'mock_interview' | 'autopilot' | 'goal_planner'
  salience       int  not null default 3 check (salience between 1 and 5),
  created_at     timestamptz not null default now()
);

-- Top-k retrieval order: most salient first, then most recent.
create index if not exists user_memories_user_salience_idx
  on public.user_memories (user_id, salience desc, created_at desc);

-- ── RLS: owner-only on the table ───────────────────────────
alter table public.user_memories enable row level security;

drop policy if exists user_memories_select_own on public.user_memories;
create policy user_memories_select_own on public.user_memories
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists user_memories_insert_own on public.user_memories;
create policy user_memories_insert_own on public.user_memories
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists user_memories_delete_own on public.user_memories;
create policy user_memories_delete_own on public.user_memories
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── Grants ─────────────────────────────────────────────────
grant select, insert, delete on table public.user_memories to authenticated;
grant all privileges on table public.user_memories to service_role;
