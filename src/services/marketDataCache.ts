/**
 * Caching layer for AI-generated market compensation data.
 *
 * Two tiers: a localStorage layer for instant repeat lookups on the same device,
 * and a shared Supabase table (`market_data_cache`) so common role/location
 * combos build into a reusable dataset across users and aren't re-fetched from
 * the LLM every time. Entries older than TTL_DAYS are treated as stale.
 */
import { supabase } from "@/lib/supabaseClient";
import { normalizeLocation } from "@/lib/locations";
import type { MarketCompData } from "@/components/MarketCompensationViz";

const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;
const LS_PREFIX = "mdcache:";

export interface MarketCacheParts {
  role: string;
  location: string;
  secondaryLocation?: string;
  yoe: string;
}

export interface CachedMarket {
  data: MarketCompData;
  cachedAt: string; // ISO timestamp
}

/** Bucket free-text years-of-experience into tiers so near-identical queries share a hit. */
export function yoeToTier(yoe: string | number | undefined): string {
  const n = typeof yoe === "number" ? yoe : parseInt(String(yoe ?? "").replace(/[^0-9.]/g, ""), 10);
  if (!Number.isFinite(n)) return "unknown";
  if (n <= 2) return "0-2";
  if (n <= 5) return "3-5";
  if (n <= 9) return "6-9";
  return "10+";
}

const norm = (s: string | undefined) => (s ?? "").trim().toLowerCase();

/**
 * Build a stable cache key. Locations are canonicalized (so "Austin, TX" and
 * "Austin, Texas" share an entry) and order-normalized (so "SF vs Austin" and
 * "Austin vs SF" resolve to the same entry).
 */
export function marketCacheKey(parts: MarketCacheParts): string {
  const locs = [parts.location, parts.secondaryLocation]
    .map((l) => normalizeLocation(l).toLowerCase())
    .filter(Boolean)
    .sort();
  return `${norm(parts.role)}|${locs.join("+")}|${yoeToTier(parts.yoe)}`;
}

function isFresh(ts: string | number): boolean {
  return Date.now() - new Date(ts).getTime() < TTL_MS;
}

function readLocal(key: string): CachedMarket | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedMarket;
    if (!parsed?.cachedAt || !isFresh(parsed.cachedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(key: string, entry: CachedMarket): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota / unavailable — non-fatal */
  }
}

/**
 * Look up a fresh cached entry: localStorage first (instant), then the shared
 * Supabase table. A Supabase hit warms localStorage. Returns null on miss/stale.
 */
export async function getCachedMarketData(key: string): Promise<CachedMarket | null> {
  const local = readLocal(key);
  if (local) return local;

  try {
    const { data, error } = await supabase
      .from("market_data_cache")
      .select("data, updated_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (error || !data?.updated_at || !isFresh(data.updated_at as string)) return null;
    const entry: CachedMarket = {
      data: data.data as MarketCompData,
      cachedAt: data.updated_at as string,
    };
    writeLocal(key, entry);
    return entry;
  } catch {
    return null;
  }
}

/**
 * Return the cached row's data regardless of age (localStorage then Supabase),
 * without the freshness gate. Used to reuse still-valid BLS bands across AI
 * regenerations (BLS data updates ~annually, so it needn't be re-fetched on the
 * AI's 30-day cycle).
 */
export async function getStaleRow(key: string): Promise<MarketCompData | null> {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw) {
      const parsed = JSON.parse(raw) as CachedMarket;
      if (parsed?.data) return parsed.data;
    }
  } catch {
    /* ignore */
  }
  try {
    const { data } = await supabase
      .from("market_data_cache")
      .select("data")
      .eq("cache_key", key)
      .maybeSingle();
    return (data?.data as MarketCompData) ?? null;
  } catch {
    return null;
  }
}

/** Upsert a freshly generated result into both the shared table and localStorage. */
export async function putCachedMarketData(
  key: string,
  parts: MarketCacheParts,
  data: MarketCompData,
): Promise<void> {
  const cachedAt = new Date().toISOString();
  writeLocal(key, { data, cachedAt });

  try {
    // Writes go through a security-definer RPC (validates + bounds the payload)
    // rather than a direct table upsert, so a client can't poison the shared
    // cache with arbitrary rows. Reads remain a plain SELECT.
    await supabase.rpc("upsert_market_data_cache", {
      p_cache_key: key,
      p_role: parts.role,
      p_location: normalizeLocation(parts.location),
      p_secondary_location: parts.secondaryLocation
        ? normalizeLocation(parts.secondaryLocation) || null
        : null,
      p_yoe_tier: yoeToTier(parts.yoe),
      p_data: data,
    });
  } catch {
    /* offline / RLS — localStorage still serves this device */
  }
}
