/**
 * Recent company news from free, keyless RSS feeds.
 *
 * Two kinds of source, merged → deduped → sorted newest-first → top N:
 *  1. Google News RSS, queried for the company by name (company-specific).
 *  2. General business/markets feeds (CNBC, NYT Business, MarketWatch, Fox
 *     Business). These are NOT company-specific, so their items are filtered to
 *     the ones whose headline actually names the company or its ticker. They are
 *     identical for every company, so the runner fetches them ONCE per run via
 *     `fetchBusinessNews` and passes the shared list into each `fetchNews` call.
 *
 * The newest-first sort is the key behaviour: Google News returns items in
 * RELEVANCE order, so taking the first N surfaced months-old "big" stories. We
 * now collect everything in the window and sort by date before slicing.
 */
import type { HttpGet } from "../lib.ts";
import { decodeEntities, stripTags } from "../lib.ts";
import type { NewsItem, ProfileSource } from "../../../src/types/companyProfile.ts";

export interface NewsResult {
  news: NewsItem[];
  source?: ProfileSource;
}

/** A general business/markets RSS feed (not company-specific). */
interface BusinessFeed {
  label: string;
  url: string;
}

/**
 * General business feeds whose items are filtered down to the company at hand.
 * (Google Finance has no public RSS and Yahoo Finance's feed is anti-bot
 * walled, so neither can be consumed; these are the working equivalents.)
 */
const BUSINESS_FEEDS: BusinessFeed[] = [
  { label: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147" },
  { label: "NYT Business", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml" },
  { label: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  { label: "Fox Business", url: "https://moxie.foxbusiness.com/google-publisher/markets.xml" },
];

// Some publisher feeds (e.g. Fox/Dow Jones) reject the default pipeline UA;
// a normal browser UA is accepted by all four.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Extract the text of the first matching tag inside an <item> block. */
function tag(block: string, name: string): string | undefined {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
  const m = block.match(re);
  if (!m) return undefined;
  // Strip CDATA wrappers, decode entities, drop residual tags.
  const raw = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return stripTags(decodeEntities(raw)).trim() || undefined;
}

/** Item link: prefer <link>text</link>, fall back to an Atom <link href="…">. */
function itemLink(block: string): string | undefined {
  const text = tag(block, "link");
  if (text) return text;
  const href = block.match(/<link[^>]*href="([^"]+)"/i);
  return href ? decodeEntities(href[1]) : undefined;
}

function isoDate(pubDate: string | undefined): string | undefined {
  if (!pubDate) return undefined;
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Parse an RSS 2.0 document into news items (no per-company filtering here). */
export function parseRssItems(xml: string, fallbackSource?: string): NewsItem[] {
  const blocks = xml.split(/<item(?:\s[^>]*)?>/i).slice(1);
  const out: NewsItem[] = [];
  for (const block of blocks) {
    const title = tag(block, "title");
    const url = itemLink(block);
    if (!title || !url) continue;
    out.push({
      title,
      url,
      publishedAt: isoDate(tag(block, "pubDate")),
      source: tag(block, "source") ?? fallbackSource,
    });
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Distinctive name variants to match a general-news headline against. */
function nameTerms(name: string): string[] {
  const cleaned = name
    .replace(/\([^)]*\)/g, " ") // drop "(Google)" etc.
    .replace(/\b(inc|corp|corporation|co|company|ltd|plc|llc|group|holdings|sa|nv|ag)\b\.?/gi, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return Array.from(new Set([cleaned, name.trim()].filter((t) => t.length >= 2)));
}

/**
 * Does a (general-news) headline mention this company? Name match is
 * case-insensitive on word boundaries; ticker match is case-SENSITIVE (so the
 * uppercase symbol "CAT" doesn't match the word "cat").
 */
export function mentionsCompany(title: string, name: string, ticker?: string): boolean {
  for (const term of nameTerms(name)) {
    if (new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(title)) return true;
  }
  if (ticker && ticker.length >= 2 && new RegExp(`\\b${escapeRegExp(ticker)}\\b`).test(title)) return true;
  return false;
}

/**
 * Normalize a headline for dedup matching. Google News appends " - Publisher"
 * to titles, so its redirect copy of a story and the publisher's direct-feed
 * copy differ by that tail — strip it so the two collapse to one.
 */
function titleKey(title: string): string {
  return title
    .replace(/\s+[-–|]\s+[^-–|]+$/, "") // drop trailing " - Publisher"
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Dedupe by URL and by normalized title (drops the same story from two feeds). */
function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    const t = titleKey(it.title);
    if (!it.url || seenUrl.has(it.url) || seenTitle.has(t)) continue;
    seenUrl.add(it.url);
    seenTitle.add(t);
    out.push(it);
  }
  return out;
}

/** Newest-first; items without a parseable date sink to the bottom. */
function byNewest(a: NewsItem, b: NewsItem): number {
  return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
}

/**
 * Fetch the shared general-business feeds ONCE (call per run, not per company).
 * Each feed degrades independently — a failing/blocked feed contributes nothing.
 */
export async function fetchBusinessNews(httpGet: HttpGet): Promise<NewsItem[]> {
  const lists = await Promise.all(
    BUSINESS_FEEDS.map(async (feed) => {
      try {
        const res = await httpGet(feed.url, { headers: { "User-Agent": BROWSER_UA } });
        return res.ok ? parseRssItems(res.text, feed.label) : [];
      } catch {
        return [];
      }
    }),
  );
  return lists.flat();
}

/** Default number of news items kept per company (the feed returns ~100). */
const DEFAULT_LIMIT = 12;

export interface FetchNewsOptions {
  /** Company ticker, used to also match general-news headlines by symbol. */
  ticker?: string;
  /** Max items to return (after merge + sort). Defaults to {@link DEFAULT_LIMIT}. */
  limit?: number;
  /** Pre-fetched general business news (from `fetchBusinessNews`) to filter. */
  businessNews?: NewsItem[];
}

export async function fetchNews(
  company: string,
  httpGet: HttpGet,
  opts: FetchNewsOptions = {},
): Promise<NewsResult> {
  const { ticker, limit = DEFAULT_LIMIT, businessNews = [] } = opts;

  // 1. Company-specific Google News query (kept at a 90-day window).
  const q = encodeURIComponent(`${company} when:90d`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  let googleItems: NewsItem[] = [];
  const res = await httpGet(url);
  if (res.ok) googleItems = parseRssItems(res.text);

  // 2. Shared business news, filtered to headlines that name this company.
  const businessItems = businessNews.filter((n) => mentionsCompany(n.title, company, ticker));

  // Merge (Google first so it wins ties), sort newest-first, dedupe, take top N.
  const news = dedupeNews([...googleItems, ...businessItems].sort(byNewest)).slice(0, limit);

  return {
    news,
    source: news.length
      ? { label: "Google News", url: `https://news.google.com/search?q=${encodeURIComponent(company)}`, provider: "news" }
      : undefined,
  };
}
