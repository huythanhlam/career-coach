import { describe, it, expect } from "vitest";
import { isBoostActive, validateListingDraft } from "./employerListing";

describe("isBoostActive", () => {
  it("is false for undefined or empty", () => {
    expect(isBoostActive(undefined)).toBe(false);
    expect(isBoostActive("")).toBe(false);
  });

  it("is false for a past timestamp", () => {
    expect(isBoostActive(new Date(Date.now() - 60_000).toISOString())).toBe(false);
  });

  it("is true for a future timestamp", () => {
    expect(isBoostActive(new Date(Date.now() + 60_000).toISOString())).toBe(true);
  });

  it("is false for an unparseable value", () => {
    expect(isBoostActive("not-a-date")).toBe(false);
  });
});

describe("validateListingDraft", () => {
  it("requires a title and a company", () => {
    const errors = validateListingDraft({});
    expect(errors.title).toBeTruthy();
    expect(errors.companyId).toBeTruthy();
  });

  it("passes when title and company are present", () => {
    const errors = validateListingDraft({ title: "SRE", companyId: "c1" });
    expect(errors).toEqual({});
  });

  it("flags an inverted salary range", () => {
    const errors = validateListingDraft({ title: "SRE", companyId: "c1", salaryMin: 200000, salaryMax: 100000 });
    expect(errors.salary).toBeTruthy();
  });

  it("accepts a valid salary range", () => {
    const errors = validateListingDraft({ title: "SRE", companyId: "c1", salaryMin: 100000, salaryMax: 200000 });
    expect(errors.salary).toBeUndefined();
  });

  it("flags a negative salary", () => {
    const errors = validateListingDraft({ title: "SRE", companyId: "c1", salaryMin: -5 });
    expect(errors.salary).toBeTruthy();
  });
});
