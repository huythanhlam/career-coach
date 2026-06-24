import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { safeFetchText } from "../_shared/safe-fetch.ts";
import { htmlToMarkdown } from "../_shared/html.ts";
import { inferFamily, museCategoriesForQuery } from "../_shared/jobTaxonomy.ts";

// ── Targeted Job Postings: keyless aggregator search ───────────────────────
// Role-only discovery across many employers using public, NO-KEY job APIs. Two
// kinds of source, unified into one ranked list:
//   • Keyword search — Workable global, Remotive, Jobicy, Arbeitnow. Queried by
//     the role text and filtered by title relevance (skews remote/tech).
//   • Category search — The Muse (400k+ postings spanning every job family but
//     with NO keyword endpoint). We translate the role into a Muse category so
//     non-tech families (legal, healthcare, finance, HR, customer service, …)
//     return real inventory instead of coming up empty.
// All results are full postings the user can save directly; no company list and
// no API key required.

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
  // True for category-sourced rows (The Muse): they're matched to the query's
  // job family rather than by title keywords, so they bypass the title-relevance
  // threshold and are kept only when their title lands in the target family.
  categorySourced?: boolean;
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
    description: typeof j.description === "string" ? htmlToMarkdown(j.description) : "",
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
        description: typeof j.description === "string" ? htmlToMarkdown(j.description) : "",
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

/**
 * Jobicy — keyless remote-jobs API with a free-text `tag` search across many
 * non-tech functions (legal, finance, HR, sales, customer support, marketing).
 */
async function fromJobicy(query: string): Promise<NormalizedJob[]> {
  const data = await fetchJson(
    `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(query)}`,
  ) as { jobs?: Record<string, unknown>[] };
  return (data.jobs ?? []).map((j) => ({
    title: str(j.jobTitle) ?? "",
    company: str(j.companyName),
    location: str(j.jobGeo) ?? "Remote",
    description: typeof j.jobDescription === "string" ? htmlToMarkdown(j.jobDescription) : (str(j.jobExcerpt) ?? ""),
    url: str(j.url),
    externalId: j.id != null ? `jobicy:${j.id}` : null,
    remote: true,
    source: "web" as const,
    provider: "Jobicy",
  })).filter((j) => j.title && j.url);
}

/**
 * Arbeitnow — keyless job board (Europe-heavy) with a free-text `search` param.
 * Broadens international and non-tech coverage; location relevance is enforced
 * client-side by the caller's location matcher.
 */
async function fromArbeitnow(query: string): Promise<NormalizedJob[]> {
  const data = await fetchJson(
    `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}`,
  ) as { data?: Record<string, unknown>[] };
  return (data.data ?? []).map((j) => ({
    title: str(j.title) ?? "",
    company: str(j.company_name),
    location: str(j.location),
    description: typeof j.description === "string" ? htmlToMarkdown(j.description) : "",
    url: str(j.url),
    externalId: str(j.slug) ? `arbeitnow:${str(j.slug)}` : null,
    remote: typeof j.remote === "boolean" ? j.remote : null,
    source: "web" as const,
    provider: "Arbeitnow",
  })).filter((j) => j.title && j.url);
}

/**
 * The Muse — category-sourced. The public jobs API has no keyword search, so we
 * fetch the category the role maps to (see museCategoriesForQuery) across a
 * couple of pages. Rows are tagged categorySourced so the ranker keeps them by
 * family match rather than title keywords. This is what gives every dropdown
 * family — especially the non-tech ones — real postings.
 */
async function fromTheMuse(query: string): Promise<NormalizedJob[]> {
  const categories = museCategoriesForQuery(query);
  if (categories.length === 0) return [];
  const out: NormalizedJob[] = [];
  for (const category of categories.slice(0, 2)) {
    for (let page = 0; page < 2; page++) {
      const url = `https://www.themuse.com/api/public/jobs?category=${encodeURIComponent(category)}&page=${page}`;
      const data = await fetchJson(url) as { results?: Record<string, unknown>[] };
      const results = data.results ?? [];
      for (const j of results) {
        const locations = Array.isArray(j.locations)
          ? (j.locations as Record<string, unknown>[]).map((l) => str(l.name)).filter(Boolean)
          : [];
        const location = locations.join(", ") || null;
        out.push({
          title: str(j.name) ?? "",
          company: str((j.company as Record<string, unknown>)?.name),
          location,
          description: typeof j.contents === "string" ? htmlToMarkdown(j.contents) : "",
          url: str((j.refs as Record<string, unknown>)?.landing_page),
          externalId: j.id != null ? `muse:${j.id}` : null,
          remote: location ? /\b(remote|flexible)\b/i.test(location) : null,
          source: "web" as const,
          provider: "The Muse",
          categorySourced: true,
        });
      }
      if (results.length < 20) break; // last page
    }
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

    // The family the role maps to — used to keep category-sourced (Muse) rows
    // relevant: we only keep a category row when its title lands in this family.
    const targetFamily = inferFamily(query);

    const settled = await Promise.allSettled([
      fromWorkableGlobal(query),
      fromRemotive(query),
      fromJobicy(query),
      fromArbeitnow(query),
      fromTheMuse(query),
    ]);

    // Collect, dedupe (by url/id AND company+title across sources), drop excluded
    // titles, keep relevant ones, then rank best-first.
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
          const score = titleScore(job.title, query, terms);
          if (job.categorySourced) {
            // Category rows (Muse) match the user's intent by family, not by
            // keyword — their titles rarely contain the exact query word (search
            // "lawyer" → "Senior Counsel"). Keep them when the title lands in the
            // target family; when the query was too generic to map to a family
            // (targetFamily === "other") trust the category fetch as-is. Floor the
            // score at 1 so exact keyword matches still rank above them.
            if (targetFamily !== "other" && inferFamily(job.title) !== targetFamily) continue;
            if (key) seen.add(key);
            seen.add(ctKey);
            scored.push({ job, score: Math.max(score, 1) });
          } else {
            if (score < threshold) continue;
            if (key) seen.add(key);
            seen.add(ctKey);
            scored.push({ job, score });
          }
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
