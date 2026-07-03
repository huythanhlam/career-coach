-- ─────────────────────────────────────────────────────────
-- Employer Studio, part 2: company profiles, job listings, boost orders
--
-- Employer-owned, per-user data (mirrors the job_postings model). A user who
-- chose account_type = 'employer' manages their own company profiles and the
-- job listings under them, can mark a listing published, and can "boost" it
-- (simulated checkout) to feature it for a window.
--
-- Reuses the per-owner + MFA-step-up RLS model and the shared set_updated_at
-- trigger / current_user_mfa_enrolled() helper defined in earlier migrations.
-- Does NOT touch the existing reference-data `company_profiles` table or the
-- seeker-owned `job_postings` table.
-- ─────────────────────────────────────────────────────────

-- ── Company profiles (employer-owned) ──────────────────────
create table if not exists public.employer_company_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  tagline       text,
  website       text,
  industry      text,
  size          text,
  headquarters  text,
  logo_url      text,
  about         text,
  mission       text,
  culture       text,
  benefits      text,
  extra         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists employer_company_profiles_user_created_idx
  on public.employer_company_profiles (user_id, created_at desc);

drop trigger if exists employer_company_profiles_updated_at on public.employer_company_profiles;
create trigger employer_company_profiles_updated_at
  before update on public.employer_company_profiles
  for each row execute procedure public.set_updated_at();

-- ── Job listings (employer-owned, under a company) ─────────
create table if not exists public.employer_job_listings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  company_id       uuid not null references public.employer_company_profiles (id) on delete cascade,
  title            text not null,
  location         text,
  employment_type  text,
  remote           boolean,
  seniority        text,
  salary_min       int,
  salary_max       int,
  salary_currency  text not null default 'USD',
  description      text,
  requirements     text,
  responsibilities text,
  status           text not null default 'draft',
  boosted_until    timestamptz,
  boost_tier       text,
  promo_assets     jsonb not null default '{}'::jsonb,
  extra            jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint employer_job_listings_status_check check (
    status in ('draft', 'published', 'closed')
  )
);

create index if not exists employer_job_listings_user_created_idx
  on public.employer_job_listings (user_id, created_at desc);
create index if not exists employer_job_listings_company_idx
  on public.employer_job_listings (company_id);
-- Drives the seeker-facing "Featured opportunities" lane.
create index if not exists employer_job_listings_featured_idx
  on public.employer_job_listings (status, boosted_until desc);

drop trigger if exists employer_job_listings_updated_at on public.employer_job_listings;
create trigger employer_job_listings_updated_at
  before update on public.employer_job_listings
  for each row execute procedure public.set_updated_at();

-- ── Boost orders (simulated-checkout ledger) ───────────────
create table if not exists public.employer_boost_orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  listing_id   uuid not null references public.employer_job_listings (id) on delete cascade,
  tier         text not null,
  days         int not null,
  amount_cents int not null,
  currency     text not null default 'USD',
  status       text not null default 'paid',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz
);

create index if not exists employer_boost_orders_user_created_idx
  on public.employer_boost_orders (user_id, created_at desc);
create index if not exists employer_boost_orders_listing_idx
  on public.employer_boost_orders (listing_id);

-- ── RLS ────────────────────────────────────────────────────
-- Per-owner + MFA-step-up, mirroring job_postings.
alter table public.employer_company_profiles enable row level security;
alter table public.employer_job_listings     enable row level security;
alter table public.employer_boost_orders      enable row level security;

-- employer_company_profiles: owner CRUD
drop policy if exists "employer_company_profiles: owner can select" on public.employer_company_profiles;
create policy "employer_company_profiles: owner can select"
  on public.employer_company_profiles for select
  using (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));
drop policy if exists "employer_company_profiles: owner can insert" on public.employer_company_profiles;
create policy "employer_company_profiles: owner can insert"
  on public.employer_company_profiles for insert
  with check (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));
drop policy if exists "employer_company_profiles: owner can update" on public.employer_company_profiles;
create policy "employer_company_profiles: owner can update"
  on public.employer_company_profiles for update
  using (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()))
  with check (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));
drop policy if exists "employer_company_profiles: owner can delete" on public.employer_company_profiles;
create policy "employer_company_profiles: owner can delete"
  on public.employer_company_profiles for delete
  using (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));

-- employer_job_listings: owner CRUD
drop policy if exists "employer_job_listings: owner can select" on public.employer_job_listings;
create policy "employer_job_listings: owner can select"
  on public.employer_job_listings for select
  using (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));
drop policy if exists "employer_job_listings: owner can insert" on public.employer_job_listings;
create policy "employer_job_listings: owner can insert"
  on public.employer_job_listings for insert
  with check (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));
drop policy if exists "employer_job_listings: owner can update" on public.employer_job_listings;
create policy "employer_job_listings: owner can update"
  on public.employer_job_listings for update
  using (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()))
  with check (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));
drop policy if exists "employer_job_listings: owner can delete" on public.employer_job_listings;
create policy "employer_job_listings: owner can delete"
  on public.employer_job_listings for delete
  using (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));

-- employer_job_listings: PUBLIC featured read — any authenticated user may read
-- a listing that is published AND has an unexpired boost (drives the seeker feed).
-- RLS policies are OR'd, so this widens read access only for those rows.
drop policy if exists "employer_job_listings: public featured read" on public.employer_job_listings;
create policy "employer_job_listings: public featured read"
  on public.employer_job_listings for select
  to authenticated
  using (status = 'published' and boosted_until is not null and boosted_until > now());

-- employer_boost_orders: owner CRUD (insert/select are what the app uses)
drop policy if exists "employer_boost_orders: owner can select" on public.employer_boost_orders;
create policy "employer_boost_orders: owner can select"
  on public.employer_boost_orders for select
  using (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));
drop policy if exists "employer_boost_orders: owner can insert" on public.employer_boost_orders;
create policy "employer_boost_orders: owner can insert"
  on public.employer_boost_orders for insert
  with check (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));

-- ── Grants ─────────────────────────────────────────────────
grant all privileges on table public.employer_company_profiles to service_role;
grant all privileges on table public.employer_job_listings     to service_role;
grant all privileges on table public.employer_boost_orders      to service_role;
grant select, insert, update, delete on table public.employer_company_profiles to authenticated;
grant select, insert, update, delete on table public.employer_job_listings     to authenticated;
grant select, insert                 on table public.employer_boost_orders      to authenticated;
