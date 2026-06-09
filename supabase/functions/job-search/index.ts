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

function matchesQuery(haystack: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const h = haystack.toLowerCase();
  return terms.some((t) => h.includes(t));
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

async function fromArbeitnow(terms: string[]): Promise<NormalizedJob[]> {
  const data = await fetchJson("https://www.arbeitnow.com/api/job-board-api") as { data?: Record<string, unknown>[] };
  return (data.data ?? [])
    .map((j) => ({
      title: str(j.title) ?? "",
      company: str(j.company_name),
      location: str(j.location),
      description: typeof j.description === "string" ? htmlToText(j.description) : "",
      url: str(j.url),
      externalId: str(j.slug) ? `arbeitnow:${j.slug}` : null,
      remote: typeof j.remote === "boolean" ? j.remote : null,
      source: "web" as const,
      provider: "Arbeitnow",
    }))
    .filter((j) => j.title && j.url && matchesQuery(`${j.title} ${j.description}`, terms));
}

async function fromRemoteOk(terms: string[]): Promise<NormalizedJob[]> {
  const data = await fetchJson("https://remoteok.com/api") as Record<string, unknown>[];
  // First element is a legal/metadata notice — skip non-job rows.
  return data
    .filter((j) => j && typeof j === "object" && (j.position || j.id))
    .map((j) => ({
      title: str(j.position) ?? "",
      company: str(j.company),
      location: str(j.location) ?? "Remote",
      description: typeof j.description === "string" ? htmlToText(j.description) : "",
      url: str(j.url),
      externalId: j.id != null ? `remoteok:${j.id}` : null,
      remote: true,
      source: "web" as const,
      provider: "RemoteOK",
    }))
    .filter((j) => j.title && j.url && matchesQuery(`${j.title} ${(j.description ?? "")}`, terms));
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

  const user = await verifyUser(req.headers.get("Authorization"));
  if (!user) return json({ error: "Unauthorized" }, 401, cors);
  if (isRateLimited(user.id)) {
    return json({ error: "Too many searches — please wait a moment and try again." }, 429, cors);
  }

  try {
    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) return json({ error: "Missing query" }, 400, cors);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    const settled = await Promise.allSettled([
      fromRemotive(query),
      fromArbeitnow(terms),
      fromRemoteOk(terms),
    ]);

    const results: NormalizedJob[] = [];
    const errors: string[] = [];
    const seen = new Set<string>();
    for (const s of settled) {
      if (s.status === "fulfilled") {
        for (const job of s.value) {
          const key = job.url ?? job.externalId ?? job.title;
          if (key && seen.has(key)) continue;
          if (key) seen.add(key);
          results.push(job);
        }
      } else {
        errors.push(s.reason instanceof Error ? s.reason.message : "provider failed");
      }
    }

    return json({ results: results.slice(0, 60), errors }, 200, cors);
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500, cors);
  }
});
