-- ─────────────────────────────────────────────────────────
-- Negotiation Roleplay: scored practice sessions
-- One row per completed salary-negotiation roleplay against the AI recruiter.
-- Separate from interview_sessions because the rubric differs (anchoring /
-- justification / composure / outcome instead of communication / structure /
-- depth). Mirrors the interview_sessions shape + RLS otherwise.
-- ─────────────────────────────────────────────────────────

create table if not exists public.negotiation_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text,
  counterpart   text,                                  -- 'recruiter' | 'hiring_manager'
  scenario      text,                                  -- the offer/setup the roleplay used
  transcript    jsonb not null default '[]'::jsonb,    -- [{ role: 'user'|'model', text }]
  scores        jsonb,                                 -- { anchoring, justification, composure, outcome } 0–100
  overall_score int,
  summary       text,
  strengths     jsonb,                                 -- string[]
  improvements  jsonb,                                 -- string[]
  move_feedback jsonb not null default '[]'::jsonb,    -- [{ move, feedback, rating }]
  created_at    timestamptz not null default now()
);

create index if not exists negotiation_sessions_user_created_idx
  on public.negotiation_sessions (user_id, created_at desc);

-- ── RLS ────────────────────────────────────────────────────
-- Same per-owner + MFA-step-up model as interview_sessions, reusing the
-- security-definer helper from the job_postings migration.
alter table public.negotiation_sessions enable row level security;

create policy "negotiation_sessions: owner can select"
  on public.negotiation_sessions for select
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "negotiation_sessions: owner can insert"
  on public.negotiation_sessions for insert
  with check (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );

create policy "negotiation_sessions: owner can delete"
  on public.negotiation_sessions for delete
  using (
    auth.uid() = user_id
    and public.session_aal_ok(public.current_user_mfa_enrolled())
  );
