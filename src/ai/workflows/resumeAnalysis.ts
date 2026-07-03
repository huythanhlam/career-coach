import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { uc, injectionTrailer } from "@/ai/prompt";

/**
 * Resume analysis (ATS score + prioritized improvements). First workflow
 * migrated onto AI Core v2: non-grounded, so it uses Gemini's native
 * `responseSchema` (from `resumeAnalysisSchema`) instead of the old
 * "return ONLY JSON" prompt + `parseJsonObject` recovery path.
 */

export const improvementSchema = z.object({
  id: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  category: z.enum(["impact", "clarity", "grammar", "keywords", "formatting"]),
  checklistLabel: z.string(),
  description: z.string(),
  originalText: z.string(),
  suggestedText: z.string(),
});

export const resumeAnalysisSchema = z.object({
  resumeText: z.string(),
  overallScore: z.number(),
  summary: z.string(),
  improvements: z.array(improvementSchema),
});

export type ResumeAnalysisOutput = z.infer<typeof resumeAnalysisSchema>;

const inputSchema = z.object({
  /** Full resume text to analyze. */
  resumeText: z.string(),
  /** Target job description (text or URL), or "" for a general review. */
  jd: z.string(),
});

const SYSTEM = `You are an expert resume reviewer and applicant-tracking-system (ATS) specialist who has screened thousands of resumes across many industries. You give honest, specific, prioritized feedback, tailored to the candidate's field and — when provided — the target job.`;

export const resumeAnalysisWorkflow = defineWorkflow({
  id: "resume_analysis",
  tier: "QUALITY",
  inputSchema,
  outputSchema: resumeAnalysisSchema,
  buildSystem: () => SYSTEM,
  buildPrompt: ({ resumeText, jd }) =>
    `
Analyze the resume below and produce a structured ATS review.

Fields:
- resumeText: the full resume as clean Markdown, preserving all content.
- overallScore: integer 0-100.
- summary: 2-3 sentence assessment of key strengths and gaps.
- improvements: 6-15 of the highest-impact improvements, prioritized — do not pad the list or repeat the same issue. Each has:
  - checklistLabel: short imperative label, max 8 words (e.g. "Quantify impact in Work Experience").
  - description: 1-2 sentences explaining what to fix and why.
  - originalText: a SHORT exact substring (one sentence or phrase, not a whole section) copied character-for-character from resumeText so the app can locate and replace it — never paraphrase, abbreviate, or add line breaks that aren't in the source. Do not include the candidate's name or contact info.
  - suggestedText: improved replacement text.

Rules:
- overallScore guide: 85-100 = strong, interview-ready; 70-84 = solid with clear gaps; 50-69 = needs significant work; below 50 = major issues. Score against the target job if one is provided, otherwise against general best practice for the candidate's field.
- impact: flag vague duties (Responsible for, Helped with) and missing metrics; suggest the XYZ pattern (Action + Metric + Result).
- clarity: flag passive voice, sentences over 25 words, jargon.
- grammar: flag tense inconsistency, punctuation errors.
- keywords: flag keywords from the target job that are missing from the resume (high priority); skip this category entirely if no job description was provided.
- formatting: flag inconsistent dates, missing section headers.
${jd ? `\nTarget Job Description:\n${uc(jd)}` : ""}

Resume:
${uc(resumeText)}
${injectionTrailer()}
`.trim(),
});
