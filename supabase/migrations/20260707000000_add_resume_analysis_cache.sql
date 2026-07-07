-- Per-user cache for AI-generated resume analysis. Keyed by a content hash of
-- (resumeText + jd). Private, PII-derived output → strictly per-owner (mirrors
-- saved_analyses RLS: owner + MFA step-up). No shared read/write.
create table if not exists public.resume_analysis_cache (
  user_id    uuid not null references auth.users (id) on delete cascade,
  cache_key  text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, cache_key)
);

alter table public.resume_analysis_cache enable row level security;

create policy "resume_analysis_cache: owner can select"
  on public.resume_analysis_cache for select
  using (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));

create policy "resume_analysis_cache: owner can insert"
  on public.resume_analysis_cache for insert
  with check (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));

create policy "resume_analysis_cache: owner can update"
  on public.resume_analysis_cache for update
  using (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()))
  with check (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));

create policy "resume_analysis_cache: owner can delete"
  on public.resume_analysis_cache for delete
  using (auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled()));