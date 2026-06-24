# Pending migrations — Employer Studio

These two migrations create the tables the Employer Studio needs. They live here
(not in `supabase/migrations/`) only because this repo write-protects
`supabase/migrations/**` in `.claude/settings.json`, which blocks automated tools
from adding them. **Without these applied, creating a company/listing fails** (the
app now shows a clear "tables aren't set up yet" error instead of a false success).

## Apply them

Move both `.sql` files into `supabase/migrations/`, then apply:

```bash
mv supabase/pending_migrations/20260623000000_add_account_type.sql      supabase/migrations/
mv supabase/pending_migrations/20260623000001_add_employer_studio.sql   supabase/migrations/
supabase db push          # or: supabase migration up
```

Or, for a hosted project without the CLI, paste the contents of each file (in
order) into the **Supabase Dashboard → SQL Editor** and run them.

After applying, optionally regenerate types (the app does not depend on this file
at runtime, so it's not required for the feature to work):

```bash
supabase gen types typescript --linked > supabase/types.ts
```

## What they add
- `20260623000000_add_account_type.sql` — `profiles.account_type` (`'seeker'|'employer'`, default `'seeker'`).
- `20260623000001_add_employer_studio.sql` — `employer_company_profiles`,
  `employer_job_listings`, `employer_boost_orders` with per-owner RLS (reusing the
  existing `session_aal_ok(current_user_mfa_enrolled())` helper) plus one public
  SELECT policy so seekers can read published, boosted listings.

They rely on `public.set_updated_at()`, `public.session_aal_ok()`, and
`public.current_user_mfa_enrolled()`, which already exist from earlier migrations.
