import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeFetchText } from "../_shared/safe-fetch.ts";

// ── Targeted Job Postings: scan public ATS feeds ───────────────────────────
// Fetches a company's open roles directly from its public, keyless ATS JSON
// feed (Greenhouse / Lever / Ashby) and filters by role keywords. No scraping,
// no API keys — these are the feeds the ATS platforms publish for embedding.

type Ats = "greenhouse" | "lever" | "ashby" | "workable" | "smartrecruiters";

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
  workable: "apply.workable.com",
  smartrecruiters: "api.smartrecruiters.com",
};

// Built-in default boards so role-only discovery works with zero user-supplied
// companies (career-ops ships ~45 in a template; we bake a curated set in).
// Board tokens are best-effort; a wrong/stale token just fails gracefully and is
// reported in `errors`. Edit freely — this is the app's default portfolio.
const SEED_COMPANIES: { ats: Ats; boardToken: string; name: string }[] = [
  // Greenhouse (token verified live)
  { ats: "greenhouse", boardToken: "anthropic", name: "Anthropic" },
  { ats: "greenhouse", boardToken: "stripe", name: "Stripe" },
  { ats: "greenhouse", boardToken: "databricks", name: "Databricks" },
  { ats: "greenhouse", boardToken: "coinbase", name: "Coinbase" },
  { ats: "greenhouse", boardToken: "dropbox", name: "Dropbox" },
  { ats: "greenhouse", boardToken: "gitlab", name: "GitLab" },
  { ats: "greenhouse", boardToken: "reddit", name: "Reddit" },
  { ats: "greenhouse", boardToken: "pinterest", name: "Pinterest" },
  { ats: "greenhouse", boardToken: "instacart", name: "Instacart" },
  { ats: "greenhouse", boardToken: "robinhood", name: "Robinhood" },
  { ats: "greenhouse", boardToken: "brex", name: "Brex" },
  { ats: "greenhouse", boardToken: "samsara", name: "Samsara" },
  { ats: "greenhouse", boardToken: "cloudflare", name: "Cloudflare" },
  { ats: "greenhouse", boardToken: "discord", name: "Discord" },
  { ats: "greenhouse", boardToken: "figma", name: "Figma" },
  { ats: "greenhouse", boardToken: "lyft", name: "Lyft" },
  { ats: "greenhouse", boardToken: "twilio", name: "Twilio" },
  { ats: "greenhouse", boardToken: "gusto", name: "Gusto" },
  { ats: "greenhouse", boardToken: "flexport", name: "Flexport" },
  { ats: "greenhouse", boardToken: "sofi", name: "SoFi" },
  { ats: "greenhouse", boardToken: "mongodb", name: "MongoDB" },
  { ats: "greenhouse", boardToken: "elastic", name: "Elastic" },
  { ats: "greenhouse", boardToken: "faire", name: "Faire" },
  { ats: "greenhouse", boardToken: "peloton", name: "Peloton" },
  { ats: "greenhouse", boardToken: "scaleai", name: "Scale AI" },
  // Ashby (token verified live)
  { ats: "ashby", boardToken: "ramp", name: "Ramp" },
  { ats: "ashby", boardToken: "notion", name: "Notion" },
  { ats: "ashby", boardToken: "linear", name: "Linear" },
  { ats: "ashby", boardToken: "cohere", name: "Cohere" },
  { ats: "ashby", boardToken: "perplexity", name: "Perplexity" },
  { ats: "ashby", boardToken: "deel", name: "Deel" },
  { ats: "ashby", boardToken: "posthog", name: "PostHog" },
  { ats: "ashby", boardToken: "baseten", name: "Baseten" },
  { ats: "ashby", boardToken: "modal", name: "Modal" },
  { ats: "ashby", boardToken: "watershed", name: "Watershed" },
  { ats: "ashby", boardToken: "mintlify", name: "Mintlify" },
  { ats: "ashby", boardToken: "browserbase", name: "Browserbase" },
  { ats: "ashby", boardToken: "runway", name: "Runway" },
  // Lever (token verified live)
  { ats: "lever", boardToken: "palantir", name: "Palantir" },
  // SmartRecruiters (slug verified live — big non-tech employers)
  { ats: "smartrecruiters", boardToken: "Visa", name: "Visa" },
  { ats: "smartrecruiters", boardToken: "BoschGroup", name: "Bosch" },
  { ats: "smartrecruiters", boardToken: "Experian", name: "Experian" },
  { ats: "smartrecruiters", boardToken: "McDonaldsCorporation", name: "McDonald's" },
  // Workable (slug verified live)
  { ats: "workable", boardToken: "huggingface", name: "Hugging Face" },
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
      // No content=true: full descriptions can balloon a big board past 8MB
      // (Databricks is ~9MB with content, ~0.6MB without). Listing only — the
      // user gets the description on demand via the posting URL.
      return `https://boards-api.greenhouse.io/v1/boards/${token}/jobs`;
    case "lever":
      return `https://api.lever.co/v0/postings/${token}?mode=json`;
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`;
    case "workable":
      return `https://apply.workable.com/${token}/jobs.md`;
    case "smartrecruiters":
      return `https://api.smartrecruiters.com/v1/companies/${token}/postings?limit=100&status=PUBLIC`;
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function normalize(ats: Ats, raw: unknown, companyName: string | null, token: string): NormalizedJob[] {
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
  } else if (ats === "ashby") {
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
  } else if (ats === "workable") {
    // Workable exposes a markdown table: | Title | Department | Location | Type | Salary | Posted | Details |
    const lines = (typeof raw === "string" ? raw : "").split("\n");
    for (const line of lines) {
      if (!line.startsWith("|")) continue;
      if (/^\|\s*-+/.test(line) || /\|\s*Title\s*\|/i.test(line)) continue; // separator / header
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.length < 7) continue;
      const title = cells[0];
      if (!title) continue;
      const location = cells[2] || null;
      const type = cells[3] && cells[3] !== "—" ? cells[3] : null;
      const m = cells[6].match(/\]\((https?:\/\/[^)]+)\)/);
      let url = m ? m[1].replace(/\.md$/, "") : null;
      let externalId: string | null = null;
      if (url) {
        const idm = url.match(/\/jobs\/view\/([A-Za-z0-9]+)/);
        if (idm) externalId = `workable:${idm[1]}`;
      }
      out.push({
        title, company: companyName, location, description: "", url, externalId,
        employmentType: type, remote: location && /remote/i.test(location) ? true : null,
        source: "ats", ats,
      });
    }
  } else if (ats === "smartrecruiters") {
    const jobs = (raw as { content?: unknown[] })?.content ?? [];
    for (const j of jobs as Record<string, unknown>[]) {
      const title = str(j.name);
      if (!title) continue;
      const loc = (j.location as Record<string, unknown>) ?? {};
      const location = str(loc.fullLocation) ??
        ([loc.city, loc.region, loc.country].filter(Boolean).join(", ") || null);
      const id = j.id != null ? String(j.id) : null;
      const empType = j.typeOfEmployment as Record<string, unknown> | undefined;
      const company = (j.company as Record<string, unknown>)?.name;
      out.push({
        title,
        company: str(company) ?? companyName,
        location,
        description: "",
        url: id ? `https://jobs.smartrecruiters.com/${token}/${id}` : null,
        externalId: id ? `sr:${id}` : null,
        employmentType: str(empType?.label),
        remote: typeof loc.remote === "boolean" ? loc.remote as boolean : null,
        source: "ats",
        ats,
      });
    }
  }

  return out;
}

