# Company Profiles — deterministic data pipeline

A reliable, **non-AI** method to build company profiles from structured public
sources, with a review-gated path into the database.

## The method (sources)

| Section | Source | Notes |
|---|---|---|
| Overview + logo | Wikipedia REST summary | disambiguated via the Wikidata sitelink |
| Key facts (founded, HQ, industry, employees, CEO, website, ticker, country) | Wikidata | CEO = current officeholder (rank `preferred`, no future-dated holders) |
| Financials (revenue, net income, total assets) | SEC EDGAR XBRL | latest 10-K, USD; public US companies only |
| Recent news | Google News RSS | last ~90 days |
| Employee reviews | Glassdoor / Indeed / Blind / Comparably | **links only** — no free score API exists |

Every section is isolated: a source that fails or returns nothing degrades only
that section (recorded in `notes`), never the whole profile.

## Data flow

```
data/companyProfiles/_list.json   ← the defined list (PRs add to it)
        │  build.ts (fetch)
        ▼
data/companyProfiles/<slug>.json  ← committed profiles (a PR changes these)
        │  merge to main → sync.ts
        ▼
company_profiles table            ← what the app reads (reliable, instant)
```

Users request a company in the app → `company_profile_requests` row → the build
routine picks it up → opens a PR → review & merge → sync upserts the DB.

## Commands

```bash
npm run profiles:seed-list                      # regenerate _list.json from POPULAR_COMPANIES
npm run profiles:build                           # build/refresh every listed company (+ pending requests)
npm run profiles:build -- --only apple,microsoft # specific slugs
npm run profiles:build -- --requests-only        # only pending DB requests
npm run profiles:build -- --limit 20             # cap per run (cron batches)
npm run profiles:sync                            # upsert committed profiles into the DB
npm run profiles:sync -- --dry-run               # preview without writing
```

## Environment

- `PROFILES_CONTACT_EMAIL` — contact email put in the SEC `User-Agent` (SEC
  returns 403 without one). Defaults to the project owner's email.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — required by `sync.ts` and by
  `build.ts`'s request intake. Without them, `build.ts` still builds the list
  (it just skips reading DB requests).

## Automation

- `.github/workflows/company-profiles-build.yml` — weekly + manual +
  `repository_dispatch(company-profile-request)`; runs `build`, opens a PR.
- `.github/workflows/company-profiles-sync.yml` — on push to `main` under
  `data/companyProfiles/**`; runs `sync` to push the merged data into the DB.

Set repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
