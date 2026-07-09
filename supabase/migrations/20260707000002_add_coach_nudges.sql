-- Coach OS F1 Slice B: coach_nudges (deterministic, server-generated follow-up nudges).
-- See docs/superpowers/specs/2026-07-07-coach-os-f1-design.md §2.

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

alter table public.coach_nudges enable row level security;

drop policy if exists coach_nudges_select_own on public.coach_nudges;
create policy coach_nudges_select_own on public.coach_nudges
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists coach_nudges_update_own on public.coach_nudges;
create policy coach_nudges_update_own on public.coach_nudges          -- dismiss / mark done
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, update on table public.coach_nudges to authenticated;
grant all privileges on table public.coach_nudges to service_role;
