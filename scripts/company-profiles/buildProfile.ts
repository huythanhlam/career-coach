/**
 * Assemble a deterministic CompanyProfile from the structured sources. Every
 * source is isolated: if one throws or returns nothing, that section degrades
 * (with a note) but the rest of the profile still builds. No AI involved.
 */
import type { HttpGet } from "./lib.ts";
import { slugify, dedupeByUrl } from "./lib.ts";
import { fetchWikipedia } from "./sources/wikipedia.ts";
import { fetchWikidata } from "./sources/wikidata.ts";
import { fetchSecFinancials, type TickerMap } from "./sources/sec.ts";
import { fetchNews } from "./sources/news.ts";
import type { CompanyProfile, CompanyListEntry, ProfileSource } from "../../src/types/companyProfile.ts";

/** Deterministic rating *links* (no scores — no free rating API exists). */
function ratingLinks(company: string): ProfileSource[] {
  const q = encodeURIComponent(company);
  return [
    { label: "Glassdoor reviews", url: `https://www.glassdoor.com/Search/results.htm?keyword=${q}`, provider: "links" },
    { label: "Indeed company reviews", url: `https://www.indeed.com/cmp/${encodeURIComponent(company.replace(/\s+/g, "-"))}/reviews`, provider: "links" },
    { label: "Blind", url: `https://www.teamblind.com/search/${q}`, provider: "links" },
    { label: "Comparably", url: `https://www.comparably.com/companies/${slugify(company)}`, provider: "links" },
  ];
}

export interface BuildDeps {
  httpGet: HttpGet;
  /** Pre-loaded SEC ticker→CIK map so we fetch it once per run, not per company. */
  tickerMap?: TickerMap;
}

export async function buildProfile(entry: CompanyListEntry, deps: BuildDeps): Promise<CompanyProfile> {
  const { httpGet, tickerMap } = deps;
  const slug = entry.slug || slugify(entry.name);
  const notes: string[] = [];
  const sources: ProfileSource[] = [];

  const profile: CompanyProfile = {
    slug,
    name: entry.name,
    keyFacts: {},
    financials: [],
    news: [],
    ratingLinks: ratingLinks(entry.name),
    sources: [],
    fetchedAt: new Date().toISOString(),
  };

  // Wikidata — key facts. Run first so it can resolve the exact English
  // Wikipedia title (sitelink), which disambiguates the Wikipedia fetch
  // ("Apple" → "Apple Inc." rather than the fruit).
  let resolvedWikiTitle: string | undefined = entry.wikidataTitle;
  try {
    const wd = await fetchWikidata(entry.wikidataTitle ?? entry.name, httpGet);
    profile.keyFacts = wd.facts;
    if (entry.ticker && !profile.keyFacts.ticker) profile.keyFacts.ticker = entry.ticker;
    if (wd.source) sources.push(wd.source);
    if (!resolvedWikiTitle && wd.enwikiTitle) resolvedWikiTitle = wd.enwikiTitle;
    if (!Object.keys(wd.facts).length) notes.push("No Wikidata facts found.");
  } catch (e) {
    notes.push(`Wikidata fetch failed: ${errMsg(e)}`);
  }

  // Wikipedia — overview + logo (use the disambiguated title when available).
  try {
    const wiki = await fetchWikipedia(resolvedWikiTitle ?? entry.name, httpGet);
    if (wiki.overview) profile.overview = wiki.overview;
    if (wiki.logoUrl) profile.logoUrl = wiki.logoUrl;
    if (wiki.source) sources.push(wiki.source);
    if (!wiki.overview) notes.push("No Wikipedia overview found.");
  } catch (e) {
    notes.push(`Wikipedia fetch failed: ${errMsg(e)}`);
  }

  // SEC — financials (public companies with a known ticker only).
  try {
    const ticker = (entry.ticker ?? profile.keyFacts.ticker)?.toUpperCase();
    const cik = ticker && tickerMap ? tickerMap[ticker] : undefined;
    if (cik) {
      const sec = await fetchSecFinancials(cik, httpGet);
      profile.financials = sec.financials;
      if (sec.source) sources.push(sec.source);
      if (!sec.financials.length) notes.push("No SEC financials found.");
    } else if (ticker) {
      notes.push(`No SEC CIK for ticker ${ticker} (private or non-US?).`);
    } else {
      notes.push("No ticker — financials skipped (likely private).");
    }
  } catch (e) {
    notes.push(`SEC fetch failed: ${errMsg(e)}`);
  }

  // News — Google News RSS.
  try {
    const news = await fetchNews(entry.name, httpGet);
    profile.news = news.news;
    if (news.source) sources.push(news.source);
    if (!news.news.length) notes.push("No recent news found.");
  } catch (e) {
    notes.push(`News fetch failed: ${errMsg(e)}`);
  }

  profile.sources = dedupeByUrl([...sources, ...profile.ratingLinks]);
  if (notes.length) profile.notes = notes;
  return profile;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
