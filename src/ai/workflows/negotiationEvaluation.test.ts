import { describe, it, expect } from "vitest";
import {
  negotiationEvaluationWorkflow,
  negotiationEvaluationSchema,
} from "@/ai/workflows/negotiationEvaluation";
import { zodToResponseSchema } from "@/ai/schema";

describe("negotiationEvaluationWorkflow", () => {
  it("is a non-grounded QUALITY workflow with an output schema", () => {
    expect(negotiationEvaluationWorkflow.id).toBe("negotiation_evaluation");
    expect(negotiationEvaluationWorkflow.tier).toBe("QUALITY");
    expect(negotiationEvaluationWorkflow.enableSearch).toBe(false);
    expect(negotiationEvaluationWorkflow.outputSchema).toBeDefined();
  });

  it("grades the candidate against the negotiation rubric", () => {
    const system = negotiationEvaluationWorkflow.buildSystem({ role: "SWE", transcript: "" });
    expect(system).toContain("anchoring");
    expect(system).toContain("justification");
    expect(system.toLowerCase()).toContain("candidate");
  });

  it("puts the role and transcript in the prompt", () => {
    const prompt = negotiationEvaluationWorkflow.buildPrompt({
      role: "Staff Engineer",
      transcript: "Candidate: I'm targeting $210k.",
    }) as string;
    expect(prompt).toContain("Staff Engineer");
    expect(prompt).toContain("$210k");
  });
});

describe("negotiationEvaluationSchema", () => {
  const valid = {
    scores: { anchoring: 80, justification: 60, composure: 70, outcome: 50 },
    overall: 65,
    summary: "Solid.",
    strengths: ["Anchored high"],
    improvements: ["Justify more"],
    moveFeedback: [{ move: "Countered at $210k", feedback: "Good anchor", rating: "Strong" }],
  };

  it("accepts a well-formed evaluation", () => {
    expect(negotiationEvaluationSchema.safeParse(valid).success).toBe(true);
  });

  it("is permissive: accepts a sparse object with only scores", () => {
    expect(
      negotiationEvaluationSchema.safeParse({
        scores: { anchoring: 80, justification: 60, composure: 70, outcome: 50 },
      }).success,
    ).toBe(true);
  });

  it("converts to a JSON Schema the gateway can forward to Gemini", () => {
    const schema = zodToResponseSchema(negotiationEvaluationSchema) as {
      type: string;
      properties: Record<string, unknown>;
    };
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining(["scores", "overall", "moveFeedback"]),
    );
  });
});
