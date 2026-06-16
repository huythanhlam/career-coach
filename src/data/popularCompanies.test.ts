import { describe, it, expect } from "vitest";
import {
  canonicalCompanyName,
  companyCacheIdentity,
  selectCompaniesToSeed,
  tickerForCompany,
  POPULAR_COMPANIES,
} from "./popularCompanies";

describe("canonicalCompanyName", () => {
  it("maps a known alias to its canonical name", () => {
    expect(canonicalCompanyName("Google")).toBe("Alphabet (Google)");
    expect(canonicalCompanyName("Facebook")).toBe("Meta");
    expect(canonicalCompanyName("Square")).toBe("Block");
  });

  it("maps the parenthetical and lead-in of a 'Canonical (Alt)' name", () => {
    expect(canonicalCompanyName("Alphabet")).toBe("Alphabet (Google)");
    expect(canonicalCompanyName("Alphabet (Google)")).toBe("Alphabet (Google)");
  });

  it("resolves a ticker symbol", () => {
    expect(canonicalCompanyName("AAPL")).toBe("Apple");
    expect(canonicalCompanyName("googl")).toBe("Alphabet (Google)");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(canonicalCompanyName("  gOOgle  ")).toBe("Alphabet (Google)");
    expect(canonicalCompanyName("META platforms")).toBe("Meta");
  });

  it("passes through unknown companies (trimmed)", () => {
    expect(canonicalCompanyName("  Some Local Startup ")).toBe("Some Local Startup");
  });

  it("returns empty string for empty/undefined input", () => {
    expect(canonicalCompanyName("")).toBe("");
    expect(canonicalCompanyName(undefined)).toBe("");
  });
});

describe("companyCacheIdentity", () => {
  it("lowercases and collapses whitespace of the canonical name", () => {
    expect(companyCacheIdentity("Google")).toBe("alphabet (google)");
    expect(companyCacheIdentity("  apple ")).toBe("apple");
  });

  it("collapses aliases of the same company to one identity", () => {
    expect(companyCacheIdentity("Facebook")).toBe(companyCacheIdentity("Meta"));
    expect(companyCacheIdentity("AAPL")).toBe(companyCacheIdentity("Apple"));
  });
});

describe("selectCompaniesToSeed", () => {
  it("returns every popular company when nothing is warm", () => {
    expect(selectCompaniesToSeed(new Set())).toHaveLength(POPULAR_COMPANIES.length);
  });

  it("excludes companies whose identity is already warm", () => {
    const warm = new Set([companyCacheIdentity("Apple"), companyCacheIdentity("Google")]);
    const pending = selectCompaniesToSeed(warm);
    const names = pending.map((c) => c.name);
    expect(names).not.toContain("Apple");
    expect(names).not.toContain("Alphabet (Google)");
    expect(pending.length).toBe(POPULAR_COMPANIES.length - 2);
  });
});

describe("tickerForCompany", () => {
  it("resolves a canonical name to its ticker", () => {
    expect(tickerForCompany("Apple")).toBe("AAPL");
  });

  it("resolves through aliases and parenthetical forms", () => {
    expect(tickerForCompany("Google")).toBe("GOOGL");
    expect(tickerForCompany("Facebook")).toBe("META");
  });

  it("is case/whitespace/punctuation insensitive", () => {
    expect(tickerForCompany("  apple inc. ")).toBe("AAPL");
  });

  it("resolves S&P-500 names that carry no ticker in the curated list", () => {
    expect(tickerForCompany("3M")).toBe("MMM");
    expect(tickerForCompany("Berkshire Hathaway")).toBe("BRK.B");
    expect(tickerForCompany("Visa")).toBe("V");
  });

  it("returns undefined for unknown or private companies", () => {
    expect(tickerForCompany("Some Private Startup LLC")).toBeUndefined();
    expect(tickerForCompany("Stripe")).toBeUndefined(); // private — intentionally omitted
    expect(tickerForCompany("")).toBeUndefined();
    expect(tickerForCompany(undefined)).toBeUndefined();
  });
});

describe("POPULAR_COMPANIES", () => {
  it("has no duplicate canonical identities", () => {
    const ids = POPULAR_COMPANIES.map((c) => companyCacheIdentity(c.name));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
