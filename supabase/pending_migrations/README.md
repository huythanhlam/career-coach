# Pending migrations

This directory holds migrations for features whose code is already merged but
not yet applied to the database. It's used because this repo write-protects
`supabase/migrations/**` and `supabase/types.ts` in `.claude/settings.json`:
**a human applies them**, then moves the file into `supabase/migrations/`.

There is nothing pending right now — the directory is empty except for this
README. The most recent batch (below) was applied 2026-07-08.

## How to apply (when something lands here again)

```bash
git mv supabase/pending_migrations/<file>.sql supabase/migrations/
supabase db push          # or: supabase migration up
```

Or paste the file's contents into the Supabase Dashboard → SQL Editor. Files
in this directory are written to be idempotent (`if not exists`, guarded
constraints), so a partial apply or re-run is safe.

After applying, regenerate types — **do not hand-edit** `supabase/types.ts`:

```bash
supabase gen types typescript --linked > supabase/types.ts
```

## History

### 2026-07-08 — Coach OS F1 Slice B + a production grants incident

- **`20260707000002_add_coach_nudges.sql`** / **`…000003_generate_nudges_cron.sql`**
  — Coach OS F1 Slice B (nudges): the `coach_nudges` table + the nightly
  `generate-nudges` pg_cron job. Requires `CRON_SECRET` as a function secret
  and `generate-nudges` deployed (`supabase functions deploy generate-nudges
  --no-verify-jwt`) — same pattern as `refresh-job-suggestions`. See §7 of
  `docs/superpowers/specs/2026-07-07-coach-os-f1-design.md`.

- **`20260707000004_job_postings_grants.sql`** — production bugfix, unrelated
  to Slice B. `job_postings` (20260610000001) predates the "explicit grants
  required" convention below and was missing `select/insert/update/delete`
  grants for both `authenticated` and `service_role` (confirmed via
  `information_schema.role_table_grants` — only REFERENCES/TRIGGER/TRUNCATE
  were present). This silently broke `refresh-suggestions` writes and would
  have broken `generate-nudges` reads.

- **`20260707000005_fix_missing_table_grants.sql`** — production incident,
  unrelated to Slice B. A live-app audit found 10 more tables missing base
  grants for `authenticated` (and some for `service_role`) — including
  `profiles` itself, which was actively blocking profile saves with
  `"Grant the required privileges..."` errors. No migration in this repo ever
  issued a table-level `REVOKE`, so this happened outside version control
  (Dashboard/SQL editor), not from a code change. `ai_rate_limits` also
  showed up in the audit but was deliberately excluded — it's accessed only
  via a `SECURITY DEFINER` function restricted to `service_role`, so it never
  needed a direct grant. `admin_audit_log` was folded in too: its own
  migration's comment promised a `service_role` grant that was never actually
  written. See the migration file for the full table list and the audit
  query used to find them.

**Why this convention exists:** unlike some Postgres setups, this project's
default privileges do **not** auto-cover new `public` tables beyond
`REFERENCES`/`TRIGGER`/`TRUNCATE` — every table needs an explicit `grant` for
`authenticated` and/or `service_role` per the access it needs. First
documented in `20260612000000_company_profiles.sql`. `job_postings` and the
10 tables above predate that documentation and were the fallout.

## Verify a grants fix landed

Re-run the audit query from `20260707000005_fix_missing_table_grants.sql`
(swap `grantee = 'authenticated'` for `'service_role'` for the other role):

```sql
select t.tablename, bool_or(g.privilege_type = 'SELECT') as has_select
from pg_tables t
left join information_schema.role_table_grants g
  on g.table_name = t.tablename and g.table_schema = 'public'
 and g.grantee = 'authenticated'
where t.schemaname = 'public'
group by t.tablename
having not bool_or(g.privilege_type = 'SELECT');
```

An empty result means every `public` table has at least `SELECT` for that
role — it doesn't confirm `INSERT`/`UPDATE`/`DELETE` are correct too, so for
a table you just fixed, cross-check against its RLS policies (`for insert` /
`for update` / `for delete` in its migration) rather than relying on this
query alone.
