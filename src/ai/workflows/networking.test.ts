import { describe, it, expect } from "vitest";
import {
  outreachTargetsWorkflow,
  outreachTargetsSchema,
  outreachMessageWorkflow,
} from "@/ai/workflows/networking";

describe("outreachTargetsWorkflow", () => {
  it("is a non-grounded FAST workflow with an output schema", () => {
    expect(outreachTargetsWorkflow.id).toBe("networking_targets");
    expect(outreachTargetsWorkflow.tier).toBe("FAST");
    expect(outreachTargetsWorkflow.enableSearch).toBe(false);
    expect(outreachTargetsWorkflow.outputSchema).toBeDefined();
  });

  it("puts the company and target role in the prompt", () => {
    const prompt = outreachTargetsWorkflow.buildPrompt({
      company: "Acme",
      companyIntel: "",
      baseline: "5y SWE",
      targetRole: "Staff Engineer",
    }) as string;
    expect(prompt).toContain("Acme");
    expect(prompt).toContain("Staff Engineer");
    expect(prompt).toContain("5y SWE");
  });

  it("wraps the array output in a targets object", () => {
    const ok = outreachTargetsSchema.safeParse({
      targets: [
        { personaType: "recruiter", title: "Tech Recruiter", rationale: "r", searchQuery: "q" },
      ],
    });
    expect(ok.success).toBe(true);
    expect(outreachTargetsSchema.safeParse({ targets: "nope" }).success).toBe(false);
  });
});

describe("outreachMessageWorkflow", () => {
  it("is a free-text QUALITY workflow (no output schema)", () => {
    expect(outreachMessageWorkflow.id).toBe("networking_message");
    expect(outreachMessageWorkflow.tier).toBe("QUALITY");
    expect(outreachMessageWorkflow.outputSchema).toBeUndefined();
  });

  it("includes the channel, tone, and recipient", () => {
    const prompt = outreachMessageWorkflow.buildPrompt({
      channel: "LinkedIn connection note",
      tone: "Warm",
      recipient: "an Engineering Manager at Acme",
      baseline: "b",
      companyIntel: "",
    }) as string;
    expect(prompt).toContain("LinkedIn connection note");
    expect(prompt).toContain("Warm");
    expect(prompt).toContain("Engineering Manager at Acme");
  });
});
