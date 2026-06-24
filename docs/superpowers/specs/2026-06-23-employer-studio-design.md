# Employer Studio — Design

**Date:** 2026-06-23
**Status:** Approved (autonomous build per directive)

## Goal

TechCoach AI is today a job-seeker-only product. Add the **employer side**: let a
company create/edit company profiles and job listings, with **AI assistance
throughout** (generate job descriptions, company copy, inline polish, promo
content), and **pay to boost** a listing so it gets featured — including being
surfaced to job seekers.

Scope decisions (from the requester):

- **Separate employer role** — a real `account_type` (`'seeker' | 'employer'`),
  chosen during onboarding, that gates the UI.
- **Promote** = AI promo assets + a `draft | published | closed` status + a paid boost.
- **Boost payment = simulated checkout** — the full flow (tier selection, expiry,
  order record) but no real charge. `boostListing()` is the single seam a real
  Stripe Checkout + webhook would later replace.
- **Boost perks (all four):** featured rank within the studio, promotion on the
  seeker side (a "Featured opportunities" lane in the job feed), an AI-enhanced
  promo pack, and a time-limited highlight (expiry via `boosted_until`).
- **AI features (all four):** job description from a brief, company-profile copy,
  inline "improve with AI", and promo-content generation.

## Current state (what already exists)

- AI path: `src/services/geminiService.ts` → `generateWorkflowData(systemInstruction,
  prompt, model, enableSearch)` → gateway (`server.ts` dev / `supabase/functions/ai-generate`
  prod) → Gemini. Models in `src/config/models.ts`. Inline-edit precedent:
  `rewriteResumeSelection`, `improveSurveyAnswer` (+ `cleanAnswerText`).
- Navigation: `src/components/Sidebar.tsx` (`ViewId`, `WorkflowId`, `navGroups`);
  `src/App.tsx` hash routing + `STATIC_VIEWS` + lazy views; rich CRUD workspaces
  (e.g. `JobPostingsWorkspace`) are static views with optimistic data hooks
  (`useJobPostings`) and snake↔camel mappers, scoped by `user_id`.
- Per-owner RLS pattern: `auth.uid() = user_id and public.session_aal_ok(public.current_user_mfa_enrolled())`.
- `supabase/lib/supabaseClient.ts` does **not** use the generated `Database`
  generic, and `supabase/types.ts` is not imported in `src/`, so new tables do not
  block `tsc`. Regenerating `supabase/types.ts` remains a follow-up once the DB is
  applied, but is not required for the app to compile/run.
- The existing `company_profiles` (reference data) and `job_postings` (seeker's
  tracked applications) tables are **not** modified or repurposed.

## Design

### Data model (two migrations)

1. `..._add_account_type.sql` — `alter table profiles add column account_type text
   not null default 'seeker' check (account_type in ('seeker','employer'))`. The
   default backfills existing rows; `handle_new_user` needs no change.
2. `..._add_employer_studio.sql` — three employer tables (`employer_company_profiles`,
   `employer_job_listings`, `employer_boost_orders`), per-owner RLS reusing
   `session_aal_ok(current_user_mfa_enrolled())`, the shared `set_updated_at`
   trigger, and one **extra** cross-user SELECT policy on `employer_job_listings`
   so seekers can read `published` + unexpired-boost rows for the featured lane.

`employer_job_listings.company_id` → `employer_company_profiles(id) on delete cascade`.
Boost state lives on the listing (`boosted_until`, `boost_tier`); each purchase also
writes an `employer_boost_orders` row (the ledger).

### AI service — `src/services/employerService.ts`

Thin wrappers over `generateWorkflowData`, with exported pure prompt builders for
testability and a local `cleanText()` (copied from `cleanAnswerText`):

- `generateJobDescription(brief)` → `{ description, requirements, responsibilities }` (QUALITY, JSON)
- `generateCompanyCopy(field, company)` → `string` (FAST)
- `rewriteEmployerField(selected, instruction, context)` → `string` (FAST) — analog of `rewriteResumeSelection`
- `generatePromoAssets(listing)` → `{ socialPost, outreachEmail, blurb }` (FAST, JSON)
- `generateBoostedPromoPack(listing)` → richer multi-channel pack (QUALITY, JSON) — boost-only

