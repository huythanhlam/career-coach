import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { uc, injectionTrailer } from "@/ai/prompt";

/**
 * Recruiter's-Eye Screening Simulator: an adversarial recruiter + ATS pass over
 * a resume against a specific job description, returning a go/no-go verdict.
 * Non-grounded, so it uses Gemini's native `responseSchema` instead of the old
 * "output ONLY JSON" prompt + `parseLooseJsonObject`. The schema is permissive
 * (free-text verdict/priority, unbounded score) so a stray field never fails the
 * whole parse — `screenResume` clamps the score, validates the enums, and
 * filters the arrays afterward.
 */

const knockoutSchema = z.object({
  requirement: z.string(),
  met: z.boolean(),
  evidence: z.string(),
});

const fixSchema = z.object({
  /** "high" | "medium" | "low" — coerced by the caller. */
  priority: z.string(),
  label: z.string(),
  detail: z.string(),
});

export const screeningSchema = z.object({
  /** "advance" | "borderline" | "reject" — validated/derived by the caller. */
  verdict: z.string(),
  score: z.number(),
  summary: z.string().optional(),
  knockouts: z.array(knockoutSchema).optional(),
  missingKeywords: z.array(z.string()).optional(),
  fixes: z.array(fixSchema).optional(),
});

export type ScreeningOutput = z.infer<typeof screeningSchema>;

const inputSchema = z.object({
  resumeText: z.string(),
  jobDescription: z.string(),
  jobTitle: z.string().optional(),
  companyName: z.string().optional(),
});

const SYSTEM = `You are an adversarial recruiter and applicant-tracking-system (ATS) parser who screens hundreds of resumes a day. You spend about six seconds on each one and you are deliberately harsh and realistic — most resumes get rejected. You judge ONLY against the specific job description provided, never general "good resume" advice. Be honest but constructive: a tough verdict should still tell the candidate exactly how to fix it.`;

export const screeningWorkflow = defineWorkflow({
  id: "resume_screening",
  tier: "QUALITY",
  inputSchema,
  outputSchema: screeningSchema,
  buildSystem: () => SYSTEM,
  buildPrompt: ({ resumeText, jobDescription, jobTitle, companyName }) => {
    const target = [jobTitle, companyName].filter(Boolean).join(" at ");
    return `
Screen the resume below against the target job the way a real recruiter would in their first pass.
${target ? `\nTARGET ROLE: ${target}\n` : ""}
Produce:
- verdict: "advance" | "borderline" | "reject".
- score: integer 0-100. verdict + score must agree: advance = 75-100 (clears the screen), borderline = 50-74 (could go either way), reject = 0-49 (would be cut).
- summary: 2-3 sentences — the snap judgment a screener would make and why.
- knockouts: the 3-6 most decisive must-have requirements from the job description and whether the resume demonstrably meets each (requirement, met, evidence). A single unmet hard requirement (years of experience, a required degree/clearance, a core technology) should pull the verdict toward reject — reflect that in the score.
- missingKeywords: concrete skills/tools/terms the job description emphasizes that an ATS keyword match would not find in the resume. Empty array if none.
- fixes: 3-6 prioritized, specific changes (priority high|medium|low, a short imperative label of max 8 words, and a 1-2 sentence detail) that would most improve the screen outcome. high = removes a knockout or adds a critical keyword.

Judge only against this job description. Never invent resume content; assess only what is present.

Job description:
${uc(jobDescription)}

Resume:
${uc(resumeText)}
${injectionTrailer()}
`.trim();
  },
});
