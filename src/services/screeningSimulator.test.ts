import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the gateway call so we test only the normalizer/defenses.
const generateWorkflowData = vi.fn();
vi.mock("@/services/geminiService", () => ({ generateWorkflowData: (...a: unknown[]) => generateWorkflowData(...a) }));

import { screenResume } from "@/services/screeningSimulator";

describe("screenResume", () => {
  beforeEach(() => generateWorkflowData.mockReset());

  it("normalizes a well-formed response", async () => {
    generateWorkflowData.mockResolvedValue(JSON.stringify({
      verdict: "advance",
      score: 82,
      summary: "Strong match.",
      knockouts: [
        { requirement: "5+ years React", met: true, evidence: "6 years at Acme" },
        { requirement: "AWS", met: false, evidence: "not mentioned" },
        { badrow: true },
      ],
      missingKeywords: ["AWS", "Kubernetes", ""],
      fixes: [{ priority: "high", label: "Add AWS", detail: "Mention cloud work" }],
    }));

    const r = await screenResume("resume", "jd", { jobTitle: "SWE" });
    expect(r.verdict).toBe("advance");
    expect(r.score).toBe(82);
    expect(r.knockouts).toHaveLength(2); // the row with no requirement is dropped
    expect(r.knockouts[1].met).toBe(false);
    expect(r.missingKeywords).toEqual(["AWS", "Kubernetes"]); // empties filtered
    expect(r.fixes[0].priority).toBe("high");
    expect(r.screenedAt).toBeTruthy();
  });

  it("derives the verdict from score when it's invalid, and clamps", async () => {
    generateWorkflowData.mockResolvedValue(JSON.stringify({ verdict: "maybe", score: 140 }));
    const r = await screenResume("resume", "jd");
    expect(r.score).toBe(100); // clamped
    expect(r.verdict).toBe("advance"); // >=75 → advance
  });

  it("coerces an invalid fix priority to medium", async () => {
    generateWorkflowData.mockResolvedValue(JSON.stringify({
      verdict: "reject", score: 30,
      fixes: [{ priority: "urgent", label: "x", detail: "y" }],
    }));
    const r = await screenResume("resume", "jd");
    expect(r.fixes[0].priority).toBe("medium");
  });

  it("returns a safe fallback when the response isn't JSON", async () => {
    generateWorkflowData.mockResolvedValue("The AI service is rate limited. Please try again.");
    const r = await screenResume("resume", "jd");
    expect(r.score).toBe(0);
    expect(r.knockouts).toEqual([]);
    expect(r.summary).toContain("rate limited");
  });
});
