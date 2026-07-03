import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import type { CompanyCopyField } from "@/types/employerProfile";

/**
 * Employer Studio authoring workflows. Structured ones (job description, promo
 * assets, promo pack) use Gemini's native `responseSchema`; free-text ones
 * (company copy, inline field rewrite) return text verbatim. The prompt builders
 * and system strings are exported so `employerService` can re-export them for
 * its existing unit tests.
 */

const NO_INVENT = `Write only what the brief supports — never invent specific metrics, customer names, funding figures, or facts. Where a concrete detail would strengthen the copy but isn't provided, insert a short bracketed placeholder like "[add headcount]" for the employer to fill in.`;

/* ─── Job description from a brief ──────────────────────────────────────────── */

export interface JobBrief {
  title: string;
  companyName?: string;
  seniority?: string;
  location?: string;
  employmentType?: string;
  /** Free-text key points: responsibilities, must-have skills, perks, etc. */
  keyPoints?: string;
}

export const jobDescriptionSchema = z.object({
  description: z.string(),
  requirements: z.string(),
  responsibilities: z.string(),
});

export type JobDescriptionOutput = z.infer<typeof jobDescriptionSchema>;

export const JOB_DESCRIPTION_SYSTEM = `You are an expert technical recruiter and employer-branding copywriter. Expand a short hiring brief into a compelling, inclusive job posting that attracts strong, diverse candidates. Use clear, bias-free language (avoid "rockstar", "ninja", "aggressive", gendered terms, and unnecessary degree gatekeeping). ${NO_INVENT}
Produce three Markdown fields: a "description" (2-4 short paragraphs introducing the role, the team, and the impact), "requirements" (a bullet list of must-have and nice-to-have qualifications), and "responsibilities" (a bullet list of what the person will own day to day).`;

export function buildJobDescriptionPrompt(brief: JobBrief): string {
  const lines = [`Role: ${brief.title}`];
  if (brief.companyName) lines.push(`Company: ${brief.companyName}`);
  if (brief.seniority) lines.push(`Seniority: ${brief.seniority}`);
  if (brief.location) lines.push(`Location: ${brief.location}`);
  if (brief.employmentType) lines.push(`Employment type: ${brief.employmentType}`);
  if (brief.keyPoints?.trim())
    lines.push(`\nKey points from the hiring manager:\n${brief.keyPoints.trim()}`);
  return `Write a job posting from this brief.\n\n${lines.join("\n")}`;
}

export const jobDescriptionWorkflow = defineWorkflow({
  id: "job_description",
  tier: "QUALITY",
  inputSchema: z.object({
    title: z.string(),
    companyName: z.string().optional(),
    seniority: z.string().optional(),
    location: z.string().optional(),
    employmentType: z.string().optional(),
    keyPoints: z.string().optional(),
  }),
  outputSchema: jobDescriptionSchema,
  buildSystem: () => JOB_DESCRIPTION_SYSTEM,
  buildPrompt: (brief) => buildJobDescriptionPrompt(brief),
});

/* ─── Company profile copy (free-text) ──────────────────────────────────────── */

const COPY_FIELD_GUIDANCE: Record<CompanyCopyField, string> = {
  about:
    "a concise 'About the company' section (2-3 short paragraphs) covering what the company does and why it matters",
  mission: "a single, memorable mission statement (1-2 sentences)",
  culture:
    "a 'Life & culture' section (1 short paragraph + 3-5 bullet values) describing how the team works",
  benefits:
    "a 'Benefits & perks' section as a tight bullet list grouped sensibly (comp, health, time off, growth, flexibility)",
};

export interface CompanyCopyInput {
  name: string;
  industry?: string;
  /** Existing draft, if the employer wants it improved rather than written fresh. */
  existing?: string;
}

export const COMPANY_COPY_SYSTEM = `You are an employer-branding writer. Write authentic, concrete, non-generic company copy that a real candidate would find informative. Avoid clichés and corporate filler ("synergy", "world-class", "passionate team"). ${NO_INVENT}

Return ONLY the copy as Markdown text — no preamble, no quotes, no JSON.`;

export function buildCompanyCopyPrompt(field: CompanyCopyField, company: CompanyCopyInput): string {
  const lines = [`Company: ${company.name}`];
  if (company.industry) lines.push(`Industry: ${company.industry}`);
  const verb = company.existing?.trim() ? "Improve and tighten" : "Write";
  let prompt = `${verb} ${COPY_FIELD_GUIDANCE[field]} for the company below.\n\n${lines.join("\n")}`;
  if (company.existing?.trim())
    prompt += `\n\nExisting draft to build on:\n${company.existing.trim()}`;
  prompt += `\n\nReturn only the copy.`;
  return prompt;
}

const companyCopyFieldSchema = z.enum(["about", "mission", "culture", "benefits"]);

