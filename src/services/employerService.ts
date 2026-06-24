import { generateWorkflowData } from "@/services/geminiService";
import { parseLooseJsonObject } from "@/lib/looseJson";
import { MODELS } from "@/config/models";
import type { CompanyCopyField } from "@/types/employerProfile";
import type { PromoAssets, PromoPack } from "@/types/employerListing";

/**
 * AI authoring helpers for the Employer Studio. All calls go through the shared
 * gateway (`generateWorkflowData`); the prompt builders are exported separately
 * so they can be unit-tested without touching the network.
 */

/** Strip ```json fences and surrounding quotes from a single-value response. */
export function cleanText(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

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

export interface GeneratedJobDescription {
  description: string;
  requirements: string;
  responsibilities: string;
}

export const JOB_DESCRIPTION_SYSTEM = `You are an expert technical recruiter and employer-branding copywriter. Expand a short hiring brief into a compelling, inclusive job posting that attracts strong, diverse candidates. Use clear, bias-free language (avoid "rockstar", "ninja", "aggressive", gendered terms, and unnecessary degree gatekeeping). ${NO_INVENT}

Return ONLY a JSON object — no markdown fences, no commentary — matching exactly:
{
  "description": "2-4 short paragraphs (Markdown) introducing the role, the team, and the impact",
  "requirements": "a Markdown bullet list of must-have and nice-to-have qualifications",
  "responsibilities": "a Markdown bullet list of what the person will own day to day"
}
Begin with "{" and end with "}".`;

export function buildJobDescriptionPrompt(brief: JobBrief): string {
  const lines = [`Role: ${brief.title}`];
  if (brief.companyName) lines.push(`Company: ${brief.companyName}`);
  if (brief.seniority) lines.push(`Seniority: ${brief.seniority}`);
  if (brief.location) lines.push(`Location: ${brief.location}`);
  if (brief.employmentType) lines.push(`Employment type: ${brief.employmentType}`);
  if (brief.keyPoints?.trim()) lines.push(`\nKey points from the hiring manager:\n${brief.keyPoints.trim()}`);
  return `Write a job posting from this brief.\n\n${lines.join("\n")}\n\nReturn ONLY the JSON object.`;
}

export async function generateJobDescription(brief: JobBrief): Promise<GeneratedJobDescription> {
  const raw = await generateWorkflowData(JOB_DESCRIPTION_SYSTEM, buildJobDescriptionPrompt(brief), MODELS.QUALITY);
  try {
    const parsed = parseLooseJsonObject(raw);
    return {
      description: typeof parsed.description === "string" ? parsed.description : "",
      requirements: typeof parsed.requirements === "string" ? parsed.requirements : "",
      responsibilities: typeof parsed.responsibilities === "string" ? parsed.responsibilities : "",
    };
  } catch {
    console.error("generateJobDescription: failed to parse JSON. Preview:", raw.slice(0, 300));
    // A non-JSON response is usually a classified gateway error — surface it.
    return { description: cleanText(raw), requirements: "", responsibilities: "" };
  }
}

/* ─── Company profile copy ──────────────────────────────────────────────────── */

const COPY_FIELD_GUIDANCE: Record<CompanyCopyField, string> = {
  about: "a concise 'About the company' section (2-3 short paragraphs) covering what the company does and why it matters",
  mission: "a single, memorable mission statement (1-2 sentences)",
  culture: "a 'Life & culture' section (1 short paragraph + 3-5 bullet values) describing how the team works",
  benefits: "a 'Benefits & perks' section as a tight bullet list grouped sensibly (comp, health, time off, growth, flexibility)",
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
  if (company.existing?.trim()) prompt += `\n\nExisting draft to build on:\n${company.existing.trim()}`;
  prompt += `\n\nReturn only the copy.`;
  return prompt;
}

export async function generateCompanyCopy(field: CompanyCopyField, company: CompanyCopyInput): Promise<string> {
  const raw = await generateWorkflowData(COMPANY_COPY_SYSTEM, buildCompanyCopyPrompt(field, company), MODELS.FAST);
  return cleanText(raw);
}

/* ─── Inline field rewrite ──────────────────────────────────────────────────── */

export const REWRITE_FIELD_SYSTEM = `You are an expert employer-branding editor. The user selected a passage from a company profile or job listing and wants it improved per their instruction. Return ONLY the rewritten text — no preamble, no quotes, no explanation. Preserve the original's Markdown structure (bullets, headings, bold) so it drops in cleanly, and keep it close to the original length (within ~±15%). Improve wording, clarity, and impact, but never invent metrics, customers, or facts not present in the context — use a bracketed placeholder if a specific detail would help.`;

export function buildRewriteFieldPrompt(selectedText: string, instruction: string, context: string): string {
  return `Context (the full field/document):\n${context}\n\n---\nSelected text to rewrite:\n${selectedText}\n\nInstruction: ${instruction}`;
}

export async function rewriteEmployerField(
  selectedText: string,
  instruction: string,
  context: string,
): Promise<string> {
  const raw = await generateWorkflowData(
    REWRITE_FIELD_SYSTEM,
    buildRewriteFieldPrompt(selectedText, instruction, context),
    MODELS.FAST,
  );
  return cleanText(raw);
}

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
  if (listing.description?.trim()) lines.push(`\nRole summary:\n${listing.description.trim().slice(0, 1200)}`);
  return lines.join("\n");
}

