# Deterministic Company Profiles — Design

**Date:** 2026-06-09
**Status:** Approved (autonomous build per `/goal` directive)

## Goal

Replace AI-grounded company research with a **reliable, non-AI method** that fetches
company data from structured public sources, builds a profile for a **defined list**
of companies, and **regularly updates** it. Users can **request** a company be added;
that kicks off a **routine workflow** which follows the method to fetch the data and
**opens a PR** that pushes the data into the DB (review-gated).

## Why (problem with the current approach)

The current `company_research_cache` is filled by Gemini with Google-Search grounding
(`researchCompanyProfile`/`researchCompanyNews`). It can hallucinate, drift, return
inconsistent shapes, and depends on paid model quota. We want deterministic, citeable,
reproducible data with a human-review gate before it lands in the DB.

## Data sources (free, keyless, structured)

| Field group | Source | Endpoint |
|---|---|---|
| Overview / description / logo | Wikipedia REST summary | `en.wikipedia.org/api/rest_v1/page/summary/{title}` |
| Key facts (founded, HQ, industry, employees, CEO, website, ticker) | Wikidata | `wikidata.org/w/api.php` (`wbsearchentities` + `wbgetentities`) |
| Financials (revenue, net income, assets — with period dates) | SEC EDGAR | `sec.gov/files/company_tickers.json` → `data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json` |
| Recent news (headline, date, link) | Google News RSS | `news.google.com/rss/search?q={company}` |
| Ratings | **links only** (Glassdoor/Indeed/Blind search URLs) | reused from `companyResearchSources.ts` |

**Ratings note:** Glassdoor/Indeed/Blind expose no free structured API; scraping
violates their ToS. So the deterministic method provides verified rating **links**, not
scores. (Scores remain available only via the legacy AI path, which this method does not use.)

All HTTP goes through a small `httpGet` helper (injectable for tests) and sends a
descriptive `User-Agent` (SEC requires one).

## Data model

Source of truth is **committed JSON** (the thing the PR changes); the DB mirrors it.

- Repo files:
  - `data/companyProfiles/_list.json` — the defined list (`{ slug, name, ticker?, wikidataTitle? }[]`), seeded from `POPULAR_COMPANIES`.
  - `data/companyProfiles/<slug>.json` — one assembled `CompanyProfile` per company (committed; this is what a PR adds/updates).
- DB tables (migration):
  - `company_profiles (slug pk, name, data jsonb, sources jsonb, updated_at, fetched_at)` — RLS: authenticated read; writes only via service-role sync.
  - `company_profile_requests (id, user_id, company text, status, created_at)` — users insert pending requests (RLS: insert/select own); the build routine reads pending ones.

## Components (each independently testable)

1. `src/types/companyProfile.ts` — `CompanyProfile`, `ProfileSource`, `FinancialMetric`, `NewsItem`, `KeyFacts`. Shared by app + scripts.
2. `scripts/company-profiles/sources/` — one module per source, each `(name, deps) => Promise<Partial<...>>`, pure given an injected `httpGet`:
   - `wikipedia.ts`, `wikidata.ts`, `sec.ts`, `news.ts`.
3. `scripts/company-profiles/buildProfile.ts` — compose sources into a `CompanyProfile`, attaching provenance + `fetchedAt`. Tolerant: a failing source degrades that section, never the whole profile.
4. `scripts/company-profiles/build.ts` — runner: load `_list.json` + pending DB requests, build each profile, write `<slug>.json`, refresh `_list.json`. Concurrency-limited; respectful delays for SEC.
5. `scripts/company-profiles/sync.ts` — read committed `<slug>.json` files, upsert into `company_profiles` (service role). The "push into DB" step.
6. `.github/workflows/company-profiles-build.yml` — `schedule` (weekly) + `workflow_dispatch` + `repository_dispatch(type=company-profile-request)`. Runs `build`, then opens a PR via `peter-evans/create-pull-request`.
7. `.github/workflows/company-profiles-sync.yml` — `on: push: branches[main], paths: data/companyProfiles/**`. Runs `sync` against Supabase (service-role secret). Merging the build PR pushes data into the DB.
8. App wiring:
   - `src/services/companyProfileService.ts` — `getCompanyProfile(name)` reads `company_profiles` (canonicalized slug) first.
   - `WorkflowView` Research Company flow: prefer the deterministic profile; fall back to the existing AI cache only when none exists. Render deterministic profiles with the existing `companyResearch/` viz (mapping `CompanyProfile` → `CompanyResearchResult`).
   - "Request a profile" UI (when no profile exists) → inserts into `company_profile_requests` (RPC) and optionally fires `repository_dispatch` via a thin edge function `request-company-profile`.

## Flow

```
User requests "Acme"
   → company_profile_requests row (pending)
   → (optional) edge fn fires repository_dispatch
Routine (weekly cron OR dispatch)
   → build.ts reads list + pending requests
   → deterministic fetch (Wikipedia/Wikidata/SEC/News)
   → writes data/companyProfiles/acme.json
   → opens PR
Human reviews & merges PR
   → push to main triggers sync.yml
   → sync.ts upserts company_profiles rows
App
   → getCompanyProfile("Acme") → instant, reliable DB hit (no AI)
```

## Testing

- Unit (Vitest), HTTP mocked via injected `httpGet`:
  - each source parser (Wikipedia summary, Wikidata claims, SEC companyfacts XBRL, Google News RSS) against captured fixtures;
  - `buildProfile` degradation (one source throws → profile still assembles);
  - `slugify`/request-selection helpers;
  - `sync` upsert payload shaping (mock Supabase client).
- `tsc`, `npm run build`, and preview of the read-path + request UI.

## Out of scope / honest limits

- Live execution of the GitHub Actions and live external API calls can't run in this
  sandbox; workflows are authored to the established repo conventions and the Node
  logic they invoke is unit-tested with mocked HTTP.
- Rating **scores** (no free API) — links only.
- We keep the legacy AI path as a fallback for companies with no deterministic profile yet.
