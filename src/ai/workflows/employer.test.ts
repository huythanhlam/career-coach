import { describe, it, expect } from "vitest";
import {
  jobDescriptionWorkflow,
  jobDescriptionSchema,
  companyCopyWorkflow,
  fieldRewriteWorkflow,
  promoAssetsWorkflow,
  promoAssetsSchema,
  promoPackWorkflow,
  promoPackSchema,
} from "@/ai/workflows/employer";

describe("employer workflow definitions", () => {
  it("structured workflows are non-grounded with output schemas", () => {
    for (const wf of [jobDescriptionWorkflow, promoAssetsWorkflow, promoPackWorkflow]) {
      expect(wf.enableSearch).toBe(false);
      expect(wf.outputSchema).toBeDefined();
    }
  });

  it("free-text workflows have no output schema", () => {
    expect(companyCopyWorkflow.outputSchema).toBeUndefined();
    expect(fieldRewriteWorkflow.outputSchema).toBeUndefined();
  });

  it("assigns the expected tiers", () => {
    expect(jobDescriptionWorkflow.tier).toBe("QUALITY");
    expect(promoPackWorkflow.tier).toBe("QUALITY");
    expect(companyCopyWorkflow.tier).toBe("FAST");
    expect(fieldRewriteWorkflow.tier).toBe("FAST");
    expect(promoAssetsWorkflow.tier).toBe("FAST");
  });
});

describe("employer output schemas", () => {
  it("job description accepts the three copy fields", () => {
    expect(
      jobDescriptionSchema.safeParse({ description: "d", requirements: "r", responsibilities: "x" })
        .success,
    ).toBe(true);
  });

  it("promo assets accepts the three fields", () => {
    expect(
      promoAssetsSchema.safeParse({ socialPost: "s", outreachEmail: "e", blurb: "b" }).success,
    ).toBe(true);
  });

  it("promo pack accepts string arrays for the variant fields", () => {
    expect(
      promoPackSchema.safeParse({
        linkedinPost: "l",
        twitterPost: "t",
        headlineVariants: ["a", "b"],
        targetingBlurbs: ["x"],
      }).success,
    ).toBe(true);
  });
});
