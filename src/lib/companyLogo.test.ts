import { describe, it, expect } from "vitest";
import { logoDomain, companyLogoSources, companyMonogram } from "./companyLogo";

describe("logoDomain", () => {
  it("uses the employer's own domain from a non-ATS job URL", () => {
    expect(logoDomain("Acme", "https://careers.acme.com/jobs/123")).toBe("careers.acme.com");
    expect(logoDomain("Acme", "https://www.acme.com/jobs/123")).toBe("acme.com");
  });

  it("ignores ATS/aggregator hosts and derives from the company name instead", () => {
    expect(logoDomain("Stripe", "https://boards.greenhouse.io/stripe/jobs/1")).toBe("stripe.com");
    expect(logoDomain("Notion", "https://jobs.ashbyhq.com/notion/abc")).toBe("notion.com");
    expect(logoDomain("Palantir", "https://jobs.lever.co/palantir/xyz")).toBe("palantir.com");
    expect(logoDomain("Acme", "https://remotive.com/remote-jobs/123")).toBe("acme.com");
  });

  it("normalizes messy company names", () => {
    expect(logoDomain("McDonald's", null)).toBe("mcdonalds.com");
    expect(logoDomain("Scale AI", null)).toBe("scaleai.com");
    expect(logoDomain("Acme, Inc.", null)).toBe("acme.com");
    expect(logoDomain("Smith & Wesson", null)).toBe("smithandwesson.com");
  });

  it("returns null when nothing can be derived", () => {
    expect(logoDomain("", null)).toBeNull();
    expect(logoDomain(undefined, undefined)).toBeNull();
  });
});

describe("companyLogoSources", () => {
  it("returns Clearbit first, then a favicon fallback", () => {
    const s = companyLogoSources("Stripe", "https://boards.greenhouse.io/stripe");
    expect(s[0]).toBe("https://logo.clearbit.com/stripe.com");
    expect(s[1]).toContain("s2/favicons");
    expect(s[1]).toContain("stripe.com");
  });

  it("returns nothing when no domain can be derived", () => {
    expect(companyLogoSources("", null)).toEqual([]);
  });
});

describe("companyMonogram", () => {
  it("returns a stable initial and color", () => {
    const a = companyMonogram("Stripe");
    expect(a.letter).toBe("S");
    expect(a.color).toMatch(/^#/);
    expect(companyMonogram("Stripe").color).toBe(a.color); // deterministic
    expect(companyMonogram("").letter).toBe("?");
  });
});
