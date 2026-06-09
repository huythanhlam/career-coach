/**
 * Fallback verification links for the Research Company workflow.
 *
 * The feature researches companies with live web search and cites the real
 * sources it retrieves. When grounding returns no source for a section (or the
 * search tool is unavailable), we still want every card to offer a "verify and
 * deep-dive" link. These are deterministic, always-resolvable search/landing
 * URLs built from the company name — they never 404, so the user can always
 * click through to confirm. Mirrors the philosophy of `marketDataSources.ts`.
 */

export interface SourceLink {
  label: string;
  url: string;
}

/**
 * Build the canonical set of verification destinations for a company. Keyed so
 * callers can pick a section-appropriate fallback (`careers`, `reviews`,
 * `news`, `financials`) or use `Object.values()` for a full "sources" list.
 */
export function buildCompanyResearchSources(company: string): {
  careers: SourceLink;
  reviews: SourceLink;
  news: SourceLink;
  financials: SourceLink;
  filings: SourceLink;
} {
  const c = (company ?? "").trim();
  const q = encodeURIComponent(c);
  return {
    careers: { label: `${c || "Company"} careers`, url: `https://www.google.com/search?q=${encodeURIComponent(`${c} careers`)}` },
    reviews: { label: "Glassdoor reviews", url: `https://www.glassdoor.com/Search/results.htm?keyword=${q}` },
    news: { label: "Google News", url: `https://news.google.com/search?q=${q}` },
    financials: { label: "Yahoo Finance", url: `https://finance.yahoo.com/lookup?s=${q}` },
    filings: { label: "SEC EDGAR filings", url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${q}&type=10-Q&dateb=&owner=include&count=40` },
  };
}
