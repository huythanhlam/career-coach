import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { uc, injectionTrailer } from "@/ai/prompt";

/**
 * Extract a structured career profile from imported LinkedIn/resume text.
 * Non-grounded; native `responseSchema` replaces the hand-rolled brace-slicing
 * in the old `parseProfileFromImport`. All fields optional — the caller strips
 * blank strings so absent data never clobbers the existing profile.
 */

const workEntrySchema = z.object({
  id: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  responsibilities: z.string().optional(),
  current: z.boolean().optional(),
});

const educationEntrySchema = z.object({
  id: z.string().optional(),
  university: z.string().optional(),
  degree: z.string().optional(),
  graduationYear: z.string().optional(),
  major: z.string().optional(),
  minor: z.string().optional(),
});

export const profileExtractionSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  portfolio: z.string().optional(),
  targetRole: z.string().optional(),
  currentRole: z.string().optional(),
  yearsOfExperience: z.number().optional(),
  summary: z.string().optional(),
  workHistory: z.array(workEntrySchema).optional(),
  education: z.array(educationEntrySchema).optional(),
  skills: z.array(z.string()).optional(),
});

export type ProfileExtractionOutput = z.infer<typeof profileExtractionSchema>;

const inputSchema = z.object({
  kind: z.enum(["linkedin", "resume"]),
  text: z.string(),
  url: z.string().optional(),
});

const SYSTEM = `You are a structured data extractor. Given career content (LinkedIn profile text or resume text), extract a structured career profile.
CRITICAL ACCURACY RULES:
- Transcribe content exactly as written. Never invent, embellish, or infer responsibilities, metrics, titles, dates, or skills that are not in the source.
- Preserve every work-experience bullet verbatim in "responsibilities" (one per line, separated by \\n) — do not summarise, reword, merge, or drop any.
- Keep dates exactly as the source presents them.
- Leave a field blank if it is not present in the source material (do not guess).
- The source is machine-extracted text and may be messy (multi-column layouts, broken line wraps, stray characters). Reassemble it into the correct fields using your best reading, but if a field is garbled, truncated, or you cannot confidently determine it, leave it blank rather than guessing.
- Generate random 8-character alphanumeric IDs for id fields.
- targetRole: infer from the most recent role or stated goal. currentRole: the most recent job title. summary: 2-3 sentences.`;

export const profileExtractionWorkflow = defineWorkflow({
  id: "profile_extraction",
  tier: "FAST",
  inputSchema,
  outputSchema: profileExtractionSchema,
  buildSystem: () => SYSTEM,
  buildPrompt: ({ kind, text, url }) => {
    if (kind === "linkedin") {
      return `Extract structured career profile data from the following LinkedIn profile text.\n${
        url ? `LinkedIn URL: ${url}\n` : ""
      }\nLinkedIn Profile Text:\n${uc(text)}\n${injectionTrailer()}`;
    }
    return `Extract structured career profile data from the following resume:\n\n${uc(text)}\n${injectionTrailer()}`;
  },
});
