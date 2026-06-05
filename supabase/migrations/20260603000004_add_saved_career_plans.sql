-- Career goal plans: metadata persisted here, full plan + coaching transcript
-- live as a JSON payload in the existing private `user-documents` Storage bucket.
alter table public.profiles
  add column if not exists saved_career_plans jsonb not null default '[]'::jsonb;
