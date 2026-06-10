-- ─────────────────────────────────────────────────────────
-- Deterministic company profiles + user-driven profile requests
--
-- `company_profiles` mirrors the committed JSON in data/companyProfiles/*.json,
-- populated by scripts/company-profiles/sync.ts after a profile PR merges. It is
-- shared reference data: any authenticated user may read; no client writes (the
-- sync uses the service role, which bypasses RLS).
--
-- `company_profile_requests` lets a user ask for a company to be added to the
-- defined list. The build routine reads pending rows, fetches data, and opens a
-- PR; the sync marks them done on merge.
-- ─────────────────────────────────────────────────────────

create table if not exists public.company_profiles (
  slug        text primary key,
  name        text not null,
  data        jsonb not null,
  sources     jsonb not null default '[]'::jsonb,
  fetched_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.company_profiles enable row level security;

-- Shared reference data: authenticated read; no client INSERT/UPDATE policy.
drop policy if exists company_profiles_select on public.company_profiles;
create policy company_profiles_select on public.company_profiles
  for select to authenticated using (true);

-- ── Slugify mirroring scripts/company-profiles/lib.ts slugify() for ASCII names.
create or replace function public.slugify_company(p_name text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(replace(coalesce(p_name, ''), '&', ' and ')),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  );
$$;

create table if not exists public.company_profile_requests (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  company       text not null,
  company_slug  text not null,
  status        text not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint company_profile_requests_status_check
    check (status in ('pending', 'processing', 'done', 'rejected'))
);

alter table public.company_profile_requests enable row level security;

create index if not exists company_profile_requests_status_idx
  on public.company_profile_requests (status);
create index if not exists company_profile_requests_user_idx
  on public.company_profile_requests (user_id, created_at desc);

-- Users see and create only their own requests.
drop policy if exists cpr_select_own on public.company_profile_requests;
create policy cpr_select_own on public.company_profile_requests
  for select to authenticated using (user_id = auth.uid());

drop trigger if exists company_profiles_updated_at on public.company_profiles;
create trigger company_profiles_updated_at
  before update on public.company_profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists company_profile_requests_updated_at on public.company_profile_requests;
create trigger company_profile_requests_updated_at
  before update on public.company_profile_requests
  for each row execute procedure public.set_updated_at();

-- ── Request RPC ────────────────────────────────────────────
-- Insert a pending request for the current user. Idempotent: if a profile
-- already exists, returns 'exists'; if the user already has an open request for
-- that company, returns 'duplicate'; otherwise inserts and returns 'queued'.
-- SECURITY DEFINER so it can read company_profiles and write the request without
-- a client INSERT policy (prevents spoofing user_id / arbitrary status).
create or replace function public.request_company_profile(p_company text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := nullif(btrim(p_company), '');
  v_slug text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if v_name is null or length(v_name) > 200 then raise exception 'invalid company'; end if;
  v_slug := public.slugify_company(v_name);
  if v_slug = '' then raise exception 'invalid company'; end if;

  if exists (select 1 from public.company_profiles where slug = v_slug) then
    return 'exists';
  end if;
  if exists (
    select 1 from public.company_profile_requests
    where user_id = v_uid and company_slug = v_slug and status in ('pending', 'processing')
  ) then
    return 'duplicate';
  end if;

  insert into public.company_profile_requests (user_id, company, company_slug)
  values (v_uid, v_name, v_slug);
  return 'queued';
end;
$$;

revoke execute on function public.request_company_profile(text) from anon;
grant  execute on function public.request_company_profile(text) to authenticated;

-- ── Grants ─────────────────────────────────────────────────
-- Explicit table grants so this works even on projects whose default privileges
-- don't auto-cover new public tables. service_role (sync/refresh) writes; reads
-- are still gated by RLS, so authenticated only needs SELECT at the grant level.
grant all privileges on table public.company_profiles        to service_role;
grant all privileges on table public.company_profile_requests to service_role;
grant select on table public.company_profiles                to authenticated;
grant select on table public.company_profile_requests        to authenticated;
grant usage, select on all sequences in schema public        to service_role;
