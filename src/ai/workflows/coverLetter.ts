import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { basePersona } from "@/config/workflows";

/**
 * Draft a focused one-page cover letter for a specific job. Free-text (no
 * `outputSchema`) — `runWorkflow` returns the letter verbatim and the caller
 * strips any stray fences.
 */

const COVER_LETTER_SYSTEM = `${basePersona}

Now write a focused, one-page cover letter (roughly 250-380 words) for a specific job. Structure: a strong opening hook, one paragraph aligning the candidate's real experience to the job's needs, one paragraph on a concrete relevant achievement, and a brief close. Mirror key terms from the job description naturally. Never invent employers, titles, metrics, or facts not supported by the candidate's resume/profile — if a specific would help and you don't have it, leave a short [bracketed] placeholder. Return ONLY the letter text — no preamble, no markdown fences, no "Dear Hiring Manager" placeholder header unless natural.`;

export const coverLetterWorkflow = defineWorkflow({
  id: "cover_letter",
  tier: "QUALITY",
  inputSchema: z.object({
    jobTitle: z.string(),
    company: z.string(),
    jobDescription: z.string(),
    resumeText: z.string(),
    baseline: z.string(),
  }),
  buildSystem: () => COVER_LETTER_SYSTEM,
  buildPrompt: ({ jobTitle, company, jobDescription, resumeText, baseline }) =>
    `JOB TITLE: ${jobTitle}
COMPANY: ${company}

JOB DESCRIPTION:
${jobDescription || "(not provided)"}

CANDIDATE RESUME:
${resumeText}

${baseline ? `CANDIDATE PROFILE:\n${baseline}\n` : ""}
Write the cover letter per the rules.`,
});
