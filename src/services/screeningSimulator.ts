// Recruiter's-Eye Screening Simulator service.
//
// Runs an adversarial recruiter + ATS pass over a resume against a specific job
// description and returns a structured go/no-go verdict. Mirrors the
// schema-constrained-JSON pattern used by analyzeResume / evaluateInterviewTranscript
// in geminiService.ts: a strict "output ONLY JSON" system prompt, loose JSON
// parsing, then a defensive normalizer (clamp score, validate enums, filter arrays).

import { generateWorkflowData } from "@/services/geminiService";
import { MODELS } from "@/config/models";
import { parseLooseJsonObject } from "@/lib/looseJson";
import type {
  ScreeningResult,
  ScreeningVerdict,
  ScreeningKnockout,
  ScreeningFix,
  FixPriority,
} from "@/types/screening";

const SCREENING_SYSTEM = `You are an adversarial recruiter and applicant-tracking-system (ATS) parser who screens hundreds of resumes a day. You spend about six seconds on each one and you are deliberately harsh and realistic — most resumes get rejected. You judge ONLY against the specific job description provided, never general "good resume" advice. Be honest but constructive: a tough verdict should still tell the candidate exactly how to fix it. Output only the requested JSON: no prose, no explanations, no code fences; begin with "{" and end with "}".`;

const buildScreeningPrompt = (
  resumeText: string,
  jd: string,
  jobMeta?: { jobTitle?: string; companyName?: string },
): string => {
  const target = [jobMeta?.jobTitle, jobMeta?.companyName].filter(Boolean).join(" at ");
  return `
Screen the resume below against the target job the way a real recruiter would in their first pass. Return ONLY a raw JSON object — no markdown fences, no explanation.
${target ? `\nTARGET ROLE: ${target}\n` : ""}
Required JSON shape:
{
  "verdict": "advance" | "borderline" | "reject",
  "score": <integer 0-100>,
  "summary": "<2-3 sentences: the snap judgment a screener would make and why>",
  "knockouts": [
    {
      "requirement": "<a hard/explicit requirement stated in the job description>",
      "met": <true | false>,
      "evidence": "<short note on the resume evidence, or what's missing>"
    }
  ],
  "missingKeywords": ["<job-description keywords/skills absent from the resume>"],
  "fixes": [
    {
      "priority": "high" | "medium" | "low",
      "label": "<short imperative, max 8 words>",
      "detail": "<1-2 sentences: exactly what to change to clear the screen>"
    }
  ]
}

Rules:
- verdict + score must agree: advance = 75-100 (clears the screen), borderline = 50-74 (could go either way), reject = 0-49 (would be cut).
- knockouts: list the 3-6 most decisive must-have requirements from the job description and whether the resume demonstrably meets each. A single unmet hard requirement (years of experience, a required degree/clearance, a core technology) should pull the verdict toward reject — reflect that in the score.
- missingKeywords: concrete skills/tools/terms the job description emphasizes that an ATS keyword match would not find in the resume. Empty array if none.
- fixes: 3-6 prioritized, specific changes that would most improve the screen outcome. high = removes a knockout or adds a critical keyword.
- Judge only against this job description. Never invent resume content; assess only what is present.

JOB DESCRIPTION:
${jd}

RESUME:
${resumeText}
`.trim();
};

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
  const prompt = buildScreeningPrompt(resumeText, jobDescription, jobMeta);
  const raw = await generateWorkflowData(SCREENING_SYSTEM, prompt, MODELS.QUALITY);

  let parsed: Record<string, unknown>;
  try {
    parsed = parseLooseJsonObject(raw);
  } catch {
    console.error("Failed to parse screening JSON. Raw preview:", raw.slice(0, 500));
    const looksLikeMessage = !raw.trimStart().startsWith("{");
    return {
      verdict: "borderline",
      score: 0,
      knockouts: [],
      missingKeywords: [],
      fixes: [],
      summary: looksLikeMessage
        ? raw.slice(0, 300)
        : "The screening response couldn't be read. Please try again.",
    };
  }

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