export const PROMO_ASSETS_SYSTEM = `You are a recruiting-marketing copywriter. Produce shareable promotional copy for a job opening. Keep it energetic but honest — no hype, no invented facts. ${NO_INVENT}

Return ONLY a JSON object — no fences — matching exactly:
{
  "socialPost": "a LinkedIn/social post (≤ 80 words) with 2-3 relevant hashtags",
  "outreachEmail": "a short, warm candidate-sourcing email (subject line on the first line, then the body)",
  "blurb": "a one-line teaser (≤ 20 words)"
}
Begin with "{" and end with "}".`;

export function buildPromoPrompt(listing: PromoListingInput): string {
  return `Write promotional copy for this opening.\n\n${listingLines(listing)}\n\nReturn ONLY the JSON object.`;
}

export async function generatePromoAssets(listing: PromoListingInput): Promise<PromoAssets> {
  const raw = await generateWorkflowData(PROMO_ASSETS_SYSTEM, buildPromoPrompt(listing), MODELS.FAST);
  try {
    const parsed = parseLooseJsonObject(raw);
    return {
      socialPost: typeof parsed.socialPost === "string" ? parsed.socialPost : "",
      outreachEmail: typeof parsed.outreachEmail === "string" ? parsed.outreachEmail : "",
      blurb: typeof parsed.blurb === "string" ? parsed.blurb : "",
    };
  } catch {
    console.error("generatePromoAssets: failed to parse JSON. Preview:", raw.slice(0, 300));
    return { socialPost: cleanText(raw) };
  }
}

export const PROMO_PACK_SYSTEM = `You are a recruiting-marketing lead building a premium, multi-channel promotion bundle for a BOOSTED job opening. Tailor the voice to each channel. Be specific and honest. ${NO_INVENT}

Return ONLY a JSON object — no fences — matching exactly:
{
  "linkedinPost": "a polished LinkedIn post (≤ 120 words) with hashtags",
  "twitterPost": "a punchy post for X/Twitter (≤ 280 characters)",
  "headlineVariants": ["two short A/B headline blurbs, ≤ 15 words each"],
  "targetingBlurbs": ["3 one-liners each aimed at a specific candidate segment (e.g. career switchers, senior ICs, recent grads) — prefix each with the segment in brackets"]
}
Begin with "{" and end with "}".`;

export function buildPromoPackPrompt(listing: PromoListingInput): string {
  return `Build a multi-channel promo pack for this BOOSTED opening.\n\n${listingLines(listing)}\n\nReturn ONLY the JSON object.`;
}

export async function generateBoostedPromoPack(listing: PromoListingInput): Promise<PromoPack> {
  const raw = await generateWorkflowData(PROMO_PACK_SYSTEM, buildPromoPackPrompt(listing), MODELS.QUALITY);
  const stringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0) : [];
  try {
    const parsed = parseLooseJsonObject(raw);
    return {
      linkedinPost: typeof parsed.linkedinPost === "string" ? parsed.linkedinPost : "",
      twitterPost: typeof parsed.twitterPost === "string" ? parsed.twitterPost : "",
      headlineVariants: stringArray(parsed.headlineVariants),
      targetingBlurbs: stringArray(parsed.targetingBlurbs),
    };
  } catch {
    console.error("generateBoostedPromoPack: failed to parse JSON. Preview:", raw.slice(0, 300));
    return { linkedinPost: cleanText(raw) };
  }
}