export const companyCopyWorkflow = defineWorkflow({
  id: "company_copy",
  tier: "FAST",
  inputSchema: z.object({
    field: companyCopyFieldSchema,
    name: z.string(),
    industry: z.string().optional(),
    existing: z.string().optional(),
  }),
  buildSystem: () => COMPANY_COPY_SYSTEM,
  buildPrompt: ({ field, name, industry, existing }) =>
    buildCompanyCopyPrompt(field, { name, industry, existing }),
});

/* ─── Inline field rewrite (free-text) ──────────────────────────────────────── */

export const REWRITE_FIELD_SYSTEM = `You are an expert employer-branding editor. The user selected a passage from a company profile or job listing and wants it improved per their instruction. Return ONLY the rewritten text — no preamble, no quotes, no explanation. Preserve the original's Markdown structure (bullets, headings, bold) so it drops in cleanly, and keep it close to the original length (within ~±15%). Improve wording, clarity, and impact, but never invent metrics, customers, or facts not present in the context — use a bracketed placeholder if a specific detail would help.`;

export function buildRewriteFieldPrompt(
  selectedText: string,
  instruction: string,
  context: string,
): string {
  return `Context (the full field/document):\n${context}\n\n---\nSelected text to rewrite:\n${selectedText}\n\nInstruction: ${instruction}`;
}

export const fieldRewriteWorkflow = defineWorkflow({
  id: "employer_field_rewrite",
  tier: "FAST",
  inputSchema: z.object({
    selectedText: z.string(),
    instruction: z.string(),
    context: z.string(),
  }),
  buildSystem: () => REWRITE_FIELD_SYSTEM,
  buildPrompt: ({ selectedText, instruction, context }) =>
    buildRewriteFieldPrompt(selectedText, instruction, context),
});

/* ─── Promo content ─────────────────────────────────────────────────────────── */

export interface PromoListingInput {
  title: string;
  companyName?: string;
  location?: string;
  description?: string;
}

function listingLines(listing: PromoListingInput): string {
  const lines = [`Role: ${listing.title}`];
  if (listing.companyName) lines.push(`Company: ${listing.companyName}`);
  if (listing.location) lines.push(`Location: ${listing.location}`);
  if (listing.description?.trim())
    lines.push(`\nRole summary:\n${listing.description.trim().slice(0, 1200)}`);
  return lines.join("\n");
}

export const promoAssetsSchema = z.object({
  socialPost: z.string(),
  outreachEmail: z.string(),
  blurb: z.string(),
});

export type PromoAssetsOutput = z.infer<typeof promoAssetsSchema>;

export const PROMO_ASSETS_SYSTEM = `You are a recruiting-marketing copywriter. Produce shareable promotional copy for a job opening. Keep it energetic but honest — no hype, no invented facts. ${NO_INVENT}
Produce: a "socialPost" (a LinkedIn/social post, ≤ 80 words, with 2-3 relevant hashtags), an "outreachEmail" (a short, warm candidate-sourcing email — subject line on the first line, then the body), and a "blurb" (a one-line teaser, ≤ 20 words).`;

export function buildPromoPrompt(listing: PromoListingInput): string {
  return `Write promotional copy for this opening.\n\n${listingLines(listing)}`;
}

const promoListingSchema = z.object({
  title: z.string(),
  companyName: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

export const promoAssetsWorkflow = defineWorkflow({
  id: "promo_assets",
  tier: "FAST",
  inputSchema: promoListingSchema,
  outputSchema: promoAssetsSchema,
  buildSystem: () => PROMO_ASSETS_SYSTEM,
  buildPrompt: (listing) => buildPromoPrompt(listing),
});

export const promoPackSchema = z.object({
  linkedinPost: z.string(),
  twitterPost: z.string(),
  headlineVariants: z.array(z.string()),
  targetingBlurbs: z.array(z.string()),
});

export type PromoPackOutput = z.infer<typeof promoPackSchema>;

export const PROMO_PACK_SYSTEM = `You are a recruiting-marketing lead building a premium, multi-channel promotion bundle for a BOOSTED job opening. Tailor the voice to each channel. Be specific and honest. ${NO_INVENT}
Produce: a "linkedinPost" (a polished LinkedIn post, ≤ 120 words, with hashtags), a "twitterPost" (a punchy post for X/Twitter, ≤ 280 characters), "headlineVariants" (two short A/B headline blurbs, ≤ 15 words each), and "targetingBlurbs" (3 one-liners each aimed at a specific candidate segment — e.g. career switchers, senior ICs, recent grads — prefixed with the segment in brackets).`;

export function buildPromoPackPrompt(listing: PromoListingInput): string {
  return `Build a multi-channel promo pack for this BOOSTED opening.\n\n${listingLines(listing)}`;
}

export const promoPackWorkflow = defineWorkflow({
  id: "promo_pack",
  tier: "QUALITY",
  inputSchema: promoListingSchema,
  outputSchema: promoPackSchema,
  buildSystem: () => PROMO_PACK_SYSTEM,
  buildPrompt: (listing) => buildPromoPackPrompt(listing),
});
