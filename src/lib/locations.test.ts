import { describe, it, expect } from "vitest";
import { normalizeLocation } from "./locations";

describe("normalizeLocation", () => {
  it("returns empty for blank input", () => {
    expect(normalizeLocation("")).toBe("");
    expect(normalizeLocation("   ")).toBe("");
  });

  it("collapses state-name variations to one canonical value", () => {
    expect(normalizeLocation("Austin, TX")).toBe("Austin, TX");
    expect(normalizeLocation("Austin, Texas")).toBe("Austin, TX");
    expect(normalizeLocation("austin tx")).toBe("Austin, TX");
    expect(normalizeLocation("  austin ,  texas ")).toBe("Austin, TX");
    expect(normalizeLocation("austin texas")).toBe("Austin, TX");
  });

  it("strips a trailing country token", () => {
    expect(normalizeLocation("Austin, TX, USA")).toBe("Austin, TX");
    expect(normalizeLocation("Seattle, Washington, United States")).toBe("Seattle, WA");
  });

  it("handles two-word states and cities", () => {
    expect(normalizeLocation("New York, New York")).toBe("New York, NY");
    expect(normalizeLocation("new york ny")).toBe("New York, NY");
    expect(normalizeLocation("Los Angeles, california")).toBe("Los Angeles, CA");
    expect(normalizeLocation("Raleigh, North Carolina")).toBe("Raleigh, NC");
  });

  it("adopts a known location for a bare city when unambiguous", () => {
    expect(normalizeLocation("san francisco")).toBe("San Francisco, CA");
    expect(normalizeLocation("New York")).toBe("New York, NY");
  });

  it("folds remote phrasings", () => {
    expect(normalizeLocation("remote")).toBe("Remote");
    expect(normalizeLocation("Fully Remote")).toBe("Remote");
    expect(normalizeLocation("Remote (US)")).toBe("Remote (US)");
    expect(normalizeLocation("remote - us")).toBe("Remote (US)");
  });

  it("keeps non-US locations in a consistent City, REGION form", () => {
    expect(normalizeLocation("london, uk")).toBe("London, UK");
    expect(normalizeLocation("paris, france")).toBe("Paris, France");
  });

  it("is idempotent — normalizing twice is stable", () => {
    const once = normalizeLocation("austin, texas");
    expect(normalizeLocation(once)).toBe(once);
  });

  it("infers state/country for a known bare city", () => {
    expect(normalizeLocation("london")).toBe("London, UK");
    expect(normalizeLocation("toronto")).toBe("Toronto, Canada");
    expect(normalizeLocation("dubai")).toBe("Dubai, UAE");
    expect(normalizeLocation("seattle")).toBe("Seattle, WA");
  });

  it("collapses country spellings to one country", () => {
    expect(normalizeLocation("usa")).toBe("United States");
    expect(normalizeLocation("U.S.A.")).toBe("United States");
    expect(normalizeLocation("united states")).toBe("United States");
    expect(normalizeLocation("uk")).toBe("United Kingdom");
    expect(normalizeLocation("Great Britain")).toBe("United Kingdom");
  });

  it("collapses non-US sub-regions so a city dedupes regardless of province", () => {
    expect(normalizeLocation("Toronto, Ontario, Canada")).toBe("Toronto, Canada");
    expect(normalizeLocation("Toronto, ON")).toBe("Toronto, Canada");
    expect(normalizeLocation("London, England, United Kingdom")).toBe("London, UK");
  });

  it("handles a US state given before the country", () => {
    expect(normalizeLocation("California")).toBe("California, USA");
    expect(normalizeLocation("Texas, USA")).toBe("Texas, USA");
  });

  it("treats an ambiguous city/state token as the city", () => {
    // "New York" is both a city and a state name; the city reading wins.
    expect(normalizeLocation("New York")).toBe("New York, NY");
  });
});
