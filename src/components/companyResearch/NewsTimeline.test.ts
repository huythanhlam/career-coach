import { describe, it, expect } from "vitest";
import { bulletTimestamp } from "./NewsTimeline";

describe("bulletTimestamp (legacy bullet sorting)", () => {
  it("parses 'Mon DD, YYYY' dates and orders newest-first", () => {
    const older = "3M to create a fire and safety business - 3M News Center · Mar 19, 2026";
    const newer = "Australia Sues 3M for $1.4 Billion - The New York Times · May 28, 2026";
    expect(bulletTimestamp(newer)).toBeGreaterThan(bulletTimestamp(older));
    expect([older, newer].sort((a, b) => bulletTimestamp(b) - bulletTimestamp(a))).toEqual([newer, older]);
  });

  it("parses ISO dates", () => {
    expect(bulletTimestamp("Headline — 2026-05-28 — why")).toBeGreaterThan(
      bulletTimestamp("Headline — 2026-03-19 — why"),
    );
  });

  it("sinks undated bullets to the bottom", () => {
    expect(bulletTimestamp("No date here")).toBe(-Infinity);
  });
});
