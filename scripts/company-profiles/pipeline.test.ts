import { describe, it, expect } from "vitest";
import type { HttpGet, HttpResponse } from "./lib.ts";
import { slugify, dedupeByUrl } from "./lib.ts";
import { fetchWikipedia } from "./sources/wikipedia.ts";
import { fetchWikidata, currentEntityId } from "./sources/wikidata.ts";
import { fetchSecFinancials, loadTickerMap } from "./sources/sec.ts";
import { fetchNews } from "./sources/news.ts";
import { buildProfile } from "./buildProfile.ts";

/** Build an HttpGet that returns canned responses keyed by URL substring. */
function mockHttp(routes: { match: string; body: string; ok?: boolean; status?: number }[]): HttpGet {
  return async (url: string): Promise<HttpResponse> => {
    const r = routes.find((x) => url.includes(x.match));
    if (!r) return { ok: false, status: 404, text: "" };
    return { ok: r.ok ?? true, status: r.status ?? 200, text: r.body };
  };
}

describe("slugify", () => {
  it("normalizes names to url-safe slugs", () => {
    expect(slugify("Alphabet (Google)")).toBe("alphabet-google");
    expect(slugify("AT&T")).toBe("at-and-t");
    expect(slugify("  Procter & Gamble  ")).toBe("procter-and-gamble");
    expect(slugify("Saint-Gobain")).toBe("saint-gobain");
  });
});

describe("dedupeByUrl", () => {
  it("removes duplicate urls, preserves order", () => {
    const out = dedupeByUrl([{ url: "a" }, { url: "b" }, { url: "a" }]);
    expect(out.map((x) => x.url)).toEqual(["a", "b"]);
  });
});

describe("fetchWikipedia", () => {
  const summary = JSON.stringify({
    type: "standard",
    title: "Apple Inc.",
    extract: "Apple Inc. is an American multinational technology company.",
    originalimage: { source: "https://img/apple.png" },
    content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Apple_Inc." } },
  });

  it("extracts overview, logo, and source", async () => {
    const http = mockHttp([{ match: "rest_v1/page/summary", body: summary }]);
    const r = await fetchWikipedia("Apple Inc.", http);
    expect(r.overview).toContain("Apple Inc. is an American");
    expect(r.logoUrl).toBe("https://img/apple.png");
    expect(r.source?.provider).toBe("wikipedia");
    expect(r.source?.url).toContain("/wiki/Apple_Inc.");
  });

  it("returns empty for disambiguation pages", async () => {
    const http = mockHttp([{ match: "summary", body: JSON.stringify({ type: "disambiguation" }) }]);
    expect(await fetchWikipedia("Apple", http)).toEqual({});
  });

  it("returns empty on HTTP error", async () => {
    const http = mockHttp([{ match: "summary", body: "", ok: false, status: 500 }]);
    expect(await fetchWikipedia("X", http)).toEqual({});
  });
});

describe("fetchWikidata", () => {
  const searchBody = JSON.stringify({ search: [{ id: "Q312" }] });
  const claimsBody = JSON.stringify({
    entities: {
      Q312: {
        claims: {
          P571: [{ mainsnak: { datavalue: { value: { time: "+1976-04-01T00:00:00Z" } } } }],
          P856: [{ mainsnak: { datavalue: { value: "https://apple.com" } } }],
          P249: [{ mainsnak: { datavalue: { value: "AAPL" } } }],
          P1128: [{
            mainsnak: { datavalue: { value: { amount: "+161000" } } },
            qualifiers: { P585: [{ datavalue: { value: { time: "+2023-01-01T00:00:00Z" } } }] },
          }],
          P159: [{ mainsnak: { datavalue: { value: { id: "Q486868" } } } }],
          P452: [{ mainsnak: { datavalue: { value: { id: "Q11661" } } } }],
        },
      },
    },
  });
  const labelsBody = JSON.stringify({
    entities: {
      Q486868: { labels: { en: { value: "Cupertino" } } },
      Q11661: { labels: { en: { value: "information technology" } } },
    },
  });

  it("resolves facts and referenced labels", async () => {
    const http = mockHttp([
      { match: "wbsearchentities", body: searchBody },
      { match: "props=claims", body: claimsBody },
      { match: "props=labels", body: labelsBody },
    ]);
    const r = await fetchWikidata("Apple", http);
    expect(r.entityId).toBe("Q312");
    expect(r.facts.founded).toBe("1976-04-01");
    expect(r.facts.website).toBe("https://apple.com");
    expect(r.facts.ticker).toBe("AAPL");
    expect(r.facts.employeeCount).toBe(161000);
    expect(r.facts.employeeCountAsOf).toBe("2023");
    expect(r.facts.headquarters).toBe("Cupertino");
    expect(r.facts.industry).toBe("information technology");
    expect(r.source?.url).toBe("https://www.wikidata.org/wiki/Q312");
  });

  it("returns empty facts when search misses", async () => {
    const http = mockHttp([{ match: "wbsearchentities", body: JSON.stringify({ search: [] }) }]);
    expect((await fetchWikidata("Nope", http)).facts).toEqual({});
  });
});

