import { describe, it, expect } from "vitest";
import {
  cleanText,
  buildJobDescriptionPrompt,
  buildCompanyCopyPrompt,
  buildRewriteFieldPrompt,
  buildPromoPrompt,
  buildPromoPackPrompt,
  JOB_DESCRIPTION_SYSTEM,
  PROMO_ASSETS_SYSTEM,
} from "./employerService";

describe("cleanText", () => {
  it("strips ```json fences", () => {
    expect(cleanText('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("strips a plain code fence", () => {
    expect(cleanText("```\nhello\n```")).toBe("hello");
  });
  it("strips wrapping quotes", () => {
    expect(cleanText('"quoted"')).toBe("quoted");
  });
  it("leaves clean text untouched", () => {
    expect(cleanText("  just text  ")).toBe("just text");
  });
});

describe("buildJobDescriptionPrompt", () => {
  it("includes the title, company, and key points", () => {
    const prompt = buildJobDescriptionPrompt({
      title: "Staff SRE",
      companyName: "Acme",
      keyPoints: "owns reliability; Go; on-call",
    });
    expect(prompt).toContain("Staff SRE");
    expect(prompt).toContain("Acme");
    expect(prompt).toContain("owns reliability");
  });

  it("omits optional lines that aren't provided", () => {
    const prompt = buildJobDescriptionPrompt({ title: "SRE" });
    expect(prompt).toContain("SRE");
    expect(prompt).not.toContain("Company:");
    expect(prompt).not.toContain("Seniority:");
  });

  it("the system prompt names the output fields and forbids invention", () => {
    // Structure is enforced by the native responseSchema now, so the prompt
    // describes the fields rather than demanding raw JSON.
    expect(JOB_DESCRIPTION_SYSTEM).toMatch(/description.*requirements.*responsibilities/is);
    expect(JOB_DESCRIPTION_SYSTEM.toLowerCase()).toContain("never invent");
  });
});

describe("buildCompanyCopyPrompt", () => {
  it("says 'Write' for a fresh field and 'Improve' when there's an existing draft", () => {
    const fresh = buildCompanyCopyPrompt("about", { name: "Acme" });
    expect(fresh).toContain("Write");
    expect(fresh).toContain("Acme");
    const improve = buildCompanyCopyPrompt("about", { name: "Acme", existing: "We do stuff." });
    expect(improve).toContain("Improve");
    expect(improve).toContain("We do stuff.");
  });
});

describe("buildRewriteFieldPrompt", () => {
  it("includes the selection, instruction, and context", () => {
    const prompt = buildRewriteFieldPrompt("old text", "make it punchier", "full doc context");
    expect(prompt).toContain("old text");
    expect(prompt).toContain("make it punchier");
    expect(prompt).toContain("full doc context");
  });
});

describe("promo prompt builders", () => {
  it("buildPromoPrompt includes role/company; the system names the promo fields", () => {
    const prompt = buildPromoPrompt({ title: "PM", companyName: "Acme" });
    expect(prompt).toContain("PM");
    expect(prompt).toContain("Acme");
    expect(PROMO_ASSETS_SYSTEM).toMatch(/socialPost/);
  });

  it("buildPromoPackPrompt flags the boosted pack", () => {
    const prompt = buildPromoPackPrompt({ title: "PM" });
    expect(prompt.toLowerCase()).toContain("pack");
    expect(prompt).toContain("PM");
  });
});
