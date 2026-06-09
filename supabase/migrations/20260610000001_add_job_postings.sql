-- ─────────────────────────────────────────────────────────
-- Targeted Job Postings: curated postings + full application lifecycle
-- One row per saved posting; `status` carries it from saved → applied →
-- interviewing → offer → accepted/rejected. Supersedes the never-migrated
-- `job_applications` table the Dashboard previously referenced.
-- ─────────────────────────────────────────────────────────

create table if not exists public.job_postings (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  title                   text not null,
  company                 text,
  location                text,
  description             text,
  url                     text,
  source                  text not null default 'manual',  -- 'ats' | 'web' | 'manual'
  external_id             text,                             -- ATS job id, for dedupe
  employment_type         text,
  remote                  boolean,
  target_role_id          text,
  target_company_id       text,
  match_score             int,                              -- optional AI fit score 0–100
  status                  text not null default 'saved',
  favorite                boolean not null default false,
  applied_resume_id       text,
  applied_cover_letter_id text,
  notes                   text,
  applied_at              timestamptz,
  posting_data            jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint job_postings_status_check check (
    status in ('saved','applied','interviewing','offer','accepted','rejected','archived')
  ),
  constraint job_postings_source_check check (
    source in ('ats','web','manual')
  )
);

-- Reuse the shared updated_at trigger function (defined in the profiles migration).
drop trigger if exists job_postings_updated_at on public.job_postings;
create trigger job_postings_updated_at
  before update on public.job_postings
  for each row execute procedure public.set_updated_at();

create index if not exists job_postings_user_status_idx   on public.job_postings (user_id, status);
create index if not exists job_postings_user_created_idx  on public.job_postings (user_id, created_at desc);
create index if not exists job_postings_user_favorite_idx on public.job_postings (user_id, favorite);
-- Dedupe re-scans of the same external posting.
create unique index if not exists job_postings_user_source_external_idx
  on public.job_postings (user_id, source, external_id)
  where external_id is not null;

-- ── RLS ────────────────────────────────────────────────────
-- Mirrors the per-owner + MFA-step-up model used by `profiles`.
--
-- NOTE: we cannot read `profiles.mfa_enrolled` inline here — that subquery runs
-- under the profiles RLS policy, so an MFA-enrolled user at aal1 would get NULL
-- back and `session_aal_ok(NULL)` falls through to `true` (a leak). A
-- security-definer helper reads the flag bypassing RLS, closing that hole.
create or replace function public.current_user_mfa_enrolled()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select mfa_enrolled from public.profiles where id = auth.uid()), false);
$$;

alter table public.job_postings enable row level security;

create policy "job_postings: owner can select"
  on public.job_postings for select
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "job_postings: owner can insert"
  on public.job_postings for insert
  with check (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "job_postings: owner can update"
  on public.job_postings for update
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  )
  with check (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "job_postings: owner can delete"
  on public.job_postings for delete
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );
