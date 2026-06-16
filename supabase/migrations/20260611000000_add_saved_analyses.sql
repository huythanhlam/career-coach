-- ─────────────────────────────────────────────────────────
-- Strategy Engine saved analyses
-- The client hook (useSavedAnalyses) has been reading/writing this table all
-- along, but no migration ever created it — so saves silently no-oped on
-- fresh environments. Columns mirror the hook's insert exactly.
-- ─────────────────────────────────────────────────────────

create table if not exists public.saved_analyses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  job_input          text not null,
  yoe                text,
  level              text,
  market_data        jsonb,
  company_intel      text,
  resume_fit         jsonb,
  interview_strategy text,
  resume_file_name   text,
  created_at         timestamptz not null default now()
);

create index if not exists saved_analyses_user_created_idx
  on public.saved_analyses (user_id, created_at desc);

-- ── RLS ────────────────────────────────────────────────────
-- Same per-owner + MFA-step-up model as job_postings, reusing the
-- security-definer helper defined in that migration.
alter table public.saved_analyses enable row level security;

create policy "saved_analyses: owner can select"
  on public.saved_analyses for select
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "saved_analyses: owner can insert"
  on public.saved_analyses for insert
  with check (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "saved_analyses: owner can delete"
  on public.saved_analyses for delete
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );
