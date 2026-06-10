/**
 * Real employer ratings scraped directly from review sites — no AI, no
 * bot-detection bypass.
 *
 * We only read sites that SERVE the data to a normal request. Blind embeds a
 * schema.org `EmployerAggregateRating` in its company page HTML, so we fetch and
 * parse it deterministically. Glassdoor / Indeed / Comparably gate behind a
 * human-verification/CAPTCHA wall (they return a "prove you're human" page, not
 * the rating), so we do NOT scrape them — they stay as links.
 *
 * The parser is generic: any site that exposes an AggregateRating (JSON-LD or
 * inline) is picked up automatically.
 */
import type { HttpGet } from "../lib.ts";
import { safeJson } from "../lib.ts";
import type { CompanyRating } from "../../../src/types/companyProfile.ts";

/** A real browser UA — some sites 403 the default tool UA but serve browsers. */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface ParsedRating {
  score: number;
  scale: number;
  count?: number;
  /** itemReviewed organization name, when present (for verification). */
  itemName?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Pull a numeric AggregateRating out of one parsed JSON-LD value (any nesting). */
function ratingFromNode(node: any): ParsedRating | null {
  if (!node || typeof node !== "object") return null;
  // The node may BE an AggregateRating, or CONTAIN one under `aggregateRating`.
  const type = String(node["@type"] ?? "");
  const isAgg = /AggregateRating/i.test(type);
  const agg = isAgg ? node : node.aggregateRating;
  if (agg && typeof agg === "object") {
    const score = Number(agg.ratingValue);
    const scale = Number(agg.bestRating) || 5;
    const count = Number(agg.ratingCount ?? agg.reviewCount);
    if (Number.isFinite(score) && score > 0 && scale > 0) {
      return {
        score,
        scale,
        count: Number.isFinite(count) && count >= 0 ? Math.round(count) : undefined,
        itemName: typeof node.itemReviewed?.name === "string" ? node.itemReviewed.name
          : typeof agg.itemReviewed?.name === "string" ? agg.itemReviewed.name : undefined,
      };
    }
  }
  return null;
}

/** Walk arrays / @graph to find the first AggregateRating. */
function findRating(value: any): ParsedRating | null {
  if (Array.isArray(value)) {
    for (const v of value) { const r = findRating(v); if (r) return r; }
    return null;
  }
  if (value && typeof value === "object") {
    const direct = ratingFromNode(value);
    if (direct) return direct;
    if (Array.isArray(value["@graph"])) return findRating(value["@graph"]);
  }
  return null;
}

/**
 * Extract an AggregateRating from page HTML: first from JSON-LD blocks, then a
 * loose inline-JSON fallback. Returns null when none is present.
 */
export function parseAggregateRating(html: string): ParsedRating | null {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of blocks) {
    const parsed = safeJson<any>(m[1].trim());
    const r = parsed ? findRating(parsed) : null;
    if (r) return r;
  }
  // Loose fallback: a ratingValue with a nearby count/bestRating in the same window.
  const i = html.indexOf('"ratingValue"');
  if (i >= 0) {
    const win = html.slice(i, i + 220);
    const score = Number(win.match(/"ratingValue"\s*:\s*"?([\d.]+)/)?.[1]);
    const scale = Number(win.match(/"bestRating"\s*:\s*"?([\d.]+)/)?.[1]) || 5;
    const count = Number(win.match(/"(?:ratingCount|reviewCount)"\s*:\s*"?(\d+)/)?.[1]);
    if (Number.isFinite(score) && score > 0) {
      return { score, scale, count: Number.isFinite(count) ? count : undefined };
    }
  }
  return null;
}

/** Loose name match so we don't attribute another company's page. */
function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

/** Scrape Blind's open EmployerAggregateRating for a company. null on miss/mismatch. */
export async function fetchBlindRating(company: string, httpGet: HttpGet): Promise<CompanyRating | null> {
  const url = `https://www.teamblind.com/company/${encodeURIComponent(company.trim())}`;
  const res = await httpGet(url, { headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" } });
  if (!res.ok) return null;
  const r = parseAggregateRating(res.text);
  if (!r) return null;
  // Guard against a fuzzy URL resolving to a different company.
  if (r.itemName && !namesMatch(r.itemName, company)) return null;
  return {
    source: "Blind",
    score: r.score,
    scale: r.scale,
    reviewCount: r.count,
    url,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch all real ratings we can read directly. Currently Blind (open JSON-LD);
 * other sites are CAPTCHA-walled and intentionally not scraped. Each fetcher
 * fails soft (returns null) so one site never breaks the rest.
 */
export async function fetchRatings(company: string, httpGet: HttpGet): Promise<CompanyRating[]> {
  const results = await Promise.allSettled([fetchBlindRating(company, httpGet)]);
  return results
    .filter((r): r is PromiseFulfilledResult<CompanyRating | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is CompanyRating => v !== null);
}
