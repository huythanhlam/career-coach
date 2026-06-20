-- Consolidate interview practice to the behavioral simulator only:
--   - add per-question STAR feedback storage
--   - drop the now-removed technical / case-study simulators
-- Destructive: deletes existing mock_tech / mock_case_study rows.

alter table public.interview_sessions
  add column if not exists question_feedback jsonb not null default '[]'::jsonb;

delete from public.interview_sessions
  where workflow in ('mock_tech', 'mock_case_study');

alter table public.interview_sessions
  drop constraint if exists interview_sessions_workflow_check;

alter table public.interview_sessions
  add constraint interview_sessions_workflow_check check (
    workflow in ('mock_behavioral')
  );
