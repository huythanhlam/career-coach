import { describe, it, expect } from "vitest";
import { toRow } from "./db.ts";
import { filterTargets } from "./list.ts";
import { slugify } from "./lib.ts";
import type { CompanyListEntry } from "../../src/types/companyProfile.ts";
import { slugifyCompany } from "../../src/services/companyProfileService.ts";
import type { CompanyProfile } from "../../src/types/companyProfile.ts";

const profile: CompanyProfile = {
  slug: "apple",
  name: "Apple",
  overview: "makes phones",
  keyFacts: { ticker: "AAPL" },
  financials: [{ label: "Revenue", value: 1, unit: "USD", periodEnd: "2023-09-30" }],
  news: [],
  ratingLinks: [{ label: "Glassdoor", url: "https://g", provider: "links" }],
  sources: [{ label: "Wikipedia", url: "https://w", provider: "wikipedia" }],
  fetchedAt: "2026-06-09T00:00:00.000Z",
};

describe("sync.toRow", () => {
  it("shapes a DB row with slug, name, data, sources, fetched_at", () => {
    const row = toRow(profile);
    expect(row.slug).toBe("apple");
    expect(row.name).toBe("Apple");
    expect(row.fetched_at).toBe("2026-06-09T00:00:00.000Z");
    expect(row.sources).toEqual(profile.sources);
    expect((row.data as unknown as CompanyProfile).overview).toBe("makes phones");
    expect(typeof row.updated_at).toBe("string");
  });
});

describe("filterTargets", () => {
  const list: CompanyListEntry[] = [
    { slug: "apple", name: "Apple" },
    { slug: "meta", name: "Meta" },
    { slug: "microsoft", name: "Microsoft" },
  ];
  it("returns all when no options", () => {
    expect(filterTargets(list).map((e) => e.slug)).toEqual(["apple", "meta", "microsoft"]);
  });
  it("filters by --only slugs", () => {
    expect(filterTargets(list, { only: ["apple", "microsoft"] }).map((e) => e.slug)).toEqual(["apple", "microsoft"]);
  });
  it("applies --limit", () => {
    expect(filterTargets(list, { limit: 2 }).map((e) => e.slug)).toEqual(["apple", "meta"]);
  });
  it("combines only + limit", () => {
    expect(filterTargets(list, { only: ["meta", "microsoft", "apple"], limit: 1 }).map((e) => e.slug)).toEqual(["apple"]);
  });
});

describe("slugify parity (pipeline lib vs app service)", () => {
  // The app's slugifyCompany must agree with the pipeline's slugify so the app
  // looks up the same row the pipeline wrote.
  const names = ["Apple", "AT&T", "Alphabet (Google)", "Procter & Gamble", "T-Mobile", "Saint-Gobain", "  Spaced  Name  "];
  for (const n of names) {
    it(`agrees on "${n}"`, () => {
      expect(slugifyCompany(n)).toBe(slugify(n));
    });
  }
});
