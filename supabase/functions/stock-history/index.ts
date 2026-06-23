import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeFetchText } from "../_shared/safe-fetch.ts";

// ── Keyless stock-price history ────────────────────────────────────────────
// Powers the price chart in the Research Company → Financials card. Fetches
// Yahoo Finance's free, keyless v8 chart JSON server-side (no CORS, no API key)
// for the requested window, parses the closes, caps the payload, and caches per
// ticker+range in-memory so repeated lookups don't re-hit Yahoo.

interface StockPoint {
  date: string; // YYYY-MM-DD for daily+ windows; full ISO datetime for intraday
  close: number;
}
interface StockHistory {
  ticker: string;
  currency: string;
  points: StockPoint[];
}

// Allowlisted chart windows → Yahoo (range, interval). User input only ever
// selects a key, never reaches the URL, so the upstream URL stays fixed-shape.
const RANGE_MAP: Record<string, { range: string; interval: string; intraday: boolean }> = {
  "1D": { range: "1d", interval: "5m", intraday: true },
  "1W": { range: "5d", interval: "30m", intraday: true },
  "1M": { range: "1mo", interval: "1d", intraday: false },
  "3M": { range: "3mo", interval: "1d", intraday: false },
  "6M": { range: "6mo", interval: "1d", intraday: false },
  "1Y": { range: "1y", interval: "1wk", intraday: false },
  "5Y": { range: "5y", interval: "1mo", intraday: false },
  "MAX": { range: "max", interval: "1mo", intraday: false },
};

const MAX_POINTS = 400; // intraday windows can carry a few hundred bars
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const INTRADAY_CACHE_TTL_MS = 5 * 60 * 1000; // intraday windows move minute-to-minute
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
function parseYahoo(jsonText: string, intraday: boolean): { points: StockPoint[]; currency: string } {
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
      const iso = new Date(ts[i] * 1000).toISOString();
      points.push({ date: intraday ? iso : iso.slice(0, 10), close: Math.round(c * 100) / 100 });
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
    const { ticker, range } = await req.json();
    if (!ticker || typeof ticker !== "string" || !/^[A-Za-z][A-Za-z.\-]{0,9}$/.test(ticker)) {
      return json({ error: "Invalid ticker" }, 400, cors);
    }
    const win = RANGE_MAP[typeof range === "string" ? range : "1Y"] ?? RANGE_MAP["1Y"];
    const symbol = ticker.trim().toUpperCase();
    const cacheId = `${symbol}:${range ?? "1Y"}`;

    const cached = cache.get(cacheId);
    const ttl = win.intraday ? INTRADAY_CACHE_TTL_MS : CACHE_TTL_MS;
    if (cached && Date.now() - cached.ts < ttl) {
      return json(cached.data, 200, cors);
    }

    // Yahoo symbols use "-" for class shares (e.g. BRK.B → BRK-B).
    const yahooSymbol = symbol.replace(/\./g, "-");
    const path = `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${win.range}&interval=${win.interval}`;

    // query1 rate-limits readily when several windows are switched in quick
    // succession; fall back to the query2 mirror so a window switch still loads.
    let res: Awaited<ReturnType<typeof safeFetchText>> | null = null;
    let lastErr = "Fetch failed";
    for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
      try {
        const r = await safeFetchText(`https://${host}${path}`, {
          maxBytes: 2 * 1024 * 1024,
          timeoutMs: 10_000,
          headers: { "User-Agent": UA, "Accept": "application/json" },
        });
        if (r.ok) {
          res = r;
          break;
        }
        lastErr = `Fetch failed: ${r.statusText}`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Fetch failed";
        // Config errors (bad/blocked URL) won't differ by host — fail fast.
        if (msg === "URL not allowed" || msg === "Invalid URL") {
          return json({ error: msg }, 400, cors);
        }
        lastErr = msg;
      }
    }
    if (!res) return json({ error: lastErr }, 502, cors);

    const { points, currency } = parseYahoo(res.text, win.intraday);
    if (points.length < 2) return json({ error: "No price history for this ticker" }, 404, cors);

    const data: StockHistory = { ticker: symbol, currency, points };
    cache.set(cacheId, { data, ts: Date.now() });
    return json(data, 200, cors);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500, cors);
  }
});
