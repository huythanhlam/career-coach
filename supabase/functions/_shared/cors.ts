// Shared CORS handling for all Edge Functions.
//
// `ALLOWED_ORIGIN` (a Supabase secret) is a comma-separated allowlist of origins,
// e.g. "https://app.example.com,https://www.example.com". The request's Origin is
// echoed back only if it is on the list; otherwise the first allowed origin is
// returned (so unknown origins are not granted access). If the secret is unset we
// fail closed in production; the "*" fallback applies only when running against a
// local Supabase stack, for dev convenience.

const CONFIGURED = (Deno.env.get("ALLOWED_ORIGIN") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Local `supabase functions serve` exposes the stack on localhost/kong.
const IS_LOCAL_STACK = /localhost|127\.0\.0\.1|\/\/kong\b/.test(
  Deno.env.get("SUPABASE_URL") ?? "",
);

const ALLOW_LIST = CONFIGURED.length > 0 ? CONFIGURED : IS_LOCAL_STACK ? ["*"] : [];

if (ALLOW_LIST.length === 0) {
  console.warn(
    "ALLOWED_ORIGIN is not set — all cross-origin browser requests will be blocked. " +
      "Set the ALLOWED_ORIGIN secret to your app's origin(s).",
  );
}

const ALLOW_ALL = ALLOW_LIST.includes("*");

function resolveOrigin(requestOrigin: string | null): string {
  if (ALLOW_ALL) return "*";
  if (requestOrigin && ALLOW_LIST.includes(requestOrigin)) return requestOrigin;
  // Unknown origin: echo an origin the browser's Origin header can never
  // match, so the response is unreadable cross-origin.
  return ALLOW_LIST[0] ?? "null";
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
