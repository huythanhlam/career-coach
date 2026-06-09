/**
 * localStorage cache for Research Company results — the cost-control layer that
 * keeps live-search usage within the free grounding quota.
 *
 * Keyed on the COMPANY NAME ONLY: the grounded sections (hiring values, benefits,
 * news, financials) are company-level, so researching the same company for a
 * different role reuses the cached result instead of spending another search.
 * Entries older than TTL_DAYS are treated as stale. (A shared cross-user Supabase
 * tier, like `market_data_cache`, is a possible later extension.)
 */
import type { CompanyResearchResult } from "@/services/geminiService";

const TTL_DAYS = 7; // news/earnings stale faster than market-comp data
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;
const LS_PREFIX = "crcache:";

export interface CachedCompanyResearch {
  data: CompanyResearchResult;
  cachedAt: string; // ISO timestamp
}

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Stable key from the company name alone. */
export function companyResearchCacheKey(parts: { companyName: string }): string {
  return norm(parts.companyName);
}

function isFresh(ts: string): boolean {
  return Date.now() - new Date(ts).getTime() < TTL_MS;
}

/** Fresh cached entry for this company, or null on miss/stale/unavailable. */
export function getCachedCompanyResearch(key: string): CachedCompanyResearch | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCompanyResearch;
    if (!parsed?.cachedAt || !isFresh(parsed.cachedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist a freshly researched result for this company. */
export function putCachedCompanyResearch(key: string, data: CompanyResearchResult): string {
  const cachedAt = new Date().toISOString();
  if (!key) return cachedAt;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, cachedAt }));
  } catch {
    /* quota / unavailable — non-fatal */
  }
  return cachedAt;
}
