import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";

/**
 * Extract concrete, checkable milestones from a career-plan markdown document.
 * Non-grounded; native `responseSchema` (array) replaces `parseJsonArray`.
 */

export const extractedMilestoneSchema = z.object({
  title: z.string(),
  timeframe: z.string().optional(),
});

export const milestoneExtractionSchema = z.object({
  milestones: z.array(extractedMilestoneSchema),
});

export type ExtractedMilestoneOutput = z.infer<typeof extractedMilestoneSchema>;

const inputSchema = z.object({ planMarkdown: z.string() });

const SYSTEM = `You are a structured data extractor. Given a career development plan in Markdown, extract its concrete milestones/checkpoints.
Rules:
- Pull primarily from the Milestones section; include Quick Wins only if there is no Milestones section.
- Each entry must be a single concrete checkpoint someone can mark done — split combined items, drop vague aspirations.
- title: short, actionable, max ~12 words. timeframe: the time-box as written, e.g. 'Month 3' or 'by mid-July' — omit if none.
- Preserve the plan's order. Maximum 12 entries.`;

export const milestoneExtractionWorkflow = defineWorkflow({
  id: "milestone_extraction",
  tier: "FAST",
  inputSchema,
  outputSchema: milestoneExtractionSchema,
  buildSystem: () => SYSTEM,
  buildPrompt: ({ planMarkdown }) =>
    `Extract the milestones from this plan:\n\n${planMarkdown.slice(0, 16000)}`,
});
