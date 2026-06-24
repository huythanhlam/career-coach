-- Corrective migration: `current_role` is a reserved SQL keyword, so the
-- unquoted `current_role text` column definition in
-- 20260530000000_user_profiles_mfa.sql is a syntax error -- the column was never
-- created on databases that applied that file as written. Add it with a quoted
-- identifier so the column exists and the frontend (profileMapper reads/writes
-- the `current_role` key) works. Idempotent.
alter table public.profiles add column if not exists "current_role" text;
