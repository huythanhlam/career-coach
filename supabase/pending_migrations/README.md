# Pending migrations — product-differentiation features

These three migrations back the new AI-forward features (Networking Agent,
Negotiation Roleplay, Application Autopilot). They are staged here because the
agent tooling cannot write directly into `supabase/migrations/` (a deliberate
guardrail). **A human must apply them.**

## What to do

1. Move each file into `supabase/migrations/` (keep the timestamped names):
   - `20260623000000_add_outreach_contacts.sql` — Networking & Referral tracker
   - `20260623000001_add_negotiation_sessions.sql` — Negotiation roleplay history
   - `20260623000002_add_application_packages.sql` — Autopilot review-and-approve queue
2. Apply them (e.g. `supabase db push`, or your normal migration flow).
3. Regenerate the generated types — **do not hand-edit** `supabase/types.ts`:
   ```
   supabase gen types typescript --project-id <id> > supabase/types.ts
   ```
   (The app compiles without this step because `src/lib/supabaseClient.ts` is
   not typed with the `Database` generic, but regenerating keeps types honest
   for future work.)

## RLS

Each table uses the same per-owner + MFA-step-up policy template as
`job_postings` / `interview_sessions`, reusing the existing
`public.session_aal_ok(public.current_user_mfa_enrolled())` helper. Verify
isolation after applying: querying any of these tables as a different user must
return zero rows.
