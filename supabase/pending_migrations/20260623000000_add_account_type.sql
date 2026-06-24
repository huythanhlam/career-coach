-- ─────────────────────────────────────────────────────────
-- Employer Studio, part 1: account type
-- Adds a seeker/employer role to profiles so the app can gate the
-- employer-facing Studio. Existing rows default to 'seeker', so no
-- backfill is needed and the handle_new_user trigger is unchanged.
-- ─────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists account_type text not null default 'seeker';

-- Add the value constraint separately so a re-run is safe even if the column
-- already exists from a partial apply.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_account_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_account_type_check
      check (account_type in ('seeker', 'employer'));
  end if;
end $$;
