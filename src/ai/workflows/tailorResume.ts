import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { uc, injectionTrailer } from "@/ai/prompt";
import { prioritySchema } from "@/ai/workflows/shared";

/**
 * Tailor an existing resume to a job description — inline edit suggestions.
 * Non-grounded; native `responseSchema` (array) replaces the old
 * "return ONLY JSON array" + `parseJsonArray` path.
 */

export const tailorSuggestionSchema = z.object({
  id: z.string(),
  section: z.string(),
  type: z.enum(["rewrite", "add_keyword", "strengthen"]),
  originalText: z.string(),
  suggestedText: z.string(),
  rationale: z.string(),
  priority: prioritySchema,
});

// Gemini responseSchema wants an object at the root; the caller unwraps `.suggestions`.
export const tailorResumeSchema = z.object({
  suggestions: z.array(tailorSuggestionSchema),
});

export type TailorSuggestionOutput = z.infer<typeof tailorSuggestionSchema>;

const inputSchema = z.object({
  resumeText: z.string(),
  jobDescription: z.string(),
  targetLine: z.string(),
});

const SYSTEM = `You are an expert resume coach. Your job is to help candidates tailor their existing resume to a specific job description by suggesting targeted inline edits.

CRITICAL RULES:
- Never invent new companies, job titles, dates, projects, or metrics that don't exist in the resume
- Only rewrite or strengthen content that already exists
- You may suggest adding job-relevant keywords where the existing context supports them
- Focus on: keyword alignment, stronger action verbs, quantification of existing achievements, reordering emphasis`;

export const tailorResumeWorkflow = defineWorkflow({
  id: "tailor_resume",
  tier: "QUALITY",
  inputSchema,
  outputSchema: tailorResumeSchema,
  buildSystem: () => SYSTEM,
  buildPrompt: ({ resumeText, jobDescription, targetLine }) =>
    `Analyze the resume below against the job description and produce 6–15 high-impact inline edit suggestions, prioritized, in the "suggestions" array.
${targetLine ? `\nTARGET ROLE: ${targetLine}\n` : ""}
Each suggestion:
- section: section label, e.g. 'Summary', 'Work Experience – Acme Corp'.
- type: "rewrite" | "add_keyword" | "strengthen".
- originalText: a SHORT exact substring (a single sentence or phrase, not a whole section) copied character-for-character from the resume so the app can locate it — never abbreviate or add line breaks that aren't in the source.
- suggestedText: a drop-in replacement — same length/scope as originalText.
- rationale: one sentence naming the specific job-description requirement or keyword this edit targets.
- priority: high = directly matches a key requirement/keyword in the job description.

Rules:
- Do NOT invent new roles, companies, dates, or metrics; only strengthen or reframe what already exists.
- Spread suggestions across the relevant sections (e.g. Summary, Skills, Work Experience) and don't pile more than a few edits into any single section.

JOB DESCRIPTION:
${uc(jobDescription)}

RESUME:
${uc(resumeText)}
${injectionTrailer()}`,
});
