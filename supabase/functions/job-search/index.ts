import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeFetchText } from "../_shared/safe-fetch.ts";

// ── Targeted Job Postings: keyless aggregator search ───────────────────────
// Role-only discovery across many employers using public, NO-KEY job APIs:
// Remotive, Arbeitnow, and RemoteOK. Results are full postings the user can save
// directly. Skews remote/tech, but needs no company list and no API key.

interface NormalizedJob {
  title: string;
  company: string | null;
  location: string | null;
  description: string;
  url: string | null;
  externalId: string | null;
  remote: boolean | null;
  source: "web";
  provider: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|h[1-6]|div)>/gi, "\n")
      .replace(/<[^>]+>/g, " ").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim(),
  ).slice(0, 8000);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

// Relevance matching. We score against the job TITLE only (matching the
// description lets a stray word like "manager" pass almost anything), and
// require enough of the role's significant words to appear.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "of", "a", "an", "to", "in", "on", "at",
  "jr", "sr", "i", "ii", "iii", "lead", "senior", "junior", "staff",
]);

function significantTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** How many of the role's significant terms appear in the title (with a phrase bonus). */
function titleScore(title: string, query: string, terms: string[]): number {
  const t = title.toLowerCase();
  let score = terms.reduce((n, term) => (t.includes(term) ? n + 1 : n), 0);
  if (query && t.includes(query.toLowerCase())) score += 2; // exact phrase
  return score;
}

/** Minimum terms a title must contain to count as relevant. */
function relevanceThreshold(terms: string[]): number {
  if (terms.length <= 2) return terms.length;       // 1–2 word roles: all must match
  return Math.ceil(terms.length * 0.6);             // longer roles: a clear majority
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const res = await safeFetchText(url, {
    maxBytes: 4 * 1024 * 1024,
    timeoutMs: 10_000,
    headers: { "Accept": "application/json", "User-Agent": "TechCoachBot/1.0", ...headers },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(res.text);
}

async function fromRemotive(query: string): Promise<NormalizedJob[]> {
  const data = await fetchJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=25`) as { jobs?: Record<string, unknown>[] };
  return (data.jobs ?? []).map((j) => ({
    title: str(j.title) ?? "",
    company: str(j.company_name),
    location: str(j.candidate_required_location) ?? "Remote",
    description: typeof j.description === "string" ? htmlToText(j.description) : "",
    url: str(j.url),
    externalId: j.id != null ? `remotive:${j.id}` : null,
    remote: true,
    source: "web" as const,
    provider: "Remotive",
  })).filter((j) => j.title && j.url);
}

/**
 * Workable's GLOBAL job board search — a real keyless search engine across all
 * Workable employers (thousands of companies, e.g. "software engineer" → 4000+).
 * This is the primary source; we page a few times for enough results to rank.
 */
async function fromWorkableGlobal(query: string): Promise<NormalizedJob[]> {
  const out: NormalizedJob[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < 3; page++) {
    const url = `https://jobs.workable.com/api/v1/jobs?query=${encodeURIComponent(query)}` +
      (pageToken ? `&nextPageToken=${encodeURIComponent(pageToken)}` : "");
    const data = await fetchJson(url) as { jobs?: Record<string, unknown>[]; nextPageToken?: string };
    const jobs = data.jobs ?? [];
    for (const j of jobs) {
      const company = (j.company as Record<string, unknown>) ?? {};
      const loc = (j.location as Record<string, unknown>) ?? {};
      const location = [loc.city, loc.subregion, loc.countryName].filter(Boolean).join(", ") || null;
      const workplace = typeof j.workplace === "string" ? j.workplace.toLowerCase() : "";
      out.push({
        title: str(j.title) ?? "",
        company: str(company.title),
        location,
        description: typeof j.description === "string" ? htmlToText(j.description) : "",
        url: str(j.url),
        externalId: j.id != null ? `workable:${j.id}` : null,
        remote: workplace ? workplace.includes("remote") : null,
        source: "web" as const,
        provider: "Workable",
      });
    }
    pageToken = typeof data.nextPageToken === "string" && jobs.length ? data.nextPageToken : null;
    if (!pageToken) break;
  }
  return out.filter((j) => j.title && j.url);
}

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

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
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
      return json({ error: "Too many searches — please wait a moment and try again." }, 429, cors);
    }
  }

  try {
    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) return json({ error: "Missing query" }, 400, cors);
    const terms = significantTerms(query);
    const threshold = relevanceThreshold(terms);
    const exclude: string[] = (Array.isArray(body?.exclude) ? body.exclude : [])
      .filter((k: unknown): k is string => typeof k === "string")
      .map((k: string) => k.toLowerCase());

    const settled = await Promise.allSettled([
      fromWorkableGlobal(query),
      fromRemotive(query),
    ]);

    // Collect, dedupe (by url/id AND company+title across sources), drop excluded
    // titles, keep only relevant titles, then rank best-first.
    const scored: { job: NormalizedJob; score: number }[] = [];
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const s of settled) {
      if (s.status === "fulfilled") {
        for (const job of s.value) {
          const t = job.title.toLowerCase();
          if (exclude.some((n) => n && t.includes(n))) continue;
          const key = job.url ?? job.externalId ?? job.title;
          const ctKey = `${(job.company ?? "").toLowerCase()}|${t}`;
          if ((key && seen.has(key)) || seen.has(ctKey)) continue;
          if (key) seen.add(key);
          seen.add(ctKey);
          const score = titleScore(job.title, query, terms);
          if (score >= threshold) scored.push({ job, score });
        }
      } else {
        errors.push(s.reason instanceof Error ? s.reason.message : "provider failed");
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, 60).map((x) => x.job);

    return json({ results, errors }, 200, cors);
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500, cors);
  }
});
