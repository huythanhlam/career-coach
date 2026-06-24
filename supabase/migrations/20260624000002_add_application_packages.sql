-- ─────────────────────────────────────────────────────────
-- Application Autopilot: review-and-approve application packages
-- One row per posting the autopilot has prepared an application for: a tailored
-- resume + cover-letter draft + fit score, queued for the user to review and
-- approve. NOTHING is auto-submitted — "submit" just opens the real ATS URL.
-- ─────────────────────────────────────────────────────────

create table if not exists public.application_packages (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users (id) on delete cascade,
  job_posting_id              uuid not null references public.job_postings (id) on delete cascade,
  fit_score                   int,
  tailored_resume_text        text,
  tailored_resume_storage_path text,
  cover_letter_text           text,
  package_status              text not null default 'generated',
  error                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint application_packages_status_check check (
    package_status in ('queued','generating','generated','approved','submitted','failed')
  )
);

-- Reuse the shared updated_at trigger function (defined in the profiles migration).
drop trigger if exists application_packages_updated_at on public.application_packages;
create trigger application_packages_updated_at
  before update on public.application_packages
  for each row execute procedure public.set_updated_at();

-- One active package per posting (re-generating replaces the same row).
create unique index if not exists application_packages_user_posting_idx
  on public.application_packages (user_id, job_posting_id);
create index if not exists application_packages_user_status_idx
  on public.application_packages (user_id, package_status);

-- ── RLS ────────────────────────────────────────────────────
-- Per-owner + MFA-step-up model, reusing the security-definer helper from the
-- job_postings migration.
alter table public.application_packages enable row level security;

create policy "application_packages: owner can select"
  on public.application_packages for select
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "application_packages: owner can insert"
  on public.application_packages for insert
  with check (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "application_packages: owner can update"
  on public.application_packages for update
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  )
  with check (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "application_packages: owner can delete"
  on public.application_packages for delete
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );
