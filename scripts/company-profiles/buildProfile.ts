/**
 * Assemble a deterministic CompanyProfile from the structured sources. Every
 * source is isolated: if one throws or returns nothing, that section degrades
 * (with a note) but the rest of the profile still builds. No AI involved.
 */
import type { HttpGet } from "./lib.ts";
import { slugify, dedupeByUrl } from "./lib.ts";
import { fetchWikipedia } from "./sources/wikipedia.ts";
import { fetchWikidata } from "./sources/wikidata.ts";
import { fetchSecFinancials, resolveCik, type TickerMaps } from "./sources/sec.ts";
import { fetchNews } from "./sources/news.ts";
import { fetchRatings, type RenderFn } from "./sources/ratings.ts";
import { buildReviewLinks } from "../../src/config/reviewSites.ts";
import type { CompanyProfile, CompanyListEntry, NewsItem, ProfileSource } from "../../src/types/companyProfile.ts";

/** Deterministic review *links* (no scores — no free rating API exists). */
function ratingLinks(company: string): ProfileSource[] {
  return buildReviewLinks(company).map((l) => ({ ...l, provider: "links" as const }));
}

export interface BuildDeps {
  httpGet: HttpGet;
  /** Pre-loaded SEC ticker/name → CIK maps so we fetch the index once per run. */
  tickerMap?: TickerMaps;
  /** Pre-fetched general business news (shared across companies, fetched once per run). */
  businessNews?: NewsItem[];
  /** Optional headless renderer for sites that need a browser (e.g. RepVue). */
  render?: RenderFn;
}

export async function buildProfile(entry: CompanyListEntry, deps: BuildDeps): Promise<CompanyProfile> {
  const { httpGet, tickerMap, businessNews, render } = deps;
  const slug = entry.slug || slugify(entry.name);
  const notes: string[] = [];
  const sources: ProfileSource[] = [];

  const profile: CompanyProfile = {
    slug,
    name: entry.name,
    keyFacts: {},
    financials: [],
    news: [],
    ratings: [],
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

  // SEC — financials. Resolve the CIK from the ticker (entry or Wikidata) first,
  // then fall back to matching the company name against SEC filer titles, so
  // public companies without an explicit ticker still get financials.
  try {
    const ticker = entry.ticker ?? profile.keyFacts.ticker;
    const cik = tickerMap ? resolveCik(tickerMap, { ticker, name: entry.name }) : undefined;
    if (cik) {
      const sec = await fetchSecFinancials(cik, httpGet);
      profile.financials = sec.financials;
      if (sec.source) sources.push(sec.source);
      if (!sec.financials.length) notes.push("No SEC financials found.");
    } else {
      notes.push("No SEC filer match — financials skipped (likely private or non-US).");
    }
  } catch (e) {
    notes.push(`SEC fetch failed: ${errMsg(e)}`);
  }

  // News — Google News RSS (company-specific) + shared business feeds filtered
  // to this company. Sorted newest-first.
  try {
    const news = await fetchNews(entry.name, httpGet, {
      ticker: entry.ticker ?? profile.keyFacts.ticker,
      businessNews,
    });
    profile.news = news.news;
    if (news.source) sources.push(news.source);
    if (!news.news.length) notes.push("No recent news found.");
  } catch (e) {
    notes.push(`News fetch failed: ${errMsg(e)}`);
  }

  // Ratings — scraped directly from sites that serve them openly (Blind). The
  // CAPTCHA-walled sites (Glassdoor/Indeed/Comparably) are not scraped; they
  // remain links only.
  try {
    profile.ratings = await fetchRatings(entry.name, httpGet, render);
    if (!profile.ratings.length) notes.push("No openly-scrapable employee ratings found (others are CAPTCHA-walled).");
  } catch (e) {
    notes.push(`Ratings fetch failed: ${errMsg(e)}`);
  }

  profile.sources = dedupeByUrl([...sources, ...profile.ratingLinks]);
  if (notes.length) profile.notes = notes;
  return profile;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
