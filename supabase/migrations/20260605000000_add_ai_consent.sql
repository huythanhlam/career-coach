-- Add AI data processing consent timestamp to profiles.
-- NULL means not yet consented; a timestamp records when they agreed.
alter table public.profiles
  add column if not exists ai_consent_given_at timestamptz;
