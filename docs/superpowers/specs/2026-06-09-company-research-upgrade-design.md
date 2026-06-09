# Company Research Upgrade — Design

**Date:** 2026-06-09
**Status:** Approved (autonomous build per `/goal` directive)

## Goal

Upgrade the existing **Research Company** workflow on three axes:

1. **Design & UX** — replace the plain text/bullet cards with a presentable layout: visualizations, icons, animations.
2. **DB-seeded popular companies** — Fortune 100 + popular companies have research data saved in the shared DB cache so we minimize AI calls.
3. **Multi-source ratings** — pull employer ratings from Glassdoor, Indeed, Blind, Comparably, AmbitionBox, etc.

## Current state (what already exists)

- Workflow `company_research` in `src/config/workflows.ts`.
- `src/services/geminiService.ts` — `researchCompanyProfile` (overview, hiringValues, benefits, financials) and `researchCompanyNews` (news), both grounded via the AI gateway with Google Search. Sources cited from real retrieved URLs; the prompts forbid inventing figures/URLs.
- Two-tier shared cache: `src/config/companyResearchCache.ts` + Supabase table `company_research_cache` + security-definer RPC `upsert_company_research_cache` + localStorage. Stale-while-revalidate. Keyed `"<kind>:<normalized company>"`, kinds `profile` (~45d TTL) and `news` (~2d TTL).
- UI: `src/components/CompanyResearchViz.tsx` — plain cards with bullet lists and source chips. Orchestrated by `src/components/WorkflowView.tsx` (`runCompanyResearch`).
- Fallback verification links: `src/config/companyResearchSources.ts`.
- Reusable company list: `SP500_COMPANIES` in `src/lib/profileOptions.ts`.

Available deps for the UI: `motion` (Framer Motion), `recharts`, `lucide-react`, Tailwind v4.

## Design

### Part 3 — Multi-source ratings (data layer; built first)

Approach: extend the **existing grounded profile call** (no extra AI call — serves goal #2's cost-control spirit). The model already searches careers/culture pages; we add a `ratings` block to the same JSON.

New type in `geminiService.ts`:

```ts
export interface CompanyRating {
  source: string;        // "Glassdoor" | "Indeed" | "Blind" | "Comparably" | "AmbitionBox" | ...
  score: number;         // e.g. 4.1
  scale: number;         // e.g. 5
  reviewCount?: number;  // e.g. 18432
  url: string;           // real source URL
  asOf?: string;         // date stamp when known
}
```

- Add `ratings: CompanyRating[]` and optional `ratingsSummary?: string` to `CompanyProfileData` and `CompanyResearchResult`.
- Update `COMPANY_PROFILE_SYSTEM` to request ratings from the named sources, real & search-grounded, date-stamped, with URLs; **omit any source without a found rating — never invent**.
- New `normalizeRatings(raw)` helper: keep only entries with a finite `score`, a positive `scale`, and a non-empty `url`; clamp score to `[0, scale]`; coerce `reviewCount` to a non-negative int or drop it. Defensive against truncated/garbage JSON.
- `assembleCompanyResearch` passes `profile.ratings ?? []` through (old cached entries lacking ratings stay valid; they show no ratings panel until revalidated).

### Part 2 — DB-seeded popular companies

The shared cache already dedupes across users. Two additions:

1. **Alias canonicalization** — `src/data/popularCompanies.ts`:
   - `POPULAR_COMPANIES: PopularCompany[]` ( `{ name, aliases?, ticker? }` ) seeded from `SP500_COMPANIES` plus popular private/tech names.
   - `canonicalCompanyName(input): string` — maps an alias (case/space-insensitive) to its canonical name; otherwise returns the trimmed input. Pure + unit-tested.
   - Wire into `companyResearchCache.ts` `normCompany` so e.g. "Google" and "Alphabet" share one cache entry → fewer AI calls and consistent hits.

2. **Operator seed script** — `scripts/seedCompanyResearch.ts` (npm `seed:companies`): iterate `POPULAR_COMPANIES`, and for any company whose shared-cache `profile`/`news` tiers are missing or stale, run the existing research functions and persist via the RPC. Idempotent (skips fresh). Pre-warms the shared cache so the first end-user gets an instant hit. Network/credential wiring documented; the "which companies need work" selection logic is pure + unit-tested.

Data correctness: we do **not** hand-author company figures/ratings (that would violate the no-fabrication rule). Only the company *list* (public names/tickers/aliases) is static; all research data is grounded by the same pipeline.

### Part 1 — Redesigned UX

Split `CompanyResearchViz.tsx` into `src/components/companyResearch/`:

- `index.tsx` (`CompanyResearchViz`) — orchestrates layout, copy/refresh/reset actions, cached badge, revalidating indicator. Keeps the existing props contract.
- `RatingsPanel.tsx` — composite **rating ring** (recharts `RadialBarChart`) showing the average normalized score with an animated count-up, plus per-source animated horizontal bars (motion width animation), each with a source-colored icon, score `x/scale`, review count, and external link. Hidden when no ratings.
- `ValueTags.tsx` — hiring-values bullets rendered as staggered pill/tag chips with an icon.
- `BenefitsGrid.tsx` — benefits bullets mapped to an icon grid (keyword→icon: health, equity/stock, remote, learning, parental, retirement/401k, PTO, wellness; fallback `Gift`).
- `NewsTimeline.tsx` — news bullets as a vertical timeline with date markers.
- `FinancialsCard.tsx` — financial bullets parsed on `—`/`-` into stat chips (metric / value / period) with a trend icon; falls back to bullets if unparseable.
- `SectionShell.tsx` + small shared bits (`MentorCard`, `SourceChips`) — shared card chrome.
- Entrance: `motion` staggered fade/slide. Loading: skeleton cards (replace the bare spinner in `WorkflowView`).

All colors via existing CSS vars (`--card`, `--border`, `--primary`, etc.) to respect theme/dark mode. No new runtime deps.

## Testing

- Unit (Vitest): `normalizeRatings` (drops invalid, clamps, coerces), `canonicalCompanyName` (alias→canonical, passthrough, case/space), seed-selection logic (stale/missing detection).
- Manual/preview: render the redesigned viz with mock data; verify charts, animations, dark mode, and graceful empty states (no ratings, no news).

## Out of scope

- Scraping rating sites directly (keyless/grounded approach is the architecture; headless Chromium is reserved for LinkedIn screenshots in a Vercel Node function).
- Auto-deploying the seed cron (the script is operator-run; a cron can be added later mirroring `suggested_postings_cron`).
