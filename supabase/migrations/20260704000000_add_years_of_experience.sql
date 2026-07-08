-- Add years_of_experience to public.profiles.
--
-- Missing-migration gap: the client (src/lib/profileMapper.ts) has always
-- read and written profile.yearsOfExperience, but NO migration ever created the
-- column — it existed only in the pre-migration, out-of-band production schema.
-- When prod was rebuilt from migrations (supabase db reset --linked), the column
-- vanished and profile upserts began failing with PGRST204
-- ("Could not find the 'years_of_experience' column"). This restores it so the
-- schema matches what the app reads/writes.
--
-- Additive and idempotent; no RLS change needed (profiles already has RLS, and a
-- new column is covered by the existing owner-scoped policies).

alter table public.profiles
  add column if not exists years_of_experience integer;
