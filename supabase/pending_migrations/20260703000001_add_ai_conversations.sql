-- Conversation persistence for the ai-gateway edge function (AI Core v2, Slice 3).
-- Two owner-scoped tables that back streaming chat surfaces (Global Coach, Goal
-- Planning coaching, and later Mock Interview / Negotiation): a conversation
-- header and its ordered messages. When the client passes `conversationId` to a
-- streaming gateway call, the gateway appends the user turn and the model reply
-- to `ai_messages` (via the service role, which bypasses RLS) so a refresh no
-- longer loses in-flight chat. Minimal but forward-compatible with the stateful
-- coach (memory/summarization) in Roadmap F1.
--
-- Owner-only RLS (user_id = auth.uid()) on both tables, mirroring `job_postings`
-- and the `ai_usage` metering table. The client (`src/ai/conversation.ts`)
-- creates conversations and reads messages under these policies; the gateway
-- inserts messages with the service key.
--
-- Numbered to sort AFTER 20260703000000_add_ai_usage.sql (and all applied
-- migrations). Move into supabase/migrations/ in filename order to apply.

-- ── Conversation headers ───────────────────────────────────
create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  workflow_id text not null,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Lists a user's most-recently-active conversations for a surface.
create index if not exists ai_conversations_user_updated_idx
  on public.ai_conversations (user_id, updated_at desc);

-- ── Messages (ordered turns under a conversation) ──────────
create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user', 'model')),
  content         text not null,
  created_at      timestamptz not null default now()
);

-- Loads a conversation's turns in order.
create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages (conversation_id, created_at);

-- ── RLS: owner-only on both tables ─────────────────────────
alter table public.ai_conversations enable row level security;
alter table public.ai_messages      enable row level security;

drop policy if exists ai_conversations_select_own on public.ai_conversations;
create policy ai_conversations_select_own on public.ai_conversations
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists ai_conversations_insert_own on public.ai_conversations;
create policy ai_conversations_insert_own on public.ai_conversations
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists ai_conversations_update_own on public.ai_conversations;
create policy ai_conversations_update_own on public.ai_conversations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists ai_conversations_delete_own on public.ai_conversations;
create policy ai_conversations_delete_own on public.ai_conversations
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists ai_messages_select_own on public.ai_messages;
create policy ai_messages_select_own on public.ai_messages
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists ai_messages_insert_own on public.ai_messages;
create policy ai_messages_insert_own on public.ai_messages
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists ai_messages_delete_own on public.ai_messages;
create policy ai_messages_delete_own on public.ai_messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── Grants ─────────────────────────────────────────────────
grant all privileges on table public.ai_conversations to service_role;
grant all privileges on table public.ai_messages      to service_role;
grant select, insert, update, delete on table public.ai_conversations to authenticated;
grant select, insert, delete         on table public.ai_messages      to authenticated;