/**
 * career-ops title_filter: a job passes when it contains at least one positive
 * keyword (or none are defined) AND contains none of the negative keywords.
 */
function matchesFilter(title: string, positives: string[], negatives: string[]): boolean {
  const t = title.toLowerCase();
  if (negatives.some((n) => n && t.includes(n.toLowerCase()))) return false;
  if (positives.length === 0) return true;
  return positives.some((k) => k && t.includes(k.toLowerCase()));
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

  // Internal server-to-server calls (the weekly cron orchestrator) carry a shared
  // secret and skip per-user auth + rate limiting.
  const cronSecret = Deno.env.get("CRON_SECRET");
  const internal = !!cronSecret && req.headers.get("x-internal-key") === cronSecret;
  if (!internal) {
    const user = await verifyUser(req.headers.get("Authorization"));
    if (!user) return json({ error: "Unauthorized" }, 401, cors);
    if (isRateLimited(user.id)) {
      return json({ error: "Too many requests — please wait a moment and try again." }, 429, cors);
    }
  }

  try {
    const body = await req.json();
    const provided = Array.isArray(body?.companies) ? body.companies : [];
    const includeSeed = body?.includeSeed !== false; // default true → role-only works
    const keywords: string[] = Array.isArray(body?.keywords)
      ? body.keywords.filter((k: unknown): k is string => typeof k === "string")
      : [];
    const exclude: string[] = Array.isArray(body?.exclude)
      ? body.exclude.filter((k: unknown): k is string => typeof k === "string")
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

    const scanOne = async (c: Record<string, unknown>) => {
      const ats = c.ats as Ats;
      const token = cleanToken(c.boardToken);
      const name = str(c.name);
      if (!ATS_HOSTS[ats] || !token) {
        errors.push({ company: name ?? String(c.boardToken ?? "?"), error: "Invalid company config" });
        return;
      }
      try {
        const res = await safeFetchText(feedUrl(ats, token), {
          maxBytes: 8 * 1024 * 1024,
          timeoutMs: 12_000,
          headers: { "User-Agent": "TechCoachBot/1.0", "Accept": "application/json" },
        });
        if (!res.ok) {
          errors.push({ company: name ?? token, error: `Feed returned ${res.status}` });
          return;
        }
        const parsed = ats === "workable" ? res.text : JSON.parse(res.text);
        for (const job of normalize(ats, parsed, name, token)) {
          if (matchesFilter(job.title, keywords, exclude)) results.push(job);
        }
      } catch (e) {
        errors.push({ company: name ?? token, error: e instanceof Error ? e.message : "Scan failed" });
      }
    };

    // Concurrency-limited fan-out (career-ops scans with a pool of ~10) so a big
    // company list doesn't spike memory or hit the wall-clock limit at once.
    const CONCURRENCY = 8;
    let idx = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, capped.length) }, async () => {
        while (idx < capped.length) await scanOne(capped[idx++]);
      }),
    );

    return json({ results, errors }, 200, cors);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500, cors);
  }
});
