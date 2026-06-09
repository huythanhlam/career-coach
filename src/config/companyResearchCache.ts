/**
 * Two-tier cache for Research Company — the cost-control layer that keeps
 * live-search usage low.
 *
 * Keyed on "<kind>:<normalized company>". Data is split by volatility so the
 * expensive evergreen tier is reused for weeks while only the fast tier is
 * refreshed:
 *   - "profile" (hiring values + benefits + financials): TTL_PROFILE
 *   - "news":                                            TTL_NEWS
 *
 * Two storage layers, like marketDataCache: localStorage (instant, per-device)
 * and a shared Supabase table (`company_research_cache`) so popular companies
 * are researched once across ALL users. Reads return entries even when stale
 * (with `fresh: false`) so the UI can serve them immediately and revalidate in
 * the background (stale-while-revalidate).
 */
import { supabase } from "@/lib/supabaseClient";
import type { CompanyProfileData, CompanyNewsData } from "@/services/geminiService";

export type CompanyResearchKind = "profile" | "news";

const TTL_MS: Record<CompanyResearchKind, number> = {
  profile: 45 * 24 * 60 * 60 * 1000, // ~quarterly; careers/values/financials move slowly
  news: 2 * 24 * 60 * 60 * 1000,     // news goes stale fast
};

const LS_PREFIX = "crcache:";

type DataFor<K extends CompanyResearchKind> = K extends "profile" ? CompanyProfileData : CompanyNewsData;

export interface CachedEntry<T> {
  data: T;
  cachedAt: string; // ISO timestamp
  fresh: boolean;   // within TTL?
}

const normCompany = (s: string | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function companyResearchCacheKey(company: string, kind: CompanyResearchKind): string {
  return `${kind}:${normCompany(company)}`;
}

function isFresh(ts: string, kind: CompanyResearchKind): boolean {
  return Date.now() - new Date(ts).getTime() < TTL_MS[kind];
}

function readLocal<K extends CompanyResearchKind>(key: string, kind: K): CachedEntry<DataFor<K>> | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: DataFor<K>; cachedAt: string };
    if (!parsed?.cachedAt || !parsed.data) return null;
    return { data: parsed.data, cachedAt: parsed.cachedAt, fresh: isFresh(parsed.cachedAt, kind) };
  } catch {
    return null;
  }
}

function writeLocal(key: string, data: unknown, cachedAt: string): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ data, cachedAt }));
  } catch {
    /* quota / unavailable — non-fatal */
  }
}

/**
 * Look up a cached tier for a company. localStorage first (instant); if that's
 * a miss OR stale, consult the shared Supabase table and keep whichever entry is
 * newer (warming localStorage on a shared hit). Returns the entry even when
 * stale (with `fresh: false`) so callers can serve-then-revalidate. null only on
 * a total miss.
 */
export async function getCachedCompanyResearch<K extends CompanyResearchKind>(
  company: string,
  kind: K
): Promise<CachedEntry<DataFor<K>> | null> {
  const key = companyResearchCacheKey(company, kind);
  const local = readLocal(key, kind);
  if (local?.fresh) return local;

  let shared: CachedEntry<DataFor<K>> | null = null;
  try {
    const { data, error } = await supabase
      .from("company_research_cache")
      .select("data, updated_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (!error && data?.updated_at) {
      shared = { data: data.data as DataFor<K>, cachedAt: data.updated_at as string, fresh: isFresh(data.updated_at as string, kind) };
    }
  } catch {
    /* offline / RLS — fall back to local */
  }

  // Prefer the newer of the two; warm localStorage if the shared copy wins.
  const newest = [local, shared]
    .filter((e): e is CachedEntry<DataFor<K>> => !!e)
    .sort((a, b) => new Date(b.cachedAt).getTime() - new Date(a.cachedAt).getTime())[0] ?? null;
  if (newest && newest === shared) writeLocal(key, shared.data, shared.cachedAt);
  return newest;
}

/** Persist a freshly researched tier to localStorage + the shared table. */
export async function putCachedCompanyResearch<K extends CompanyResearchKind>(
  company: string,
  kind: K,
  data: DataFor<K>
): Promise<string> {
  const key = companyResearchCacheKey(company, kind);
  const cachedAt = new Date().toISOString();
  writeLocal(key, data, cachedAt);
  try {
    // Writes go through a security-definer RPC (validates + bounds the payload)
    // rather than a direct upsert, so a client can't poison the shared cache.
    await supabase.rpc("upsert_company_research_cache", {
      p_cache_key: key,
      p_company: normCompany(company),
      p_kind: kind,
      p_data: data,
    });
  } catch {
    /* offline / RLS — localStorage still serves this device */
  }
  return cachedAt;
}
