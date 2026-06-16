import { supabase } from "@/lib/supabaseClient";
import { tickerForCompany } from "@/data/popularCompanies";

// Daily stock-price history for the Research Company financials chart. Backed by
// the keyless `stock-history` Edge Function (Stooq). A short localStorage cache
// keeps repeat views instant and avoids re-hitting the function.

// Derive the endpoint from the AI gateway URL, like blsService — so it resolves
// to the local Express gateway in dev (/api/ai/generate → /api/stock-history)
// and the Supabase Edge Function in prod (/functions/v1/ai-generate → …).
const STOCK_PROXY_URL = ((import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000/api/ai/generate")
  .replace(/\/api\/ai\/generate\/?$/, "/api/stock-history")
  .replace(/\/functions\/v1\/ai-generate\/?$/, "/functions/v1/stock-history");

const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

const LS_PREFIX = "stockhist:";
const TTL_MS = 12 * 60 * 60 * 1000; // prices move daily; half-day cache is plenty

export interface StockPoint {
  date: string; // YYYY-MM-DD
  close: number;
}
export interface StockHistory {
  ticker: string;
  currency: string;
  points: StockPoint[];
}

/** Resolve a company name to its ticker (curated list). Re-exported for callers. */
export { tickerForCompany };

function readCache(ticker: string): StockHistory | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + ticker);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: StockHistory; ts: number };
    if (!parsed?.ts || Date.now() - parsed.ts > TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(ticker: string, data: StockHistory): void {
  try {
    localStorage.setItem(LS_PREFIX + ticker, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    /* quota / unavailable — non-fatal */
  }
}

/**
 * Fetch ~1 year of daily closes for a ticker. Returns null on any failure
 * (private company, unknown symbol, function unavailable) so callers can simply
 * hide the chart rather than surface an error.
 */
export async function fetchStockHistory(ticker: string): Promise<StockHistory | null> {
  const symbol = ticker.trim().toUpperCase();
  if (!/^[A-Z][A-Z.\-]{0,9}$/.test(symbol)) return null;

  const cached = readCache(symbol);
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
      body: JSON.stringify({ ticker: symbol }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as StockHistory;
    if (!data?.points || data.points.length < 2) return null;
    writeCache(symbol, data);
    return data;
  } catch {
    return null;
  }
}
