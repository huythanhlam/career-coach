import { z } from "zod";

/**
 * Schemas shared across workflow modules. Keeping them here avoids cross-imports
 * between sibling workflows (e.g. LinkedIn analysis reusing the resume
 * `Improvement` shape).
 */

export const prioritySchema = z.enum(["high", "medium", "low"]);

/** An inline resume/profile edit suggestion (resume analysis + LinkedIn share it). */
export const improvementSchema = z.object({
  id: z.string(),
  priority: prioritySchema,
  category: z.enum(["impact", "clarity", "grammar", "keywords", "formatting"]),
  checklistLabel: z.string(),
  description: z.string(),
  originalText: z.string(),
  suggestedText: z.string(),
});

export type ImprovementOutput = z.infer<typeof improvementSchema>;
