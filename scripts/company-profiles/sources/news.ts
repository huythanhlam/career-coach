/**
 * Google News RSS → recent news items (headline, link, date, source).
 * Free, keyless, structured XML. We take the top N items.
 */
import type { HttpGet } from "../lib.ts";
import { decodeEntities, stripTags } from "../lib.ts";
import type { NewsItem, ProfileSource } from "../../../src/types/companyProfile.ts";

export interface NewsResult {
  news: NewsItem[];
  source?: ProfileSource;
}

/** Extract the text of the first matching tag inside an <item> block. */
function tag(block: string, name: string): string | undefined {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
  const m = block.match(re);
  if (!m) return undefined;
  // Strip CDATA wrappers, decode entities, drop residual tags.
  const raw = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return stripTags(decodeEntities(raw)).trim() || undefined;
}

function isoDate(pubDate: string | undefined): string | undefined {
  if (!pubDate) return undefined;
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function fetchNews(company: string, httpGet: HttpGet, limit = 6): Promise<NewsResult> {
  const q = encodeURIComponent(`${company} when:90d`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  const res = await httpGet(url);
  if (!res.ok) return { news: [] };

  const items = res.text.split(/<item>/i).slice(1);
  const news: NewsItem[] = [];
  for (const block of items) {
    const title = tag(block, "title");
    const link = tag(block, "link");
    if (!title || !link) continue;
    news.push({
      title,
      url: link,
      publishedAt: isoDate(tag(block, "pubDate")),
      source: tag(block, "source"),
    });
    if (news.length >= limit) break;
  }

  return {
    news,
    source: news.length
      ? { label: "Google News", url: `https://news.google.com/search?q=${encodeURIComponent(company)}`, provider: "news" }
      : undefined,
  };
}
