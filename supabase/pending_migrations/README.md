# Pending migrations

These migrations back new features. They are staged here because this repo
write-protects `supabase/migrations/**` in `.claude/settings.json`. **A human
must apply them.**

---

## Employer Studio (PR #59)

Two migrations that create the tables the Employer Studio needs. **Without these
applied, creating a company/listing fails.**

```bash
mv supabase/pending_migrations/20260623000000_add_account_type.sql      supabase/migrations/
mv supabase/pending_migrations/20260623000001_add_employer_studio.sql   supabase/migrations/
supabase db push          # or: supabase migration up
```

Or paste each file's contents (in order) into the Supabase Dashboard → SQL
Editor and run them.

After applying, optionally regenerate types:

```bash
supabase gen types typescript --linked > supabase/types.ts
```

### What they add
- `20260623000000_add_account_type.sql` — `profiles.account_type` (`'seeker'|'employer'`, default `'seeker'`).
- `20260623000001_add_employer_studio.sql` — `employer_company_profiles`,
  `employer_job_listings`, `employer_boost_orders` with per-owner RLS plus one
  public SELECT policy so seekers can read published, boosted listings.

They rely on `public.set_updated_at()`, `public.session_aal_ok()`, and
`public.current_user_mfa_enrolled()`, which already exist from earlier migrations.

---

## AI-forward differentiating features (PR #61)

Three migrations back the Networking Agent, Negotiation Roleplay, and Application
Autopilot features. Apply **after** the Employer Studio migrations above.

```bash
mv supabase/pending_migrations/20260623000003_add_outreach_contacts.sql      supabase/migrations/
mv supabase/pending_migrations/20260623000004_add_negotiation_sessions.sql   supabase/migrations/
mv supabase/pending_migrations/20260623000005_add_application_packages.sql   supabase/migrations/
supabase db push
```

After applying, regenerate types — **do not hand-edit** `supabase/types.ts`:

```bash
supabase gen types typescript --project-id <id> > supabase/types.ts
```

### What they add
- `20260623000003_add_outreach_contacts.sql` — Networking & Referral tracker
- `20260623000004_add_negotiation_sessions.sql` — Negotiation roleplay history
- `20260623000005_add_application_packages.sql` — Autopilot review-and-approve queue

### RLS
Each table uses the same per-owner + MFA-step-up policy template as
`job_postings` / `interview_sessions`, reusing the existing
`public.session_aal_ok(public.current_user_mfa_enrolled())` helper. Verify
isolation after applying: querying any of these tables as a different user must
return zero rows.
