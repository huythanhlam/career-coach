// Supabase Edge Function: BLS Public Data API proxy.
// Forwards OEWS time-series requests to the BLS API, attaching a registration
// key from the environment if one is configured (works keyless otherwise, at
// BLS's lower daily limit). BLS data is public government data, so this only
// proxies — no per-user verification beyond the platform's apikey gate.

import { corsHeaders } from "../_shared/cors.ts";

const BLS_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const { seriesIds, startyear, endyear } = await req.json();
    // Only allow OEWS series IDs — prevents using this as a general BLS proxy.
    const VALID_BLS_SERIES = /^OEU[NSM]\d{21}$/;
    const ids = Array.isArray(seriesIds)
      ? seriesIds.filter((s: unknown) => typeof s === "string" && VALID_BLS_SERIES.test(s)).slice(0, 50)
      : [];
    if (ids.length === 0) {
      return new Response(JSON.stringify({ error: "No valid BLS series IDs" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const now = new Date().getFullYear();
    const payload: Record<string, unknown> = {
      seriesid: ids,
      startyear: startyear ?? String(now - 2),
      endyear: endyear ?? String(now),
    };
    const key = Deno.env.get("BLS_API_KEY");
    if (key) payload.registrationkey = key;

    const blsRes = await fetch(BLS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const data = await blsRes.json();

    return new Response(JSON.stringify(data), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
