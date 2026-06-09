import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeFetchText } from "../_shared/safe-fetch.ts";

// ── Targeted Job Postings: scan public ATS feeds ───────────────────────────
// Fetches a company's open roles directly from its public, keyless ATS JSON
// feed (Greenhouse / Lever / Ashby) and filters by role keywords. No scraping,
// no API keys — these are the feeds the ATS platforms publish for embedding.

type Ats = "greenhouse" | "lever" | "ashby";

interface NormalizedJob {
  title: string;
  company: string | null;
  location: string | null;
  description: string;
  url: string | null;
  externalId: string | null;
  employmentType: string | null;
  remote: boolean | null;
  source: "ats";
  ats: Ats;
}

// Allowlisted ATS API hosts (defense-in-depth alongside safeFetchText's SSRF
// checks — we only ever hit these three).
const ATS_HOSTS: Record<Ats, string> = {
  greenhouse: "boards-api.greenhouse.io",
  lever: "api.lever.co",
  ashby: "api.ashbyhq.com",
};

// Built-in default boards so role-only discovery works with zero user-supplied
// companies (career-ops ships ~45 in a template; we bake a curated set in).
// Board tokens are best-effort; a wrong/stale token just fails gracefully and is
// reported in `errors`. Edit freely — this is the app's default portfolio.
const SEED_COMPANIES: { ats: Ats; boardToken: string; name: string }[] = [
  { ats: "greenhouse", boardToken: "anthropic", name: "Anthropic" },
  { ats: "greenhouse", boardToken: "stripe", name: "Stripe" },
  { ats: "greenhouse", boardToken: "airbnb", name: "Airbnb" },
  { ats: "greenhouse", boardToken: "databricks", name: "Databricks" },
  { ats: "greenhouse", boardToken: "coinbase", name: "Coinbase" },
  { ats: "greenhouse", boardToken: "dropbox", name: "Dropbox" },
  { ats: "greenhouse", boardToken: "gitlab", name: "GitLab" },
  { ats: "greenhouse", boardToken: "reddit", name: "Reddit" },
  { ats: "greenhouse", boardToken: "pinterest", name: "Pinterest" },
  { ats: "greenhouse", boardToken: "doordash", name: "DoorDash" },
  { ats: "greenhouse", boardToken: "instacart", name: "Instacart" },
  { ats: "greenhouse", boardToken: "robinhood", name: "Robinhood" },
  { ats: "greenhouse", boardToken: "brex", name: "Brex" },
  { ats: "greenhouse", boardToken: "plaid", name: "Plaid" },
  { ats: "greenhouse", boardToken: "samsara", name: "Samsara" },
  { ats: "greenhouse", boardToken: "affirm", name: "Affirm" },
  { ats: "greenhouse", boardToken: "cloudflare", name: "Cloudflare" },
  { ats: "ashby", boardToken: "ramp", name: "Ramp" },
  { ats: "ashby", boardToken: "notion", name: "Notion" },
  { ats: "ashby", boardToken: "linear", name: "Linear" },
];

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Strip HTML to readable text (ATS `content`/`descriptionHtml` fields). */
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|h[1-6]|div)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  ).slice(0, 8000);
}

/** ATS board token: keep it to safe characters so it can't alter the URL path. */
function cleanToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const t = token.trim();
  return /^[A-Za-z0-9._-]+$/.test(t) ? t : null;
}

