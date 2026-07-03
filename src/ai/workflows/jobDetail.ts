import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";

/**
 * The two AI helpers on the Job Postings detail drawer: a quick 0-100 fit score
 * and a one-page cover-letter draft. Both are free-text (the score is returned
 * as an integer in text and parsed by the caller); the cover letter here is
 * deliberately placeholder-free (uses the provided name) — distinct from the
 * Application Autopilot `coverLetterWorkflow`.
 */

const jobDetailInput = z.object({
  jobTitle: z.string(),
  company: z.string(),
  jobDescription: z.string(),
  targetRole: z.string(),
  skills: z.string(),
  resumeText: z.string(),
});

export const jobFitScoreWorkflow = defineWorkflow({
  id: "job_fit_score",
  tier: "FAST",
  inputSchema: jobDetailInput,
  buildSystem: () =>
    "You are an expert recruiter. Score how well a candidate fits a job from 0-100 based only on the evidence. Reply with ONLY the integer.",
  buildPrompt: ({ jobTitle, company, jobDescription, targetRole, skills, resumeText }) =>
    `JOB:\n${jobTitle} at ${company}\n${jobDescription}\n\nCANDIDATE:\nTarget role: ${targetRole}\nSkills: ${skills}\nResume/summary:\n${resumeText.slice(0, 4000)}\n\nReturn ONLY an integer 0-100.`,
});

export const quickCoverLetterWorkflow = defineWorkflow({
  id: "job_quick_cover_letter",
  tier: "QUALITY",
  inputSchema: jobDetailInput.extend({ name: z.string() }),
  buildSystem: () =>
    "You are an expert career writer. Write a concise, specific, one-page cover letter tailored to the job using only the candidate's real background. No placeholders like [Your Name]; use the provided name. Output plain text only.",
  buildPrompt: ({ jobTitle, company, jobDescription, name, targetRole, skills, resumeText }) =>
    `Write a cover letter for this job.\n\nJOB:\n${jobTitle} at ${company}\n${jobDescription}\n\nCANDIDATE:\nName: ${name}\nTarget role: ${targetRole}\nSkills: ${skills}\nBackground:\n${resumeText.slice(0, 4000)}`,
});
