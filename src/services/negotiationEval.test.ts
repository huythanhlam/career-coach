import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the gateway call so we test only the normalizer/defenses.
const runWorkflow = vi.fn();
vi.mock("@/ai/client", () => ({
  runWorkflow: (...a: unknown[]) => runWorkflow(...a),
}));

import {
  evaluateNegotiationTranscript,
  buildRecruiterSystemInstruction,
} from "@/services/negotiationEval";

const ok = (data: unknown) => ({ status: "ok", data, sources: [], raw: "" });

describe("buildRecruiterSystemInstruction", () => {
  it("keeps the counterpart in character and injects the scenario", () => {
    const sys = buildRecruiterSystemInstruction({
      role: "Staff Engineer",
      counterpart: "hiring_manager",
      difficulty: "tough",
      scenario: "Base $180k, targeting $210k",
    });
    expect(sys).toContain("hiring manager");
    expect(sys).toContain("Staff Engineer");
    expect(sys).toContain("$180k");
    expect(sys.toLowerCase()).toContain("never coach");
  });
});

describe("evaluateNegotiationTranscript", () => {
  beforeEach(() => runWorkflow.mockReset());

  it("clamps scores and normalizes move ratings", async () => {
    runWorkflow.mockResolvedValue(
      ok({
        scores: { anchoring: 120, justification: -5, composure: 70, outcome: 60 },
        overall: 999,
        summary: "Solid.",
        strengths: ["Anchored high", 42],
        improvements: ["Justify more"],
        moveFeedback: [
          { move: "Countered at $210k", feedback: "Good anchor", rating: "Strong" },
          { move: "Caved fast", feedback: "Too quick", rating: "terrible" },
          { junk: true },
        ],
      }),
    );

    const r = await evaluateNegotiationTranscript({ role: "SWE" }, [
      { role: "model", text: "What are you looking for?" },
      { role: "user", text: "I'm targeting $210k base." },
    ]);

    expect(r.scores.anchoring).toBe(100);
    expect(r.scores.justification).toBe(0);
    expect(r.overall).toBe(100);
    expect(r.strengths).toEqual(["Anchored high"]); // non-strings filtered
    expect(r.moveFeedback).toHaveLength(2); // junk row dropped
    expect(r.moveFeedback[1].rating).toBe("Adequate"); // invalid rating coerced
  });

  it("falls back to averaging when overall is missing", async () => {
    runWorkflow.mockResolvedValue(
      ok({ scores: { anchoring: 80, justification: 60, composure: 80, outcome: 40 } }),
    );
    const r = await evaluateNegotiationTranscript({ role: "SWE" }, []);
    expect(r.overall).toBe(65); // (80+60+80+40)/4
  });

  it("throws when the gateway returns an error", async () => {
    runWorkflow.mockResolvedValue({
      status: "error",
      error: "The AI service is rate limited. Please try again.",
      raw: "",
    });
    await expect(evaluateNegotiationTranscript({ role: "SWE" }, [])).rejects.toThrow(
      /rate limited/,
    );
  });
});
