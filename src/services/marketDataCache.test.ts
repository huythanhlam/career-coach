import { describe, it, expect } from "vitest";
import { yoeToTier, marketCacheKey } from "./marketDataCache";

describe("yoeToTier", () => {
  it("buckets numeric input", () => {
    expect(yoeToTier(0)).toBe("0-2");
    expect(yoeToTier(2)).toBe("0-2");
    expect(yoeToTier(3)).toBe("3-5");
    expect(yoeToTier(5)).toBe("3-5");
    expect(yoeToTier(6)).toBe("6-9");
    expect(yoeToTier(9)).toBe("6-9");
    expect(yoeToTier(10)).toBe("10+");
    expect(yoeToTier(25)).toBe("10+");
  });

  it("parses free-text input, stripping non-numerics", () => {
    expect(yoeToTier("4 years")).toBe("3-5");
    expect(yoeToTier("~8 yrs")).toBe("6-9");
    expect(yoeToTier("12+")).toBe("10+");
  });

  it("returns 'unknown' for unparseable or missing input", () => {
    expect(yoeToTier(undefined)).toBe("unknown");
    expect(yoeToTier("")).toBe("unknown");
    expect(yoeToTier("senior")).toBe("unknown");
  });
});

describe("marketCacheKey", () => {
  it("normalizes case and whitespace", () => {
    expect(
      marketCacheKey({ role: "  Software Engineer ", location: "  Austin ", yoe: "5" }),
    ).toBe("software engineer|austin|3-5");
  });

  it("is order-independent for the two locations", () => {
    const a = marketCacheKey({
      role: "PM",
      location: "San Francisco",
      secondaryLocation: "Austin",
      yoe: "3",
    });
    const b = marketCacheKey({
      role: "PM",
      location: "Austin",
      secondaryLocation: "San Francisco",
      yoe: "3",
    });
    expect(a).toBe(b);
  });

  it("omits an empty secondary location", () => {
    expect(marketCacheKey({ role: "PM", location: "NYC", yoe: "2" })).toBe(
      "pm|nyc|0-2",
    );
  });

  it("folds equal YoE values within a tier into the same key", () => {
    const k1 = marketCacheKey({ role: "PM", location: "NYC", yoe: "3" });
    const k2 = marketCacheKey({ role: "PM", location: "NYC", yoe: "5" });
    expect(k1).toBe(k2);
  });
});
