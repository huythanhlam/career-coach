-- ─────────────────────────────────────────────────────────
-- Interview practice history
-- One row per completed mock-interview session (behavioral / technical /
-- case study): the transcript plus rubric scores, so progress is visible
-- across sessions instead of every practice run evaporating.
-- ─────────────────────────────────────────────────────────

create table if not exists public.interview_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  workflow      text not null,
  role          text,
  focus         text,
  transcript    jsonb not null default '[]'::jsonb,   -- [{ role: 'user'|'model', text }]
  scores        jsonb,                                 -- { communication, structure, depth } 0–100
  overall_score int,
  summary       text,
  strengths     jsonb,                                 -- string[]
  improvements  jsonb,                                 -- string[]
  created_at    timestamptz not null default now(),
  constraint interview_sessions_workflow_check check (
    workflow in ('mock_behavioral','mock_tech','mock_case_study')
  )
);

create index if not exists interview_sessions_user_created_idx
  on public.interview_sessions (user_id, created_at desc);

-- ── RLS ────────────────────────────────────────────────────
-- Same per-owner + MFA-step-up model as job_postings, reusing the
-- security-definer helper defined in that migration.
alter table public.interview_sessions enable row level security;

create policy "interview_sessions: owner can select"
  on public.interview_sessions for select
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "interview_sessions: owner can insert"
  on public.interview_sessions for insert
  with check (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "interview_sessions: owner can delete"
  on public.interview_sessions for delete
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );
