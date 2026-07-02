# Pending migrations

These migrations back features whose code is already merged, but they are not
yet applied to the database. They are staged here because this repo
write-protects `supabase/migrations/**` and `supabase/types.ts` in
`.claude/settings.json`: **a human applies them.**

They are numbered to sort **after** the newest applied migration
(`20260624000004_add_admin_audit_log.sql`), so the ordering is correct once
moved.

> **History note (2026-07):** three files that used to sit here —
> `…_add_outreach_contacts.sql`, `…_add_negotiation_sessions.sql`,
> `…_add_application_packages.sql` — were byte-identical duplicates of
> migrations already applied under `20260624000000–02`. They were deleted to
> remove the drift. The two Employer Studio files were renumbered from
> `20260623*` (which collided with the applied `20260623000000_add_blog_posts.sql`
> / `20260623000001_blog_admin.sql`) to `20260625*`.

## How to apply

Move the files into `supabase/migrations/` **in filename order** and push:

```bash
git mv supabase/pending_migrations/20260625000000_add_account_type.sql    supabase/migrations/
git mv supabase/pending_migrations/20260625000001_add_employer_studio.sql supabase/migrations/
git mv supabase/pending_migrations/20260625000002_add_blog_scheduling.sql supabase/migrations/
supabase db push          # or: supabase migration up
```

Or paste each file's contents (in order) into the Supabase Dashboard → SQL
Editor. Every file is idempotent (`add column if not exists`, guarded
constraints), so a partial apply or re-run is safe.

After applying, regenerate types — **do not hand-edit** `supabase/types.ts`:

```bash
supabase gen types typescript --linked > supabase/types.ts
```

`supabase/types.ts` is currently stale (it predates several applied tables and
still lists the superseded `job_applications`); regenerating after this apply
brings it fully in sync.

## What these add

### `20260625000000_add_account_type.sql` — Employer Studio, part 1
`profiles.account_type` (`'seeker'|'employer'`, default `'seeker'`). No backfill
needed; the `handle_new_user` trigger is unchanged.

### `20260625000001_add_employer_studio.sql` — Employer Studio, part 2
`employer_company_profiles`, `employer_job_listings`, `employer_boost_orders`
with per-owner RLS plus one public SELECT policy so seekers can read published,
boosted listings. Relies on `public.set_updated_at()`, `public.session_aal_ok()`,
and `public.current_user_mfa_enrolled()`, which already exist. **Without these,
creating a company/listing in the Studio fails.** Apply part 1 before part 2.

### `20260625000002_add_blog_scheduling.sql` — Blog scheduling
`blog_posts.scheduled_for` + `'scheduled'` added to `blog_posts_status_check`.
The in-app Blog Admin (`schedulePost`/`cancelSchedule` in
`src/services/blogAdminService.ts`, `useBlogPosts` in `src/hooks/useBlogPosts.ts`)
already writes these; without the migration those writes fail the status check.
See the migration's trailing note for the follow-up publisher cron that
auto-publishes due posts.

## Verify after applying

- **Employer tables:** creating a company profile and a listing in the Studio
  succeeds; querying any employer table as a different user returns zero rows
  (per-owner RLS).
- **Blog scheduling:** scheduling a draft in Blog Admin sets `status='scheduled'`
  with a future `scheduled_for`, shows in the admin "scheduled" lane, and is not
  publicly readable until published.
