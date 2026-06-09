/**
 * Shared shape for a DETERMINISTIC company profile — built from structured public
 * sources (Wikipedia, Wikidata, SEC EDGAR, Google News RSS), never from an LLM.
 *
 * This is the contract between three places:
 *   - the fetch pipeline (`scripts/company-profiles/*`) that produces it,
 *   - the committed JSON files (`data/companyProfiles/<slug>.json`) and DB rows,
 *   - the app, which renders it in the Research Company workspace.
 *
 * Every section carries its own provenance so the UI can cite exactly where each
 * fact came from and when it was fetched.
 */

/** A citeable source for a section of the profile. */
export interface ProfileSource {
  label: string;
  url: string;
  /** Which fetcher produced it — useful for debugging/auditing. */
  provider: "wikipedia" | "wikidata" | "sec" | "news" | "links";
}

/** A single financial metric with the period it covers. */
export interface FinancialMetric {
  /** Human label, e.g. "Revenue", "Net income", "Total assets". */
  label: string;
  /** Raw numeric value in `unit` (e.g. USD). */
  value: number;
  /** Currency / unit, e.g. "USD". */
  unit: string;
  /** Fiscal period end (ISO date) the value is reported for. */
  periodEnd: string;
  /** Fiscal year, when known. */
  fiscalYear?: number;
  /** Form the figure came from, e.g. "10-K", "10-Q". */
  form?: string;
}

/** One recent news item. */
export interface NewsItem {
  title: string;
  url: string;
  /** Publication date (ISO) when parseable. */
  publishedAt?: string;
  source?: string;
}

/** Structured key facts about the company (mostly from Wikidata). */
export interface KeyFacts {
  /** ISO date or year string for company inception. */
  founded?: string;
  headquarters?: string;
  industry?: string;
  /** Employee headcount (point-in-time, with the year it was reported). */
  employeeCount?: number;
  employeeCountAsOf?: string;
  ceo?: string;
  website?: string;
  ticker?: string;
  /** ISO country code or name of HQ country. */
  country?: string;
}

/** The assembled, deterministic profile for one company. */
export interface CompanyProfile {
  /** URL-safe stable id (lowercase, dashed). */
  slug: string;
  /** Canonical display name. */
  name: string;
  /** Plain-text overview (Wikipedia extract), if found. */
  overview?: string;
  /** Logo / thumbnail URL, if found. */
  logoUrl?: string;
  keyFacts: KeyFacts;
  financials: FinancialMetric[];
  news: NewsItem[];
  /** Deterministic rating *links* (no scores — no free rating API exists). */
  ratingLinks: ProfileSource[];
  /** All sources used, deduped, for a global "sources" list. */
  sources: ProfileSource[];
  /** ISO timestamp the profile was last fetched/assembled. */
  fetchedAt: string;
  /** Per-section notes about what was/wasn't found (for transparency). */
  notes?: string[];
}

/** An entry in the defined list of companies to maintain profiles for. */
export interface CompanyListEntry {
  slug: string;
  name: string;
  ticker?: string;
  /** Explicit Wikipedia/Wikidata page title to disambiguate (e.g. "Apple Inc."). */
  wikidataTitle?: string;
}
