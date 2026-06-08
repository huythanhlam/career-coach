// Shared CORS handling for all Edge Functions.
//
// `ALLOWED_ORIGIN` (a Supabase secret) is a comma-separated allowlist of origins,
// e.g. "https://app.example.com,https://www.example.com". The request's Origin is
// echoed back only if it is on the list; otherwise the first allowed origin is
// returned (so unknown origins are not granted access). If the secret is unset we
// fall back to "*" for local/dev convenience — set it in production.

const ALLOW_LIST = (Deno.env.get("ALLOWED_ORIGIN") ?? "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const ALLOW_ALL = ALLOW_LIST.length === 0 || ALLOW_LIST.includes("*");

function resolveOrigin(requestOrigin: string | null): string {
  if (ALLOW_ALL) return "*";
  if (requestOrigin && ALLOW_LIST.includes(requestOrigin)) return requestOrigin;
  return ALLOW_LIST[0];
}

/** Build CORS headers for a given request (honors the Origin allowlist). */
export function corsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveOrigin(req.headers.get("Origin")),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
