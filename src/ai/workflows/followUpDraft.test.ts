import { describe, it, expect } from "vitest";
import { followUpDraftWorkflow } from "@/ai/workflows/followUpDraft";

describe("followUpDraftWorkflow", () => {
  it("is a free-text FAST workflow with no output schema or search", () => {
    expect(followUpDraftWorkflow.id).toBe("follow_up_draft");
    expect(followUpDraftWorkflow.tier).toBe("FAST");
    expect(followUpDraftWorkflow.enableSearch).toBe(false);
    expect(followUpDraftWorkflow.outputSchema).toBeUndefined();
  });

  it("builds a follow-up system prompt for kind='follow_up'", () => {
    const sys = followUpDraftWorkflow.buildSystem({
      kind: "follow_up",
      jobTitle: "Software Engineer",
      company: "Acme",
      jobDescription: "",
      resumeText: "",
      baseline: "",
    });
    expect(sys).toContain("follow-up email");
    expect(sys).not.toContain("thank-you email");
  });

  it("builds a thank-you system prompt for kind='thank_you'", () => {
    const sys = followUpDraftWorkflow.buildSystem({
      kind: "thank_you",
      jobTitle: "Software Engineer",
      company: "Acme",
      jobDescription: "",
      resumeText: "",
      baseline: "",
    });
    expect(sys).toContain("thank-you email");
    expect(sys).not.toContain("follow-up email");
  });

  it("includes job title, company, description, resume, and baseline in the prompt", () => {
    const prompt = followUpDraftWorkflow.buildPrompt({
      kind: "follow_up",
      jobTitle: "Software Engineer",
      company: "Acme",
      jobDescription: "Build things.",
      resumeText: "Did stuff.",
      baseline: "Senior engineer.",
    }) as string;
    expect(prompt).toContain("Software Engineer");
    expect(prompt).toContain("Acme");
    expect(prompt).toContain("Build things.");
    expect(prompt).toContain("Did stuff.");
    expect(prompt).toContain("Senior engineer.");
  });

  it("falls back to placeholders when job description/resume are empty", () => {
    const prompt = followUpDraftWorkflow.buildPrompt({
      kind: "follow_up",
      jobTitle: "Software Engineer",
      company: "Acme",
      jobDescription: "",
      resumeText: "",
      baseline: "",
    }) as string;
    expect(prompt).toContain("(not provided)");
  });

  it("rejects an invalid kind", () => {
    const bad = followUpDraftWorkflow.inputSchema.safeParse({
      kind: "withdraw",
      jobTitle: "x",
      company: "y",
      jobDescription: "",
      resumeText: "",
      baseline: "",
    });
    expect(bad.success).toBe(false);
  });
});
