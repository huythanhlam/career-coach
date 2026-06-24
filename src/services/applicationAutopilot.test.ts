import { describe, it, expect } from "vitest";
import { applyTailorSuggestions } from "@/services/applicationAutopilot";
import type { TailorSuggestion } from "@/services/geminiService";

function suggestion(partial: Partial<TailorSuggestion>): TailorSuggestion {
  return {
    id: "1", section: "Work", type: "rewrite", priority: "high",
    originalText: "", suggestedText: "", rationale: "",
    ...partial,
  };
}

describe("applyTailorSuggestions", () => {
  it("replaces an exact substring match", () => {
    const resume = "Responsible for the team and shipping features.";
    const out = applyTailorSuggestions(resume, [
      suggestion({ originalText: "Responsible for the team", suggestedText: "Led a team of 5" }),
    ]);
    expect(out).toBe("Led a team of 5 and shipping features.");
  });

  it("skips suggestions whose originalText isn't found (no hallucinated edits)", () => {
    const resume = "Built an internal tool.";
    const out = applyTailorSuggestions(resume, [
      suggestion({ originalText: "Managed budgets", suggestedText: "Owned a $2M budget" }),
    ]);
    expect(out).toBe(resume);
  });

  it("ignores entries missing original or suggested text", () => {
    const resume = "Did things.";
    const out = applyTailorSuggestions(resume, [
      suggestion({ originalText: "", suggestedText: "x" }),
      suggestion({ originalText: "Did things.", suggestedText: "" }),
    ]);
    expect(out).toBe(resume);
  });

  it("applies multiple distinct edits", () => {
    const resume = "Alpha. Beta. Gamma.";
    const out = applyTailorSuggestions(resume, [
      suggestion({ originalText: "Alpha.", suggestedText: "Alpha+." }),
      suggestion({ originalText: "Gamma.", suggestedText: "Gamma+." }),
    ]);
    expect(out).toBe("Alpha+. Beta. Gamma+.");
  });
});
