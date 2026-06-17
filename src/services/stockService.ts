import { supabase } from "@/lib/supabaseClient";
import { tickerForCompany } from "@/data/popularCompanies";

// Stock-price history for the Research Company financials chart. Backed by the
// keyless `stock-history` Edge Function (Yahoo Finance). A short localStorage
// cache keeps repeat views instant and avoids re-hitting the function.

// Derive the endpoint from the AI gateway URL, like blsService — so it resolves
// to the local Express gateway in dev (/api/ai/generate → /api/stock-history)
// and the Supabase Edge Function in prod (/functions/v1/ai-generate → …).
const STOCK_PROXY_URL = ((import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000/api/ai/generate")
  .replace(/\/api\/ai\/generate\/?$/, "/api/stock-history")
  .replace(/\/functions\/v1\/ai-generate\/?$/, "/functions/v1/stock-history");

const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

const LS_PREFIX = "stockhist:";
const TTL_MS = 12 * 60 * 60 * 1000; // prices move daily; half-day cache is plenty
const INTRADAY_TTL_MS = 5 * 60 * 1000; // intraday windows move minute-to-minute

/**
 * Selectable chart windows. The actual Yahoo `range`/`interval` pair lives
 * server-side (allowlisted) — here we only carry the key, a short label for the
 * switcher, and whether the window is intraday (drives axis/tooltip formatting).
 */
export const STOCK_RANGES = [
  { key: "1D", label: "1D", intraday: true },
  { key: "1W", label: "1W", intraday: true },
  { key: "1M", label: "1M", intraday: false },
  { key: "3M", label: "3M", intraday: false },
  { key: "6M", label: "6M", intraday: false },
  { key: "1Y", label: "1Y", intraday: false },
  { key: "5Y", label: "5Y", intraday: false },
  { key: "MAX", label: "MAX", intraday: false },
] as const;

export type StockRange = (typeof STOCK_RANGES)[number]["key"];

export const DEFAULT_STOCK_RANGE: StockRange = "1Y";

export function isIntradayRange(range: StockRange): boolean {
  return STOCK_RANGES.find((r) => r.key === range)?.intraday ?? false;
}

export interface StockPoint {
  date: string; // YYYY-MM-DD for daily+ windows; full ISO datetime for intraday
  close: number;
}
export interface StockHistory {
  ticker: string;
  currency: string;
  points: StockPoint[];
}

/** Resolve a company name to its ticker (curated list). Re-exported for callers. */
export { tickerForCompany };

function cacheKey(ticker: string, range: StockRange): string {
  return `${LS_PREFIX}${ticker}:${range}`;
}

function readCache(ticker: string, range: StockRange): StockHistory | null {
  try {
    const raw = localStorage.getItem(cacheKey(ticker, range));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: StockHistory; ts: number };
    const ttl = isIntradayRange(range) ? INTRADAY_TTL_MS : TTL_MS;
    if (!parsed?.ts || Date.now() - parsed.ts > ttl) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(ticker: string, range: StockRange, data: StockHistory): void {
  try {
    localStorage.setItem(cacheKey(ticker, range), JSON.stringify({ data, ts: Date.now() }));
  } catch {
    /* quota / unavailable — non-fatal */
  }
}

/**
 * Fetch price history for a ticker over the given window (default 1Y). Returns
 * null on any failure (private company, unknown symbol, function unavailable) so
 * callers can simply hide the chart rather than surface an error.
 */
export async function fetchStockHistory(
  ticker: string,
  range: StockRange = DEFAULT_STOCK_RANGE,
): Promise<StockHistory | null> {
  const symbol = ticker.trim().toUpperCase();
  if (!/^[A-Z][A-Z.\-]{0,9}$/.test(symbol)) return null;

  const cached = readCache(symbol, range);
  if (cached) return cached;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const res = await fetch(STOCK_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ticker: symbol, range }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as StockHistory;
    if (!data?.points || data.points.length < 2) return null;
    writeCache(symbol, range, data);
    return data;
  } catch {
    return null;
  }
}
