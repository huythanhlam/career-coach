import { describe, it, expect } from "vitest";
import {
  canonicalCompanyName,
  companyCacheIdentity,
  selectCompaniesToSeed,
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

describe("POPULAR_COMPANIES", () => {
  it("has no duplicate canonical identities", () => {
    const ids = POPULAR_COMPANIES.map((c) => companyCacheIdentity(c.name));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
