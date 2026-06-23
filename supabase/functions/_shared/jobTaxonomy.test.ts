import { describe, it, expect } from "vitest";
import { inferFamily, museCategoriesForQuery, MUSE_CATEGORY_BY_FAMILY } from "./jobTaxonomy.ts";

describe("inferFamily", () => {
  it("buckets data roles ahead of engineering", () => {
    expect(inferFamily("Senior Data Engineer")).toBe("data");
    expect(inferFamily("Machine Learning Engineer")).toBe("data");
    expect(inferFamily("Backend Software Engineer")).toBe("engineering");
  });

  it("buckets the non-tech families that the keyword sources miss", () => {
    expect(inferFamily("Corporate Counsel")).toBe("legal");
    expect(inferFamily("Paralegal")).toBe("legal");
    expect(inferFamily("Staff Accountant")).toBe("finance");
    expect(inferFamily("Technical Recruiter")).toBe("people");
    expect(inferFamily("Customer Support Specialist")).toBe("support");
    expect(inferFamily("Supply Chain Analyst")).toBe("operations");
    expect(inferFamily("Account Executive")).toBe("sales");
    expect(inferFamily("Brand Marketing Manager")).toBe("marketing");
    expect(inferFamily("Product Designer")).toBe("design");
    expect(inferFamily("Senior Product Manager")).toBe("product");
  });

  it("falls back to other for unmapped titles", () => {
    expect(inferFamily("Registered Nurse")).toBe("other");
    expect(inferFamily("High School Teacher")).toBe("other");
  });
});

describe("museCategoriesForQuery", () => {
  it("maps a family query to that family's Muse category", () => {
    expect(museCategoriesForQuery("lawyer")).toEqual(["Legal Services"]);
    expect(museCategoriesForQuery("financial analyst")).toEqual(["Accounting and Finance"]);
    expect(museCategoriesForQuery("recruiter")).toEqual(["Human Resources and Recruitment"]);
    expect(museCategoriesForQuery("customer support")).toEqual(["Customer Service"]);
    expect(museCategoriesForQuery("software engineer")).toEqual(["Software Engineering"]);
  });

  it("maps common 'other' roles to a healthcare/education/retail category", () => {
    expect(museCategoriesForQuery("registered nurse")).toEqual(["Healthcare"]);
    expect(museCategoriesForQuery("math teacher")).toEqual(["Education"]);
    expect(museCategoriesForQuery("store manager")).toEqual(["Retail"]);
  });

  it("returns nothing when the query is too generic to target", () => {
    expect(museCategoriesForQuery("coordinator")).toEqual([]);
  });

  it("every non-other family has a Muse category", () => {
    const families = Object.keys(MUSE_CATEGORY_BY_FAMILY);
    expect(families.length).toBe(11);
    for (const c of Object.values(MUSE_CATEGORY_BY_FAMILY)) expect(c.length).toBeGreaterThan(0);
  });
});
