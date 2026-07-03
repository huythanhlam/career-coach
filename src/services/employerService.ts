import { runWorkflow } from "@/ai/client";
import {
  jobDescriptionWorkflow,
  companyCopyWorkflow,
  fieldRewriteWorkflow,
  promoAssetsWorkflow,
  promoPackWorkflow,
} from "@/ai/workflows/employer";
import type { CompanyCopyField } from "@/types/employerProfile";
import type { PromoAssets, PromoPack } from "@/types/employerListing";

/**
 * AI authoring helpers for the Employer Studio. Prompt-building lives in the
 * typed registry (`src/ai/workflows/employer.ts`); these are thin adapters over
 * `runWorkflow`. The prompt builders + system strings are re-exported below so
 * `employerService.test.ts` can unit-test them without touching the network.
 */

export {
  buildJobDescriptionPrompt,
  buildCompanyCopyPrompt,
  buildRewriteFieldPrompt,
  buildPromoPrompt,
  buildPromoPackPrompt,
  JOB_DESCRIPTION_SYSTEM,
  COMPANY_COPY_SYSTEM,
  REWRITE_FIELD_SYSTEM,
  PROMO_ASSETS_SYSTEM,
  PROMO_PACK_SYSTEM,
} from "@/ai/workflows/employer";
export type { JobBrief, CompanyCopyInput, PromoListingInput } from "@/ai/workflows/employer";

import type { JobBrief, CompanyCopyInput, PromoListingInput } from "@/ai/workflows/employer";

/** Strip ```json fences and surrounding quotes from a single-value response. */
export function cleanText(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

export interface GeneratedJobDescription {
  description: string;
  requirements: string;
  responsibilities: string;
}

export async function generateJobDescription(brief: JobBrief): Promise<GeneratedJobDescription> {
  const result = await runWorkflow(jobDescriptionWorkflow, brief);
  if (result.status !== "ok") {
    // A gateway error surfaces as a classified message — show it in the body.
    return { description: cleanText(result.error), requirements: "", responsibilities: "" };
  }
  return {
    description: result.data.description ?? "",
    requirements: result.data.requirements ?? "",
    responsibilities: result.data.responsibilities ?? "",
  };
}

export async function generateCompanyCopy(
  field: CompanyCopyField,
  company: CompanyCopyInput,
): Promise<string> {
  const result = await runWorkflow(companyCopyWorkflow, { field, ...company });
  if (result.status !== "ok") return cleanText(result.error);
  return cleanText(result.data);
}

export async function rewriteEmployerField(
  selectedText: string,
  instruction: string,
  context: string,
): Promise<string> {
  const result = await runWorkflow(fieldRewriteWorkflow, { selectedText, instruction, context });
  if (result.status !== "ok") return cleanText(result.error);
  return cleanText(result.data);
}

export async function generatePromoAssets(listing: PromoListingInput): Promise<PromoAssets> {
  const result = await runWorkflow(promoAssetsWorkflow, listing);
  if (result.status !== "ok") return { socialPost: cleanText(result.error) };
  return {
    socialPost: result.data.socialPost ?? "",
    outreachEmail: result.data.outreachEmail ?? "",
    blurb: result.data.blurb ?? "",
  };
}

export async function generateBoostedPromoPack(listing: PromoListingInput): Promise<PromoPack> {
  const result = await runWorkflow(promoPackWorkflow, listing);
  if (result.status !== "ok") return { linkedinPost: cleanText(result.error) };
  return {
    linkedinPost: result.data.linkedinPost ?? "",
    twitterPost: result.data.twitterPost ?? "",
    headlineVariants: result.data.headlineVariants ?? [],
    targetingBlurbs: result.data.targetingBlurbs ?? [],
  };
}