All prompts forbid inventing facts/metrics (bracketed placeholders instead).

### UI — `src/components/EmployerStudio/`

Standalone static view (CRUD), modeled on `JobPostingsWorkspace`. Components:
`index.tsx` (dashboard: companies + listings + boost stats), `CompanyProfileEditor`,
`JobListingEditor` (generate-from-brief), `PromoteDrawer` (promo assets + status +
boost), `BoostCheckoutModal` (simulated), and `AIFieldButton` (inline assist distilled
from `SurveyTextField`'s accept/reject UX).

Hooks: `useEmployerProfiles`, `useEmployerListings(companyId?)` (+ `boostListing`),
and the seeker-side read-only `useFeaturedListings`.

### Gating + onboarding

`account_type` flows through `UserProfile.accountType` and `profileMapper`. A new
`AccountTypeStep` in the onboarding wizard sets it. `Sidebar` branches `navGroups`
on `profile.accountType === 'employer'`; `App` renders `EmployerStudio` for the
`employer_studio` view and defaults employers into it.

### Seeker-side surfacing

`JobPostingsWorkspace` gains a "Featured opportunities" lane fed by
`useFeaturedListings()`; saving one maps it to a `NewPosting` (`source: 'employer'`)
through the existing `addPosting`. No change to the `job_postings` schema.

## Testing

Vitest, pure helpers only (no network/AI): snake↔camel mappers, `isBoostActive`,
featured filter/sort, prompt builders, `cleanText`, `validateListingDraft`.

## Out of scope

Real payment processing, employer↔seeker messaging, applicant tracking, multi-user
company teams, regenerating `supabase/types.ts` (follow-up on DB apply).

## Migrations to apply

> The repo write-protects `supabase/migrations/**` (so applied migrations are never
> edited). The two migrations below could not be written into that directory from
> this session; copy each fenced block into the named file under
> `supabase/migrations/` (or recreate via the `/new-migration` skill with approval),
> then apply and regenerate `supabase/types.ts`. The application code does not depend
> on `supabase/types.ts`, so it compiles/runs without it, but the tables are required
> at runtime.

### `supabase/migrations/20260623000000_add_account_type.sql`

```sql
-- Employer Studio, part 1: account type.
-- Existing rows default to 'seeker'; handle_new_user is unchanged.
alter table public.profiles
  add column if not exists account_type text not null default 'seeker';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_account_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_account_type_check
      check (account_type in ('seeker', 'employer'));
  end if;
end $$;
```

### `supabase/migrations/20260623000001_add_employer_studio.sql`

Three employer-owned tables with per-owner RLS (reusing `session_aal_ok(current_user_mfa_enrolled())`
and `set_updated_at`), plus one extra cross-user SELECT policy so seekers can read
`published` + unexpired-boost listings. Full SQL is staged in the build scratchpad
at `migrations/20260623000001_add_employer_studio.sql` and summarized in §"Data model"
above — key shape:

```sql
create table if not exists public.employer_company_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null, tagline text, website text, industry text, size text,
  headquarters text, logo_url text, about text, mission text, culture text,
  benefits text, extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employer_job_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.employer_company_profiles (id) on delete cascade,
  title text not null, location text, employment_type text, remote boolean,
  seniority text, salary_min int, salary_max int, salary_currency text not null default 'USD',
  description text, requirements text, responsibilities text,
  status text not null default 'draft',
  boosted_until timestamptz, boost_tier text,
  promo_assets jsonb not null default '{}'::jsonb, extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint employer_job_listings_status_check check (status in ('draft','published','closed'))
);

create table if not exists public.employer_boost_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.employer_job_listings (id) on delete cascade,
  tier text not null, days int not null, amount_cents int not null,
  currency text not null default 'USD', status text not null default 'paid',
  created_at timestamptz not null default now(), expires_at timestamptz
);

-- RLS: owner CRUD on all three (auth.uid() = user_id AND session_aal_ok(...)),
-- PLUS on employer_job_listings:
create policy "employer_job_listings: public featured read"
  on public.employer_job_listings for select to authenticated
  using (status = 'published' and boosted_until is not null and boosted_until > now());
```
