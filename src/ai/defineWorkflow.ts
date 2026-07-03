import type { z } from "zod";
import type { ModelTier } from "@/config/models";
import type { GatewayPart } from "@/ai/types";

/**
 * A typed AI workflow: the unit the `ai-gateway` runs. Replaces the
 * `Record<string, any>` `WorkflowConfig.generatePrompt` contract with a
 * schema-checked input/output pair so `workflowId as any` casts become
 * impossible (see `docs/rebuild/DEVELOPMENT_PLAN.md` §6.5).
 *
 * @typeParam TInput  Validated input the caller passes to `runWorkflow`.
 * @typeParam TOutput Parsed result. Omit `outputSchema` for free-text workflows
 *                    (chat, rewrite) — then `TOutput` is `string`.
 */
export interface Workflow<TInput, TOutput> {
  /** Stable id used for metering (`ai_usage.workflow_id`) and eval fixtures. */
  id: string;
  tier: ModelTier;
  /** Attach Google-Search grounding. Grounded calls cannot use `responseSchema`. */
  enableSearch: boolean;
  inputSchema: z.ZodType<TInput>;
  /** When present, drives native `responseSchema` (non-grounded) and validation. */
  outputSchema?: z.ZodType<TOutput>;
  buildSystem: (input: TInput) => string;
  buildPrompt: (input: TInput) => string | GatewayPart[];
}

interface DefineWorkflowArgs<TInput, TOutput> {
  id: string;
  tier: ModelTier;
  enableSearch?: boolean;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  buildSystem: (input: TInput) => string;
  buildPrompt: (input: TInput) => string | GatewayPart[];
}

/** Declare a workflow. `enableSearch` defaults to `false`. */
export function defineWorkflow<TInput, TOutput = string>(
  args: DefineWorkflowArgs<TInput, TOutput>,
): Workflow<TInput, TOutput> {
  return { enableSearch: false, ...args };
}
