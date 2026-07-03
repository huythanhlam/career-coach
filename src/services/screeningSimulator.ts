// Recruiter's-Eye Screening Simulator service.
//
// Runs an adversarial recruiter + ATS pass over a resume against a specific job
// description and returns a structured go/no-go verdict. Mirrors the
// schema-constrained-JSON pattern used by analyzeResume / evaluateInterviewTranscript
// in geminiService.ts: a strict "output ONLY JSON" system prompt, loose JSON
// parsing, then a defensive normalizer (clamp score, validate enums, filter arrays).

import { runWorkflow } from "@/ai/client";
import { screeningWorkflow } from "@/ai/workflows/screening";
import type {
  ScreeningResult,
  ScreeningVerdict,
  ScreeningKnockout,
  ScreeningFix,
  FixPriority,
} from "@/types/screening";

const clampScore = (n: unknown): number =>
  Math.min(100, Math.max(0, Math.round(typeof n === "number" ? n : parseFloat(String(n)) || 0)));

const VERDICTS: readonly ScreeningVerdict[] = ["advance", "borderline", "reject"];
const PRIORITIES: readonly FixPriority[] = ["high", "medium", "low"];

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Derive a verdict from the score when the model's verdict is missing/invalid. */
const verdictFromScore = (score: number): ScreeningVerdict =>
  score >= 75 ? "advance" : score >= 50 ? "borderline" : "reject";

export async function screenResume(
  resumeText: string,
  jobDescription: string,
  jobMeta?: { jobTitle?: string; companyName?: string },
): Promise<ScreeningResult> {
  const result = await runWorkflow(screeningWorkflow, {
    resumeText,
    jobDescription,
    jobTitle: jobMeta?.jobTitle,
    companyName: jobMeta?.companyName,
  });

  if (result.status !== "ok") {
    return {
      verdict: "borderline",
      score: 0,
      knockouts: [],
      missingKeywords: [],
      fixes: [],
      summary: result.error,
    };
  }
  const parsed = result.data as Record<string, unknown>;

  const score = clampScore(parsed.score);
  const verdict: ScreeningVerdict = VERDICTS.includes(parsed.verdict as ScreeningVerdict)
    ? (parsed.verdict as ScreeningVerdict)
    : verdictFromScore(score);

  const knockouts: ScreeningKnockout[] = Array.isArray(parsed.knockouts)
    ? parsed.knockouts
        .filter((k): k is Record<string, unknown> => !!k && typeof k === "object")
        .map((k) => ({
          requirement: str(k.requirement),
          met: k.met === true,
          evidence: str(k.evidence),
        }))
        .filter((k) => k.requirement)
        .slice(0, 8)
    : [];

  const missingKeywords: string[] = Array.isArray(parsed.missingKeywords)
    ? parsed.missingKeywords.map(str).filter(Boolean).slice(0, 20)
    : [];

  const fixes: ScreeningFix[] = Array.isArray(parsed.fixes)
    ? parsed.fixes
        .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
        .map((f) => ({
          priority: PRIORITIES.includes(f.priority as FixPriority)
            ? (f.priority as FixPriority)
            : "medium",
          label: str(f.label),
          detail: str(f.detail),
        }))
        .filter((f) => f.label || f.detail)
        .slice(0, 8)
    : [];

  return {
    verdict,
    score,
    knockouts,
    missingKeywords,
    fixes,
    summary: str(parsed.summary),
    screenedAt: new Date().toISOString(),
  };
}