describe("currentEntityId (current officeholder)", () => {
  const claim = (id: string, opts: { start?: string; end?: string; rank?: string } = {}) => ({
    rank: opts.rank ?? "normal",
    mainsnak: { datavalue: { value: { id } } },
    qualifiers: {
      ...(opts.start ? { P580: [{ datavalue: { value: { time: opts.start } } }] } : {}),
      ...(opts.end ? { P582: [{ datavalue: { value: { time: opts.end } } }] } : {}),
    },
  });

  it("honors rank=preferred over a later future-dated holder", () => {
    // Mirrors Apple: Tim Cook (preferred, 2011, ongoing) + a future 2099 successor.
    const claims = {
      P169: [
        claim("Q_old", { start: "+1997-09-01T00:00:00Z", end: "+2011-08-23T00:00:00Z" }),
        claim("Q_cook", { start: "+2011-08-24T00:00:00Z", rank: "preferred" }),
        claim("Q_future", { start: "+2099-09-01T00:00:00Z" }),
      ],
    };
    expect(currentEntityId(claims, "P169")).toBe("Q_cook");
  });

  it("falls back to latest ongoing (no end) when no preferred rank", () => {
    const claims = {
      P169: [
        claim("Q_a", { start: "+2001-01-01T00:00:00Z", end: "+2010-01-01T00:00:00Z" }),
        claim("Q_b", { start: "+2010-01-01T00:00:00Z" }),
      ],
    };
    expect(currentEntityId(claims, "P169")).toBe("Q_b");
  });

  it("returns undefined for missing property", () => {
    expect(currentEntityId({}, "P169")).toBeUndefined();
  });
});

describe("SEC", () => {
  const tickersBody = JSON.stringify({
    "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
    "1": { cik_str: 789019, ticker: "MSFT", title: "Microsoft Corp" },
  });
  const factsBody = JSON.stringify({
    facts: {
      "us-gaap": {
        RevenueFromContractWithCustomerExcludingAssessedTax: {
          units: {
            USD: [
              { end: "2022-09-24", val: 394328000000, fy: 2022, fp: "FY", form: "10-K" },
              { end: "2023-09-30", val: 383285000000, fy: 2023, fp: "FY", form: "10-K" },
              { end: "2023-07-01", val: 81797000000, fy: 2023, fp: "Q3", form: "10-Q" },
            ],
          },
        },
        NetIncomeLoss: { units: { USD: [{ end: "2023-09-30", val: 96995000000, fy: 2023, fp: "FY", form: "10-K" }] } },
        Assets: { units: { USD: [{ end: "2023-09-30", val: 352583000000, fy: 2023, fp: "FY", form: "10-K" }] } },
      },
    },
  });

  it("loadTickerMap indexes ticker → padded CIK", async () => {
    const http = mockHttp([{ match: "company_tickers.json", body: tickersBody }]);
    const map = await loadTickerMap(http);
    expect(map.AAPL).toBe("0000320193");
    expect(map.MSFT).toBe("0000789019");
  });

  it("picks the latest annual (10-K) revenue and other metrics", async () => {
    const http = mockHttp([{ match: "companyfacts/CIK0000320193", body: factsBody }]);
    const r = await fetchSecFinancials("0000320193", http);
    const revenue = r.financials.find((m) => m.label === "Revenue");
    expect(revenue?.value).toBe(383285000000); // 2023 10-K, not the Q3 10-Q
    expect(revenue?.periodEnd).toBe("2023-09-30");
    expect(revenue?.form).toBe("10-K");
    expect(r.financials.map((m) => m.label).sort()).toEqual(["Net income", "Revenue", "Total assets"]);
    expect(r.source?.provider).toBe("sec");
  });

  it("returns no financials without a cik", async () => {
    const http = mockHttp([]);
    expect((await fetchSecFinancials(undefined, http)).financials).toEqual([]);
  });
});

