import { describe, it, expect } from "vitest";
import { normalizeRatings } from "./geminiService";

describe("normalizeRatings", () => {
  it("keeps a well-formed rating", () => {
    const out = normalizeRatings([
      { source: "Glassdoor", score: 4.1, scale: 5, reviewCount: 18432, url: "https://x", asOf: "2026" },
    ]);
    expect(out).toEqual([
      { source: "Glassdoor", score: 4.1, scale: 5, reviewCount: 18432, url: "https://x", asOf: "2026" },
    ]);
  });

  it("returns [] for non-arrays", () => {
    expect(normalizeRatings(undefined)).toEqual([]);
    expect(normalizeRatings(null)).toEqual([]);
    expect(normalizeRatings({} as unknown)).toEqual([]);
    expect(normalizeRatings("nope" as unknown)).toEqual([]);
  });

  it("drops entries missing url, source, or numeric score/scale", () => {
    const out = normalizeRatings([
      { source: "Indeed", score: 3.9, scale: 5 }, // no url
      { score: 4.0, scale: 5, url: "https://a" }, // no source
      { source: "Blind", score: "high", scale: 5, url: "https://b" }, // non-numeric score
      { source: "X", score: 4, scale: 0, url: "https://c" }, // non-positive scale
    ]);
    expect(out).toEqual([]);
  });

  it("clamps score into [0, scale]", () => {
    const out = normalizeRatings([
      { source: "A", score: 9, scale: 5, url: "https://a" },
      { source: "B", score: -2, scale: 5, url: "https://b" },
    ]);
    expect(out[0].score).toBe(5);
    expect(out[1].score).toBe(0);
  });

  it("coerces reviewCount to a non-negative int, dropping it when invalid", () => {
    const out = normalizeRatings([
      { source: "A", score: 4, scale: 5, url: "https://a", reviewCount: 1200.7 },
      { source: "B", score: 4, scale: 5, url: "https://b", reviewCount: -5 },
      { source: "C", score: 4, scale: 5, url: "https://c", reviewCount: "lots" },
    ]);
    expect(out[0].reviewCount).toBe(1201);
    expect(out[1].reviewCount).toBeUndefined();
    expect(out[2].reviewCount).toBeUndefined();
  });

  it("dedupes by source case-insensitively, keeping the first", () => {
    const out = normalizeRatings([
      { source: "Glassdoor", score: 4.1, scale: 5, url: "https://first" },
      { source: "glassdoor", score: 3.0, scale: 5, url: "https://second" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://first");
  });

  it("trims string fields and drops blank asOf", () => {
    const out = normalizeRatings([
      { source: "  Comparably  ", score: 4.2, scale: 5, url: "  https://c  ", asOf: "  " },
    ]);
    expect(out[0].source).toBe("Comparably");
    expect(out[0].url).toBe("https://c");
    expect(out[0].asOf).toBeUndefined();
  });
});
