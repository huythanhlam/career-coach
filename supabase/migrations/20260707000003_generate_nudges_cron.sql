-- ─────────────────────────────────────────────────────────
-- Coach OS F1 Slice B: nightly coach-nudge generation cron
-- ─────────────────────────────────────────────────────────
-- Requires the pg_cron + pg_net extensions and the same Vault secrets
-- (project_url, cron_secret) already used by refresh-job-suggestions:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random-string>',           'cron_secret');
-- The same '<random-string>' must be set as the CRON_SECRET function secret:
--   supabase secrets set CRON_SECRET=<random-string>
-- and the function deployed:
--   supabase functions deploy generate-nudges --no-verify-jwt

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-create idempotently.
select cron.unschedule('generate-coach-nudges')
where exists (select 1 from cron.job where jobname = 'generate-coach-nudges');

-- Nightly at 09:00 UTC.
select cron.schedule(
  'generate-coach-nudges',
  '0 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/generate-nudges',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
