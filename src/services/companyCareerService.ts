import { supabase } from "@/lib/supabaseClient";
import { discoverCareerUrls } from "@/services/geminiService";
import type { SourceLink } from "@/config/companyResearchSources";

/**
 * Career-site navigation layer for Research Company.
 *
 * The profile tier is only as good as its sources. To genuinely "navigate to
 * the company's career website and extract details" (rather than rely on a
 * web-search summary), we:
 *   1. ask the grounded model for the company's OWN careers/culture/benefits/
 *      interview page URLs (`discoverCareerUrls`), then
 *   2. fetch each page's readable text through the existing SSRF-safe `fetch-url`
 *      Edge Function — the same one the job-import flow uses.
 *
 * The concatenated primary-source text + the real page URLs are then handed to
 * `researchCompanyProfile` as authoritative grounding. Every step is best-effort:
 * many large-company careers pages are JavaScript-rendered and return little, so
 * a thin/empty result simply falls back to the model's own grounded browsing.
 */

// Derive the fetch-url endpoint from the AI gateway URL (like blsService) so it
// resolves to the local Express gateway in dev (/api/ai/generate → /api/fetch-url)
// and the Supabase Edge Function in prod — otherwise the careers crawl can't run
// in local dev.
const FETCH_URL_ENDPOINT = (
  (import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000/api/ai/generate"
)
  .replace(/\/api\/ai\/generate\/?$/, "/api/fetch-url")
  .replace(/\/functions\/v1\/ai-generate\/?$/, "/functions/v1/fetch-url");

const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

// Per-page caps so several scraped pages stay within the profile call's input budget.
const PER_PAGE_CHARS = 3500;
const MIN_USEFUL_CHARS = 120;

/** Fetch one URL's readable text via the SSRF-safe `fetch-url` Edge Function. */
async function fetchPageText(url: string): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? "";
  const res = await fetch(FETCH_URL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) return "";
  const data = (await res.json().catch(() => ({}))) as { text?: string };
  return typeof data.text === "string" ? data.text : "";
}

/**
 * Navigate the company's own careers pages and return their scraped text plus
 * the URLs actually read (for citation). Never throws — returns empty context if
 * discovery or every fetch fails.
 */
export async function fetchCareerPageContext(
  company: string,
): Promise<{ text: string; sources: SourceLink[] }> {
  try {
    const links = await discoverCareerUrls(company);
    const c = company.trim() || "Company";
    const candidates: SourceLink[] = [
      links.careers && { label: `${c} careers`, url: links.careers },
      links.culture && { label: `${c} culture`, url: links.culture },
      links.benefits && { label: `${c} benefits`, url: links.benefits },
      links.interview && { label: `${c} interview process`, url: links.interview },
    ].filter((x): x is SourceLink => !!x);

    // Dedupe by URL (the model often returns the same landing page for several keys).
    const seen = new Set<string>();
    const pages = candidates.filter((p) => {
      const key = p.url
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "")
        .toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (pages.length === 0) return { text: "", sources: [] };

    const fetched = await Promise.all(
      pages.map(async (p) => ({ page: p, text: await fetchPageText(p.url).catch(() => "") })),
    );

    const parts: string[] = [];
    const sources: SourceLink[] = [];
    for (const { page, text } of fetched) {
      if (text.trim().length >= MIN_USEFUL_CHARS) {
        parts.push(`## ${page.label} — ${page.url}\n${text.trim().slice(0, PER_PAGE_CHARS)}`);
        sources.push(page);
      }
    }
    return { text: parts.join("\n\n"), sources };
  } catch {
    return { text: "", sources: [] };
  }
}
