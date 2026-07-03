import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { improvementSchema, prioritySchema } from "@/ai/workflows/shared";

/**
 * LinkedIn profile optimization. Non-grounded (analysis works from the pasted
 * PDF-export text), so it uses native `responseSchema` instead of the old
 * "return ONLY JSON" + `parseJsonObject` path.
 */

export const designRecommendationSchema = z.object({
  id: z.string(),
  priority: prioritySchema,
  category: z.enum([
    "banner",
    "photo",
    "url",
    "featured",
    "formatting",
    "completeness",
    "scannability",
  ]),
  title: z.string(),
  description: z.string(),
  region: z.enum([
    "banner",
    "photo",
    "headline",
    "about",
    "featured",
    "experience",
    "education",
    "skills",
    "none",
  ]),
});

export const linkedinAnalysisSchema = z.object({
  profileText: z.string().optional(),
  overallScore: z.number().nullable(),
  summary: z.string(),
  improvements: z.array(improvementSchema),
  designRecommendations: z.array(designRecommendationSchema),
});

export type LinkedInAnalysisOutput = z.infer<typeof linkedinAnalysisSchema>;

const inputSchema = z.object({
  profileText: z.string(),
  targetRole: z.string(),
});

const SYSTEM = `You are an expert LinkedIn profile strategist, recruiter, and personal-branding coach who has reviewed thousands of profiles across many industries. You give honest, specific, prioritized feedback that helps the profile win attention from both human recruiters and LinkedIn keyword search. You optimize for the candidate's target role when one is given.`;

export const linkedinAnalysisWorkflow = defineWorkflow({
  id: "linkedin_analysis",
  tier: "QUALITY",
  inputSchema,
  outputSchema: linkedinAnalysisSchema,
  buildSystem: () => SYSTEM,
  buildPrompt: ({ profileText, targetRole }) =>
    `
Analyze the LinkedIn profile below (extracted from the user's "Save to PDF" export) and produce a structured review.

Fields:
- overallScore: integer 0-100.
- summary: 2-3 sentence assessment of the profile's biggest strengths and gaps.
- improvements: CONTENT edits (Headline, About, Experience, Skills). Produce 5-8 of the highest-impact, prioritized — name the section in checklistLabel. originalText must be a SHORT exact substring copied character-for-character from the LinkedIn Profile text below so the app can locate it; never paraphrase or add line breaks that aren't in the source. Keep any Headline rewrite under 220 characters.
- designRecommendations: PRESENTATION/visual best practices that are NOT text edits — the profile PDF does not reveal these, so advise based on standard LinkedIn best practice. Produce 3-5, prioritized. Cover, where relevant: a custom background banner (banner), a professional headshot (photo), a custom profile URL (url), using the Featured section (featured), formatting/readability of the About and Experience (formatting), completeness of sections like Skills/Education/Recommendations (completeness), and scannability — short paragraphs, line breaks, bullet points (scannability). Set "region" to the profile area each tip points at so the app can highlight it on the screenshot; use "none" only if it maps to no single area.

Rules:
- overallScore guide: 85-100 = strong, recruiter-ready; 70-84 = solid with clear gaps; 50-69 = needs significant work; below 50 = major issues. Score against the target role if provided, otherwise against general best practice for the candidate's field.
- Use only the candidate's real experience — never invent roles, employers, metrics, or skills.
${targetRole ? `\nTarget role: ${targetRole}` : ""}

LinkedIn Profile:
${profileText}
`.trim(),
});