function feedUrl(ats: Ats, token: string): string {
  switch (ats) {
    case "greenhouse":
      return `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`;
    case "lever":
      return `https://api.lever.co/v0/postings/${token}?mode=json`;
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function normalize(ats: Ats, raw: unknown, companyName: string | null): NormalizedJob[] {
  const out: NormalizedJob[] = [];

  if (ats === "greenhouse") {
    const jobs = (raw as { jobs?: unknown[] })?.jobs ?? [];
    for (const j of jobs as Record<string, unknown>[]) {
      const title = str(j.title);
      if (!title) continue;
      out.push({
        title,
        company: companyName,
        location: str((j.location as Record<string, unknown>)?.name),
        description: typeof j.content === "string" ? htmlToText(j.content) : "",
        url: str(j.absolute_url),
        externalId: j.id != null ? String(j.id) : null,
        employmentType: null,
        remote: null,
        source: "ats",
        ats,
      });
    }
  } else if (ats === "lever") {
    const jobs = Array.isArray(raw) ? raw : [];
    for (const j of jobs as Record<string, unknown>[]) {
      const title = str(j.text);
      if (!title) continue;
      const cats = (j.categories as Record<string, unknown>) ?? {};
      out.push({
        title,
        company: companyName,
        location: str(cats.location),
        description: str(j.descriptionPlain) ??
          (typeof j.description === "string" ? htmlToText(j.description) : ""),
        url: str(j.hostedUrl),
        externalId: j.id != null ? String(j.id) : null,
        employmentType: str(cats.commitment),
        remote: typeof j.workplaceType === "string" ? j.workplaceType === "remote" : null,
        source: "ats",
        ats,
      });
    }
  } else {
    // ashby
    const jobs = (raw as { jobs?: unknown[] })?.jobs ?? [];
    for (const j of jobs as Record<string, unknown>[]) {
      const title = str(j.title);
      if (!title) continue;
      out.push({
        title,
        company: companyName,
        location: str(j.location),
        description: str(j.descriptionPlain) ??
          (typeof j.descriptionHtml === "string" ? htmlToText(j.descriptionHtml) : ""),
        url: str(j.jobUrl) ?? str(j.applyUrl),
        externalId: j.id != null ? String(j.id) : null,
        employmentType: str(j.employmentType),
        remote: typeof j.isRemote === "boolean" ? j.isRemote : null,
        source: "ats",
        ats,
      });
    }
  }

  return out;
}

function matchesKeywords(title: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const t = title.toLowerCase();
  return keywords.some((k) => k && t.includes(k.toLowerCase()));
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
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

// Best-effort per-user rate limit (module scope persists across warm invocations).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();
function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const user = await verifyUser(req.headers.get("Authorization"));
  if (!user) return json({ error: "Unauthorized" }, 401, cors);
  if (isRateLimited(user.id)) {
    return json({ error: "Too many requests — please wait a moment and try again." }, 429, cors);
  }

  try {
    const body = await req.json();
    const provided = Array.isArray(body?.companies) ? body.companies : [];
    const includeSeed = body?.includeSeed !== false; // default true → role-only works
    const keywords: string[] = Array.isArray(body?.keywords)
      ? body.keywords.filter((k: unknown): k is string => typeof k === "string")
      : [];

    // Merge the built-in seed list with any user companies, deduped by ats+token,
    // so a scan needs only a target role (the seed list supplies the companies).
    const merged = includeSeed ? [...SEED_COMPANIES, ...provided] : provided;
    const seen = new Set<string>();
    const targets: Record<string, unknown>[] = [];
    for (const c of merged as Record<string, unknown>[]) {
      const token = cleanToken(c.boardToken);
      if (!token) continue;
      const key = `${c.ats}:${token}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push(c);
    }
    if (targets.length === 0) {
      return json({ error: "No companies to scan" }, 400, cors);
    }
    // Cap fan-out to protect the function and upstreams.
    const capped = targets.slice(0, 60);

    const results: NormalizedJob[] = [];
    const errors: { company: string; error: string }[] = [];

    await Promise.all(
      capped.map(async (c: Record<string, unknown>) => {
        const ats = c.ats as Ats;
        const token = cleanToken(c.boardToken);
        const name = str(c.name);
        if (!ATS_HOSTS[ats] || !token) {
          errors.push({ company: name ?? String(c.boardToken ?? "?"), error: "Invalid company config" });
          return;
        }
        try {
          const res = await safeFetchText(feedUrl(ats, token), {
            maxBytes: 2 * 1024 * 1024,
            timeoutMs: 10_000,
            headers: { "User-Agent": "TechCoachBot/1.0", "Accept": "application/json" },
          });
          if (!res.ok) {
            errors.push({ company: name ?? token, error: `Feed returned ${res.status}` });
            return;
          }
          const parsed = JSON.parse(res.text);
          for (const job of normalize(ats, parsed, name)) {
            if (matchesKeywords(job.title, keywords)) results.push(job);
          }
        } catch (e) {
          errors.push({ company: name ?? token, error: e instanceof Error ? e.message : "Scan failed" });
        }
      }),
    );

    return json({ results, errors }, 200, cors);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500, cors);
  }
});
