import { describe, it, expect } from "vitest";
import { expandRoleQuery, roleSearchTerms, expandRoleTokens } from "./roleSynonyms";

const lc = (xs: string[]) => xs.map((s) => s.toLowerCase());

describe("expandRoleQuery", () => {
  it("expands SWE / SDE to spelled-out engineering titles", () => {
    const out = lc(expandRoleQuery("SWE"));
    expect(out).toContain("software engineer");
    expect(out).toContain("software developer");
    expect(expandRoleQuery("SWE").length).toBeLessThanOrEqual(3);

    expect(lc(expandRoleQuery("SDE"))).toContain("software engineer");
  });

  it("expands TPM to Technical Program Manager", () => {
    expect(lc(expandRoleQuery("TPM"))).toContain("technical program manager");
  });

  it("maps the spelled-out title back to its abbreviation family", () => {
    const out = lc(expandRoleQuery("Software Engineer"));
    expect(out).toContain("software engineer");
    expect(out).toContain("software developer"); // a sibling synonym
  });

  it("substitutes an abbreviation embedded in a longer query, preserving seniority", () => {
    const out = lc(expandRoleQuery("Senior SWE"));
    expect(out).toContain("senior software engineer");
    expect(out).toContain("senior swe"); // original kept
  });

  it("always includes the original and never returns more than 3 phrases", () => {
    const out = expandRoleQuery("Product Manager");
    expect(out.map((s) => s.toLowerCase())).toContain("product manager");
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it("leaves unknown roles untouched", () => {
    expect(expandRoleQuery("Underwater Basket Weaver")).toEqual(["Underwater Basket Weaver"]);
  });

  it("handles empty input", () => {
    expect(expandRoleQuery("")).toEqual([]);
    expect(expandRoleQuery("   ")).toEqual([]);
  });
});

describe("expandRoleTokens", () => {
  it("includes both abbreviated and spelled-out tokens of the family", () => {
    const t = expandRoleTokens("TPM");
    expect(t.has("technical")).toBe(true);
    expect(t.has("program")).toBe(true);
    expect(t.has("manager")).toBe(true);
    expect(t.has("tpm")).toBe(true);
  });

  it("matches a full title and an abbreviation inside a longer phrase", () => {
    expect(expandRoleTokens("Software Engineer").has("swe")).toBe(true);
    expect(expandRoleTokens("Senior TPM").has("technical")).toBe(true);
    expect(expandRoleTokens("Software Engineer II").has("developer")).toBe(true);
  });

  it("is empty for unknown roles", () => {
    expect(expandRoleTokens("Underwater Basket Weaver").size).toBe(0);
  });
});

describe("roleSearchTerms", () => {
  it("collects de-duped significant terms across phrases", () => {
    const terms = roleSearchTerms(["software engineer", "software developer"]);
    expect(terms).toContain("software");
    expect(terms).toContain("engineer");
    expect(terms).toContain("developer");
    // de-duped: "software" appears once
    expect(terms.filter((t) => t === "software")).toHaveLength(1);
  });
});
