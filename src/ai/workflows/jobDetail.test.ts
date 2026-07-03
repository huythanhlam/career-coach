import { describe, it, expect } from "vitest";
import { jobFitScoreWorkflow, quickCoverLetterWorkflow } from "@/ai/workflows/jobDetail";

describe("jobFitScoreWorkflow", () => {
  it("is a free-text FAST workflow", () => {
    expect(jobFitScoreWorkflow.id).toBe("job_fit_score");
    expect(jobFitScoreWorkflow.tier).toBe("FAST");
    expect(jobFitScoreWorkflow.outputSchema).toBeUndefined();
  });

  it("asks for an integer score and includes job + candidate context", () => {
    const system = jobFitScoreWorkflow.buildSystem({
      jobTitle: "SWE",
      company: "Acme",
      jobDescription: "d",
      targetRole: "SWE",
      skills: "ts",
      resumeText: "r",
    });
    expect(system.toLowerCase()).toContain("integer");
    const prompt = jobFitScoreWorkflow.buildPrompt({
      jobTitle: "SWE",
      company: "Acme",
      jobDescription: "Build things",
      targetRole: "Staff",
      skills: "ts, go",
      resumeText: "5y",
    }) as string;
    expect(prompt).toContain("SWE");
    expect(prompt).toContain("Acme");
    expect(prompt).toContain("Staff");
  });
});

describe("quickCoverLetterWorkflow", () => {
  it("is a free-text QUALITY workflow", () => {
    expect(quickCoverLetterWorkflow.id).toBe("job_quick_cover_letter");
    expect(quickCoverLetterWorkflow.tier).toBe("QUALITY");
    expect(quickCoverLetterWorkflow.outputSchema).toBeUndefined();
  });

  it("includes the candidate name and forbids placeholders", () => {
    const system = quickCoverLetterWorkflow.buildSystem({
      jobTitle: "SWE",
      company: "Acme",
      jobDescription: "d",
      name: "Jane Doe",
      targetRole: "SWE",
      skills: "ts",
      resumeText: "r",
    });
    expect(system.toLowerCase()).toContain("placeholder");
    const prompt = quickCoverLetterWorkflow.buildPrompt({
      jobTitle: "SWE",
      company: "Acme",
      jobDescription: "d",
      name: "Jane Doe",
      targetRole: "SWE",
      skills: "ts",
      resumeText: "r",
    }) as string;
    expect(prompt).toContain("Jane Doe");
  });
});
