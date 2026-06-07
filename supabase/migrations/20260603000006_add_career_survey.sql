-- Current-state survey: the user's present job situation, used (alongside the
-- profile baseline and goals) to generate the career goal planning sheet.
alter table public.profiles
  add column if not exists career_survey jsonb not null default '{}'::jsonb;
