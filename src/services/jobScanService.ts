import { supabase } from "@/lib/supabaseClient";
import type { AtsProvider, AggregatorJob, ScannedJob, TargetCompany } from "@/types/jobPosting";

// Targeted Job Postings — sourcing layer.
// Two discovery paths (ATS feed scan + Brave web search) plus a single-URL
// importer, each backed by an Edge Function. Kept behind small functions so a
// different provider could be swapped in without touching callers.

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) ?? "";
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

/** POST to a Supabase Edge Function with the user's session token. */
async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? "";
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

/**
 * Scan public ATS feeds, filtered by role keywords. A built-in seed company
 * list is scanned by default (includeSeed), so this works with zero user
 * companies — target role is the only requirement.
 */
export async function scanJobs(
  companies: TargetCompany[],
  keywords: string[],
  includeSeed = true,
  exclude: string[] = [],
): Promise<{ results: ScannedJob[]; errors: { company: string; error: string }[] }> {
  const payload = companies.map((c) => ({ ats: c.ats, boardToken: c.boardToken, name: c.name }));
  return callFunction("scan-jobs", { companies: payload, keywords, exclude, includeSeed });
}

/** Role-keyword search across keyless aggregators (Remotive/Arbeitnow/RemoteOK). */
export async function searchAggregators(query: string, exclude: string[] = []): Promise<AggregatorJob[]> {
  const { results } = await callFunction<{ results: AggregatorJob[] }>("job-search", { query, exclude });
  return results;
}

export interface ImportedJobDraft {
  title?: string;
  company?: string;
  location?: string;
  description: string;
  url: string;
}

/** Parse a single job URL via the existing fetch-url function into an editable draft. */
export async function importJobFromUrl(url: string): Promise<ImportedJobDraft> {
  const { text } = await callFunction<{ text: string }>("fetch-url", { url });
  if (!text || text.trim().length < 40) {
    throw new Error(
      "Couldn't read this posting automatically — many boards load content with JavaScript. Paste the description manually.",
    );
  }
  return { ...parseStructuredPrefix(text), url };
}

/**
 * fetch-url's JSON-LD path prefixes structured lines ("Job Title:", "Company:",
 * "Location:") before the description. Pull those out when present.
 */
function parseStructuredPrefix(text: string): { title?: string; company?: string; location?: string; description: string } {
  const lines = text.split("\n");
  let title: string | undefined;
  let company: string | undefined;
  let location: string | undefined;
  let consumed = 0;
  for (const line of lines.slice(0, 6)) {
    const t = line.match(/^Job Title:\s*(.+)$/i);
    const c = line.match(/^Company:\s*(.+)$/i);
    const l = line.match(/^Location:\s*(.+)$/i);
    if (t) { title = t[1].trim(); consumed++; continue; }
    if (c) { company = c[1].trim(); consumed++; continue; }
    if (l) { location = l[1].trim(); consumed++; continue; }
    if (/^(Employment Type|Salary):/i.test(line)) { consumed++; continue; }
    break;
  }
  const description = (consumed > 0 ? lines.slice(consumed).join("\n") : text).trim();
  return { title, company, location, description };
}

/** Detect the ATS + board token from a company careers URL. */
export function detectAtsFromUrl(rawUrl: string): { ats: AtsProvider; boardToken: string } | null {
  let u: URL;
  try {
    u = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const seg = u.pathname.split("/").filter(Boolean);

  // Greenhouse: boards.greenhouse.io/<token>, job-boards.greenhouse.io/<token>,
  // boards.greenhouse.io/embed/job_board?for=<token>
  if (host.endsWith("greenhouse.io")) {
    const forParam = u.searchParams.get("for");
    if (forParam) return { ats: "greenhouse", boardToken: forParam };
    const token = seg[0] === "embed" ? undefined : seg[0];
    return token ? { ats: "greenhouse", boardToken: token } : null;
  }
  // Lever: jobs.lever.co/<token>
  if (host.endsWith("lever.co")) {
    return seg[0] ? { ats: "lever", boardToken: seg[0] } : null;
  }
  // Ashby: jobs.ashbyhq.com/<token>
  if (host.endsWith("ashbyhq.com")) {
    return seg[0] ? { ats: "ashby", boardToken: seg[0] } : null;
  }
  // Workable: apply.workable.com/<slug>
  if (host.endsWith("workable.com")) {
    return seg[0] ? { ats: "workable", boardToken: seg[0] } : null;
  }
  // SmartRecruiters: careers/jobs.smartrecruiters.com/<slug>
  if (host.endsWith("smartrecruiters.com")) {
    return seg[0] ? { ats: "smartrecruiters", boardToken: seg[0] } : null;
  }
  return null;
}
