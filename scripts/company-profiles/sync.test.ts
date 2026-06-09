import { describe, it, expect } from "vitest";
import { toRow } from "./sync.ts";
import { slugify } from "./lib.ts";
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
