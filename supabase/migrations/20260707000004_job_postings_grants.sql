-- Fix: `job_postings` (20260610000001) predates the convention established in
-- 20260612000000_company_profiles.sql — "default privileges don't auto-cover
-- new public tables" — and never received explicit grants for `authenticated`
-- or `service_role`. Confirmed via:
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'job_postings';
-- which showed only REFERENCES/TRIGGER/TRUNCATE for both roles (the auto-grant
-- baseline), no SELECT/INSERT/UPDATE/DELETE. This silently broke:
--   (1) the `refresh-suggestions` cron (service_role writes to job_postings),
--   (2) the new `generate-nudges` cron (service_role reads job_postings),
-- and possibly (3) authenticated user access to their own pipeline, depending
-- on what's been compensating for the missing authenticated grant (TBD).
--
-- RLS on job_postings (owner + MFA step-up) already gates row-level access for
-- `authenticated`; this migration only restores the table-level grants RLS
-- depends on being present in the first place.

grant select, insert, update, delete on table public.job_postings to authenticated;
grant all privileges                on table public.job_postings to service_role;
