import { describe, it, expect } from "vitest";
import {
  makeLocationMatcher, jobCountryOf, suggestLocations, classifyLevel, classifyWorkplace,
} from "./jobFilters";

describe("jobCountryOf", () => {
  it("resolves countries from common location strings", () => {
    expect(jobCountryOf("New York, NY, United States")).toBe("United States");
    expect(jobCountryOf("San Francisco, CA")).toBe("United States");
    expect(jobCountryOf("London, England, United Kingdom")).toBe("United Kingdom");
    expect(jobCountryOf("London")).toBe("United Kingdom");
    expect(jobCountryOf("Toronto, Canada")).toBe("Canada");
    expect(jobCountryOf("Bengaluru, India")).toBe("India");
  });

  it("returns null for location-flexible strings", () => {
    expect(jobCountryOf("Remote")).toBeNull();
    expect(jobCountryOf("")).toBeNull();
    expect(jobCountryOf(null)).toBeNull();
  });
});

describe("makeLocationMatcher — country gating (the reported bug)", () => {
  it("does NOT match United Kingdom jobs when searching United States", () => {
    const match = makeLocationMatcher("United States");
    expect(match("London, England, United Kingdom", false)).toBe(false); // the bug
    expect(match("Manchester, UK", false)).toBe(false);
    expect(match("New York, NY, United States", false)).toBe(true);
    expect(match("San Francisco, CA", false)).toBe(true);
    expect(match("Remote", true)).toBe(true); // undeterminable → included
  });

  it("does NOT match United States jobs when searching United Kingdom", () => {
    const match = makeLocationMatcher("United Kingdom");
    expect(match("New York, NY, United States", false)).toBe(false);
    expect(match("London, UK", false)).toBe(true);
  });

  it("filters by US state", () => {
    const match = makeLocationMatcher("California");
    expect(match("San Francisco, CA, United States", false)).toBe(true);
    expect(match("Los Angeles, California", false)).toBe(true);
    expect(match("Austin, TX, United States", false)).toBe(false);
    expect(match("London, United Kingdom", false)).toBe(false); // country gate
  });

  it("filters by city", () => {
    const match = makeLocationMatcher("New York");
    expect(match("New York, NY, United States", false)).toBe(true);
    expect(match("Brooklyn, New York", false)).toBe(true);
    expect(match("Seattle, WA", false)).toBe(false);
  });

  it("an empty query matches everything", () => {
    const match = makeLocationMatcher("");
    expect(match("Anywhere", false)).toBe(true);
    expect(match(undefined, false)).toBe(true);
  });

  it("never hides a job whose location is unknown/empty", () => {
    const match = makeLocationMatcher("United States");
    expect(match("", false)).toBe(true);
    expect(match(undefined, false)).toBe(true);
  });
});

describe("suggestLocations", () => {
  it("suggests across city/state/country granularity", () => {
    expect(suggestLocations("new yo").some((s) => s.includes("New York"))).toBe(true);
    expect(suggestLocations("calif").some((s) => s.includes("California"))).toBe(true);
    expect(suggestLocations("united").some((s) => s.includes("United"))).toBe(true);
    expect(suggestLocations("lon").some((s) => s.includes("London"))).toBe(true);
  });

  it("returns popular defaults for an empty query", () => {
    const s = suggestLocations("");
    expect(s.length).toBeGreaterThan(0);
    expect(s).toContain("Remote");
  });
});

describe("classifyLevel", () => {
  it("buckets titles by seniority", () => {
    expect(classifyLevel("Software Engineering Intern")).toBe("intern");
    expect(classifyLevel("Junior Data Analyst")).toBe("entry");
    expect(classifyLevel("Data Analyst")).toBe("mid");
    expect(classifyLevel("Senior Product Manager")).toBe("senior");
    expect(classifyLevel("Principal Engineer")).toBe("lead");
    expect(classifyLevel("Staff Software Engineer")).toBe("lead");
    expect(classifyLevel("Engineering Manager")).toBe("manager");
    expect(classifyLevel("Director of Marketing")).toBe("manager");
  });
});

describe("classifyWorkplace", () => {
  it("detects remote / hybrid / on-site", () => {
    expect(classifyWorkplace({ remote: true })).toBe("remote");
    expect(classifyWorkplace({ location: "Remote - US" })).toBe("remote");
    expect(classifyWorkplace({ description: "This is a hybrid role, 3 days in office." })).toBe("hybrid");
    expect(classifyWorkplace({ location: "New York, NY", remote: false })).toBe("onsite");
  });

  it("prefers hybrid over remote when both are mentioned", () => {
    expect(classifyWorkplace({ description: "Hybrid role with some remote flexibility" })).toBe("hybrid");
  });
});
