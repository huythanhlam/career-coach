-- Per-call AI usage metering for the ai-gateway edge function (AI Core v2).
-- One row per Gemini generation: tokens, latency, TTFT, and an estimated cost.
-- Feeds cost/latency dashboards (Phase 2) and backs the hard monthly per-user
-- token cap enforced in the gateway before any provider call.
--
-- Writes are service-role only (the gateway inserts with the service key, like
-- ai_rate_limits); users may read their own rows for an in-app usage view.
--
-- Numbered to sort AFTER the P0 pending set (20260625*) and all applied
-- migrations. Move into supabase/migrations/ in filename order to apply.

create table if not exists public.ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid    not null references auth.users (id) on delete cascade,
  workflow_id   text    not null,
  model         text    not null,
  input_tokens  int     not null default 0,
  output_tokens int     not null default 0,
  latency_ms    int,
  ttft_ms       int,
  est_cost      numeric(10, 6) not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

-- Owner-only read; no client INSERT/UPDATE/DELETE policy (service-role bypasses
-- RLS, so the gateway can still insert — the same posture as ai_rate_limits).
drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- The monthly-cap sum and the est_cost/usage rollups both filter on
-- (user_id, created_at).
create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

-- Hard monthly cap check: true when the user has already met or exceeded p_cap
-- total tokens (input+output) since the start of the current calendar month.
-- SECURITY DEFINER + service-role-only execute mirrors check_ai_rate_limit.
create or replace function public.check_ai_usage_cap(
  p_user_id uuid,
  p_cap     bigint
) returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(input_tokens + output_tokens), 0) >= p_cap
    from public.ai_usage
   where user_id = p_user_id
     and created_at >= date_trunc('month', now());
$$;

revoke all on function public.check_ai_usage_cap(uuid, bigint) from public;
revoke all on function public.check_ai_usage_cap(uuid, bigint) from authenticated;
grant execute on function public.check_ai_usage_cap(uuid, bigint) to service_role;
