/**
 * Wikipedia REST summary → company overview + logo/thumbnail.
 * Endpoint: https://en.wikipedia.org/api/rest_v1/page/summary/{title}
 * Free, keyless, returns a clean plain-text `extract` and a thumbnail.
 */
import type { HttpGet } from "../lib.ts";
import { safeJson } from "../lib.ts";
import type { ProfileSource } from "../../../src/types/companyProfile.ts";

export interface WikipediaResult {
  overview?: string;
  logoUrl?: string;
  source?: ProfileSource;
  /** Resolved canonical Wikipedia title (useful for downstream lookups). */
  title?: string;
}

interface WikiSummary {
  type?: string;
  title?: string;
  extract?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

export async function fetchWikipedia(pageTitle: string, httpGet: HttpGet): Promise<WikipediaResult> {
  const title = encodeURIComponent(pageTitle.trim().replace(/\s+/g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
  const res = await httpGet(url);
  if (!res.ok) return {};
  const data = safeJson<WikiSummary>(res.text);
  if (!data || data.type === "disambiguation" || !data.extract) return {};

  const pageUrl = data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${title}`;
  return {
    overview: data.extract,
    logoUrl: data.originalimage?.source ?? data.thumbnail?.source,
    title: data.title,
    source: { label: `Wikipedia — ${data.title ?? pageTitle}`, url: pageUrl, provider: "wikipedia" },
  };
}
