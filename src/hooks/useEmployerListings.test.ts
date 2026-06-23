import { describe, it, expect } from "vitest";
import { rowToListing, listingToRow } from "./useEmployerListings";

describe("rowToListing", () => {
  it("maps snake_case columns to camelCase", () => {
    const l = rowToListing({
      id: "l1",
      company_id: "c1",
      title: "Backend Engineer",
      employment_type: "Full-time",
      salary_min: 120000,
      salary_max: 160000,
      salary_currency: "USD",
      status: "published",
      boosted_until: "2026-07-01T00:00:00Z",
      boost_tier: "premium",
      promo_assets: { blurb: "Join us" },
    });
    expect(l.companyId).toBe("c1");
    expect(l.title).toBe("Backend Engineer");
    expect(l.employmentType).toBe("Full-time");
    expect(l.salaryMin).toBe(120000);
    expect(l.status).toBe("published");
    expect(l.boostedUntil).toBe("2026-07-01T00:00:00Z");
    expect(l.promoAssets).toEqual({ blurb: "Join us" });
  });

  it("defaults status to 'draft' and promo_assets to {}", () => {
    const l = rowToListing({ id: "l1", company_id: "c1", title: "x" });
    expect(l.status).toBe("draft");
    expect(l.promoAssets).toEqual({});
  });
});

describe("listingToRow", () => {
  it("maps camelCase to snake_case and skips undefined keys", () => {
    const row = listingToRow({ title: "SRE", companyId: "c1", salaryMin: 100000 });
    expect(row.title).toBe("SRE");
    expect(row.company_id).toBe("c1");
    expect(row.salary_min).toBe(100000);
    // status was not provided → must not appear in the patch
    expect(row).not.toHaveProperty("status");
    expect(row).not.toHaveProperty("location");
  });

  it("coerces provided optional fields to null", () => {
    const row = listingToRow({ title: "SRE", location: undefined, description: "d" });
    // location undefined → omitted; description provided → present
    expect(row).not.toHaveProperty("location");
    expect(row.description).toBe("d");
  });

  it("passes promo_assets jsonb through", () => {
    const row = listingToRow({ promoAssets: { blurb: "hi", pack: { twitterPost: "t" } } });
    expect(row.promo_assets).toEqual({ blurb: "hi", pack: { twitterPost: "t" } });
  });
});
