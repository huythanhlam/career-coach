/**
 * Shared utilities for the deterministic company-profile pipeline.
 *
 * `HttpGet` is injected into every source fetcher so tests can supply canned
 * responses (no network) and the runner can supply a real, throttled fetch with
 * a descriptive User-Agent (SEC requires one).
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  text: string;
}

export type HttpGet = (url: string, opts?: { headers?: Record<string, string> }) => Promise<HttpResponse>;

/**
 * Descriptive UA with a contact email — SEC's Akamai layer returns 403 for a UA
 * without one (per https://www.sec.gov/os/webmaster-faq#developers). Override the
 * email via PROFILES_CONTACT_EMAIL.
 */
export const USER_AGENT =
  `CareerCoach/1.0 company-profiles (${process.env.PROFILES_CONTACT_EMAIL ?? "huythanhlam1@gmail.com"})`;

/** Real fetch implementation (Node 18+/22 global fetch). Used by the runner. */
export const realHttpGet: HttpGet = async (url, opts = {}) => {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/html, */*", ...opts.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
};

// Combining diacritics range (U+0300–U+036F), built without a literal so the
// source stays ASCII-clean regardless of editor normalization.
const COMBINING_MARKS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

/** URL-safe, stable id for a company name. */
export function slugify(name: string): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "") // strip combining accents (é → e)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Parse JSON defensively; return null instead of throwing. */
export function safeJson<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Minimal HTML entity decode for RSS/Wikipedia text. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Strip tags to plain text. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s{2,}/g, " ").trim();
}

/** Dedupe sources by URL, preserving order. */
export function dedupeByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (!it?.url || seen.has(it.url)) continue;
    seen.add(it.url);
    out.push(it);
  }
  return out;
}

/** Sleep helper for polite rate-limiting between external calls. */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
