-- ─────────────────────────────────────────────────────────
-- Weekly pre-warm of Research Company data for popular employers
-- ─────────────────────────────────────────────────────────
--
-- Calls the `seed-company-research` Edge Function, which researches Fortune-100
-- + popular companies (grounded) and upserts them into company_research_cache
-- so end users get instant cache hits instead of triggering AI calls. The
-- function caps the batch per run and skips companies already fresh, so the
-- weekly cadence steadily keeps the popular set warm.
--
-- Requires the pg_cron + pg_net extensions and two Vault secrets (shared with
-- the job-suggestions cron):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random-string>',           'cron_secret');
-- The same '<random-string>' must be set as the CRON_SECRET function secret and
-- the function deployed:
--   supabase secrets set CRON_SECRET=<random-string>
--   supabase functions deploy seed-company-research --no-verify-jwt

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-create idempotently.
select cron.unschedule('seed-company-research')
where exists (select 1 from cron.job where jobname = 'seed-company-research');

-- Sundays 09:00 UTC (off-peak; the function chips away in capped batches).
select cron.schedule(
  'seed-company-research',
  '0 9 * * 0',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/seed-company-research',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
