-- Latest Resume Analyzer and LinkedIn Optimization scores (0-100), surfaced on
-- the Overview dashboard. Nullable: a score stays empty until the user runs the
-- corresponding analysis. RLS is inherited from the profiles table (users can
-- only read/write their own row), so no new policy is required.
alter table public.profiles
  add column if not exists resume_score      int,
  add column if not exists resume_score_at   timestamptz,
  add column if not exists linkedin_score    int,
  add column if not exists linkedin_score_at timestamptz;
