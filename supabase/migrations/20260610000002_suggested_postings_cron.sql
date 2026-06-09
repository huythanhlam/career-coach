-- ─────────────────────────────────────────────────────────
-- "Suggested this week" lane + weekly refresh cron
-- ─────────────────────────────────────────────────────────

-- 1. Allow the new system-managed lifecycle value.
alter table public.job_postings drop constraint if exists job_postings_status_check;
alter table public.job_postings add constraint job_postings_status_check check (
  status in ('suggested','saved','applied','interviewing','offer','accepted','rejected','archived')
);

-- 2. Schedule the weekly refresher.
-- Requires the pg_cron + pg_net extensions and two Vault secrets so we never
-- hardcode the project URL or the cron secret in source control:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random-string>',           'cron_secret');
-- The same '<random-string>' must be set as the CRON_SECRET function secret:
--   supabase secrets set CRON_SECRET=<random-string>
-- and the function deployed:
--   supabase functions deploy refresh-suggestions scan-jobs job-search --no-verify-jwt

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-create idempotently.
select cron.unschedule('refresh-job-suggestions')
where exists (select 1 from cron.job where jobname = 'refresh-job-suggestions');

-- Mondays 13:00 UTC.
select cron.schedule(
  'refresh-job-suggestions',
  '0 13 * * 1',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/refresh-suggestions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