describe("fetchNews", () => {
  const rss = `<rss><channel>
    <item><title><![CDATA[Acme launches product]]></title><link>https://news/1</link><pubDate>Tue, 02 Jun 2026 10:00:00 GMT</pubDate><source url="x">TechCrunch</source></item>
    <item><title>Acme hires CFO</title><link>https://news/2</link><pubDate>Mon, 01 Jun 2026 10:00:00 GMT</pubDate></item>
  </channel></rss>`;

  it("parses items with CDATA, dates, and source", async () => {
    const http = mockHttp([{ match: "news.google.com/rss", body: rss }]);
    const r = await fetchNews("Acme", http);
    expect(r.news).toHaveLength(2);
    expect(r.news[0].title).toBe("Acme launches product");
    expect(r.news[0].url).toBe("https://news/1");
    expect(r.news[0].source).toBe("TechCrunch");
    expect(r.news[0].publishedAt).toBe("2026-06-02T10:00:00.000Z");
    expect(r.source?.provider).toBe("news");
  });
});

describe("buildProfile (composition + degradation)", () => {
  const routes = [
    { match: "rest_v1/page/summary", body: JSON.stringify({ type: "standard", title: "Apple Inc.", extract: "Apple makes phones.", content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Apple_Inc." } } }) },
    { match: "wbsearchentities", body: JSON.stringify({ search: [{ id: "Q312" }] }) },
    { match: "props=claims", body: JSON.stringify({ entities: { Q312: { claims: { P856: [{ mainsnak: { datavalue: { value: "https://apple.com" } } }] } } } }) },
    { match: "companyfacts/CIK0000320193", body: JSON.stringify({ facts: { "us-gaap": { NetIncomeLoss: { units: { USD: [{ end: "2023-09-30", val: 96995000000, fy: 2023, fp: "FY", form: "10-K" }] } } } } }) },
    { match: "news.google.com/rss", body: `<rss><item><title>Apple news</title><link>https://n/1</link></item></rss>` },
  ];

  it("assembles a full profile from all sources", async () => {
    const http = mockHttp(routes);
    const profile = await buildProfile(
      { slug: "apple", name: "Apple", ticker: "AAPL", wikidataTitle: "Apple Inc." },
      { httpGet: http, tickerMap: { AAPL: "0000320193" } },
    );
    expect(profile.slug).toBe("apple");
    expect(profile.overview).toBe("Apple makes phones.");
    expect(profile.keyFacts.website).toBe("https://apple.com");
    expect(profile.keyFacts.ticker).toBe("AAPL"); // backfilled from entry
    expect(profile.financials.find((m) => m.label === "Net income")?.value).toBe(96995000000);
    expect(profile.news).toHaveLength(1);
    expect(profile.ratingLinks.map((l) => l.label)).toContain("Glassdoor reviews");
    expect(profile.sources.some((s) => s.provider === "sec")).toBe(true);
  });

  it("degrades gracefully when a source fails", async () => {
    // Only Wikipedia responds; everything else 404s.
    const http = mockHttp([routes[0]]);
    const profile = await buildProfile(
      { slug: "apple", name: "Apple", ticker: "AAPL" },
      { httpGet: http, tickerMap: {} },
    );
    expect(profile.overview).toBe("Apple makes phones."); // wiki worked
    expect(profile.financials).toEqual([]);                // sec skipped (no cik)
    expect(profile.news).toEqual([]);                      // news missing
    expect(profile.notes && profile.notes.length).toBeGreaterThan(0);
    // A failure never removes the always-present rating links.
    expect(profile.ratingLinks.length).toBe(4);
  });

  it("throwing httpGet for one source does not abort the whole profile", async () => {
    let calls = 0;
    const http: HttpGet = async (url) => {
      calls++;
      if (url.includes("wbsearchentities")) throw new Error("network boom");
      const r = routes.find((x) => url.includes(x.match));
      return r ? { ok: true, status: 200, text: r.body } : { ok: false, status: 404, text: "" };
    };
    const profile = await buildProfile({ slug: "apple", name: "Apple" }, { httpGet: http });
    expect(profile.overview).toBe("Apple makes phones.");
    expect(profile.notes?.some((n) => n.includes("Wikidata fetch failed"))).toBe(true);
    expect(calls).toBeGreaterThan(1);
  });
});
