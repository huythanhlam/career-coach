import { describe, it, expect } from "vitest";
import { features, featuresByStage, marqueeFeatures, STAGES, type Stage } from "./content";

describe("featuresByStage", () => {
  it("groups every feature exactly once", () => {
    const grouped = featuresByStage();
    const flat = grouped.flatMap((g) => g.features);
    expect(flat).toHaveLength(features.length);
    expect(new Set(flat.map((f) => f.id)).size).toBe(features.length);
  });

  it("orders groups canonically Plan → Apply → Practice → Research", () => {
    const order = featuresByStage().map((g) => g.stage);
    // Only stages that actually have features, but in canonical order.
    const expected = STAGES.filter((s: Stage) => features.some((f) => f.stage === s));
    expect(order).toEqual(expected);
  });

  it("keeps each feature under its own stage", () => {
    for (const group of featuresByStage()) {
      expect(group.features.every((f) => f.stage === group.stage)).toBe(true);
    }
  });

  it("omits stages with no features", () => {
    const single = featuresByStage(features.filter((f) => f.stage === "Research"));
    expect(single).toHaveLength(1);
    expect(single[0].stage).toBe("Research");
  });
});

describe("marqueeFeatures", () => {
  it("returns exactly the four vignette tiles", () => {
    const marquee = marqueeFeatures();
    expect(marquee.map((f) => f.vignette).sort()).toEqual([
      "interview",
      "market",
      "resume",
      "salary",
    ]);
  });

  it("every marquee feature carries a vignette id", () => {
    expect(marqueeFeatures().every((f) => Boolean(f.vignette))).toBe(true);
  });
});
