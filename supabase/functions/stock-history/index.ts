import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeFetchText } from "../_shared/safe-fetch.ts";

// ── Keyless daily stock-price history ──────────────────────────────────────
// Powers the price chart in the Research Company → Financials card. Fetches
// Stooq's free, keyless daily CSV server-side (no CORS, no API key), parses the
// last ~year of closes, downsamples to keep the payload tiny, and caches per
// ticker in-memory so repeated lookups don't re-hit Stooq.

interface StockPoint {
  date: string; // YYYY-MM-DD
  close: number;
}
interface StockHistory {
  ticker: string;
  currency: string;
  points: StockPoint[];
}

const MAX_POINTS = 90; // weekly over a year ≈ 52; cap is just a safety bound
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
// Yahoo blocks the default UA; a browser-like UA is required.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Per-instance cache (Fluid Compute reuses instances across requests).
const cache = new Map<string, { data: StockHistory; ts: number }>();

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function verifyUser(authHeader: string | null) {
  if (!authHeader) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : user;
}

/** Parse a Yahoo Finance v8 chart response → date-ascending closes + currency. */
// deno-lint-ignore no-explicit-any
function parseYahoo(jsonText: string): { points: StockPoint[]; currency: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { points: [], currency: "USD" };
  }
  const r = parsed?.chart?.result?.[0];
  const ts: number[] = Array.isArray(r?.timestamp) ? r.timestamp : [];
  const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
  const currency: string = typeof r?.meta?.currency === "string" ? r.meta.currency : "USD";
  const points: StockPoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c === "number" && Number.isFinite(c) && c > 0) {
      points.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: Math.round(c * 100) / 100 });
    }
  }
  return { points: points.slice(-MAX_POINTS), currency };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const user = await verifyUser(req.headers.get("Authorization"));
  if (!user) return json({ error: "Unauthorized" }, 401, cors);

  try {
    const { ticker } = await req.json();
    if (!ticker || typeof ticker !== "string" || !/^[A-Za-z][A-Za-z.\-]{0,9}$/.test(ticker)) {
      return json({ error: "Invalid ticker" }, 400, cors);
    }
    const symbol = ticker.trim().toUpperCase();

    const cached = cache.get(symbol);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return json(cached.data, 200, cors);
    }

    // Yahoo symbols use "-" for class shares (e.g. BRK.B → BRK-B). Weekly over 1y.
    const yahooSymbol = symbol.replace(/\./g, "-");
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1y&interval=1wk`;

    let res;
    try {
      res = await safeFetchText(url, {
        maxBytes: 2 * 1024 * 1024,
        timeoutMs: 10_000,
        headers: { "User-Agent": UA, "Accept": "application/json" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fetch failed";
      const status = msg === "URL not allowed" || msg === "Invalid URL" ? 400 : 502;
      return json({ error: msg }, status, cors);
    }
    if (!res.ok) return json({ error: `Fetch failed: ${res.statusText}` }, 502, cors);

    const { points, currency } = parseYahoo(res.text);
    if (points.length < 2) return json({ error: "No price history for this ticker" }, 404, cors);

    const data: StockHistory = { ticker: symbol, currency, points };
    cache.set(symbol, { data, ts: Date.now() });
    return json(data, 200, cors);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500, cors);
  }
});
