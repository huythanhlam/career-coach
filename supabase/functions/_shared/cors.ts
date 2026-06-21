// Shared CORS handling for all Edge Functions.
//
// `ALLOWED_ORIGIN` (a Supabase secret) is a comma-separated allowlist of origins,
// e.g. "https://app.example.com,https://www.example.com". The request's Origin is
// echoed back only if it is on the list; otherwise the first allowed origin is
// returned (so unknown origins are not granted access). If the secret is unset we
// fail closed in production; the "*" fallback applies only when running against a
// local Supabase stack, for dev convenience.
//
// Entries may contain `*` wildcards, where each `*` matches any run of characters
// within a single hostname label (it never crosses a `.`, so it can't broaden to
// other subdomains). This is how dynamic Vercel preview deployments are allowed —
// their URLs vary per branch/commit. For example,
//   "https://career-coach-*-myteam.vercel.app"
// matches "https://career-coach-git-some-branch-myteam.vercel.app" but not an
// attacker-controlled "https://career-coach-evil.example.com".

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

/** Build a matcher for one allowlist entry; `*` matches within a hostname label. */
function makeMatcher(pattern: string): (origin: string) => boolean {
  if (!pattern.includes("*")) return (origin) => origin === pattern;
  // Escape regex metacharacters, then turn each `*` into "any chars but a dot"
  // so a wildcard can't widen the match across subdomain boundaries.
  const re = new RegExp(
    "^" +
      pattern
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^.]*") +
      "$",
  );
  return (origin) => re.test(origin);
}

const MATCHERS = ALLOW_LIST.map(makeMatcher);
// A concrete (wildcard-free) origin to fall back to for unknown requests — never
// a pattern, which would be a meaningless Origin value.
const FALLBACK_ORIGIN = ALLOW_LIST.find((o) => !o.includes("*")) ?? "null";

function resolveOrigin(requestOrigin: string | null): string {
  if (ALLOW_ALL) return "*";
  if (requestOrigin && MATCHERS.some((match) => match(requestOrigin))) {
    return requestOrigin;
  }
  // Unknown origin: echo an origin the browser's Origin header can never
  // match, so the response is unreadable cross-origin.
  return FALLBACK_ORIGIN;
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
