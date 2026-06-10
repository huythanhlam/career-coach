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
| Employee ratings | **Blind** (real score scraped) + links | see below |

### Employee ratings

We scrape the real score **directly from sites that serve it openly** — no AI, no
bot-detection bypass. Blind embeds a schema.org `EmployerAggregateRating` in its
company page, so `sources/ratings.ts` fetches and parses it (e.g. 3M = 3.3/5, 98
reviews). The parser is generic, so any site exposing an `AggregateRating` is
picked up automatically.

Glassdoor, Indeed, and Comparably gate behind a human-verification/CAPTCHA wall
(they return a "prove you're human" page, not the rating). We do **not** scrape
those — getting past the wall would mean defeating bot-detection. They remain
links only. Ratings refresh on the same weekly cadence as everything else.

Every section is isolated: a source that fails or returns nothing degrades only
that section (recorded in `notes`), never the whole profile.

## Two tracks

**1. Weekly refresh of companies already in the app → straight to the DB (no PR).**
These companies are already vetted, so the routine fetches and upserts directly.

```
data/companyProfiles/_list.json   ← the defined list
        │  refresh.ts (fetch + upsert)
        ▼
company_profiles table            ← what the app reads (reliable, instant)
```

**2. Adding a NEW company → reviewed via PR.**
A user request (or manual dispatch) builds the profile to committed JSON and
opens a PR; merging syncs it into the DB.

```
company_profile_requests / dispatch
        │  build.ts (fetch → write JSON) → PR
        ▼  (review & merge)
data/companyProfiles/<slug>.json
        │  sync.ts (on push to main)
        ▼
company_profiles table
```

## Commands

```bash
# Track 1 — fetch + store directly in the DB (the weekly refresh)
npm run profiles:refresh                          # refresh every company already in the app
npm run profiles:refresh -- --only apple,microsoft
npm run profiles:refresh -- --limit 40            # cron batching
npm run profiles:refresh -- --dry-run             # fetch + print, don't write

# Track 2 — build committed JSON for review via PR (adding new companies)
npm run profiles:seed-list                        # regenerate _list.json from POPULAR_COMPANIES
npm run profiles:build                            # build every listed company (+ pending requests) → JSON
npm run profiles:build -- --requests-only         # only pending DB requests
npm run profiles:sync                             # upsert committed JSON into the DB (post-merge)
npm run profiles:sync -- --dry-run
```

## Environment

- `PROFILES_CONTACT_EMAIL` — contact email put in the SEC `User-Agent` (SEC
  returns 403 without one). Defaults to the project owner's email.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — required by `sync.ts` and by
  `build.ts`'s request intake. Without them, `build.ts` still builds the list
  (it just skips reading DB requests).

## Automation

- `.github/workflows/company-profiles-refresh.yml` — **weekly** (Mon 07:00 UTC) +
  manual; runs `refresh` to fetch every listed company and upsert it directly
  into the DB. This is the automatic weekly update.
- `.github/workflows/company-profiles-build.yml` — manual dispatch +
  `repository_dispatch(company-profile-request)`; runs `build` and opens a PR
  (for reviewing new additions).
- `.github/workflows/company-profiles-sync.yml` — on push to `main` under
  `data/companyProfiles/**`; runs `sync` to push merged JSON into the DB.

Set repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
(and optionally `PROFILES_CONTACT_EMAIL`).
