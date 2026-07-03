import { z } from "zod";

/**
 * Convert a Zod schema to the JSON Schema the gateway forwards to Gemini as
 * `responseJsonSchema`. Gemini's structured-output path accepts standard JSON
 * Schema, so this is a thin wrapper over Zod 4's `toJSONSchema` — the single
 * place any provider-specific massaging would live if it becomes necessary.
 *
 * `unrepresentable: "any"` keeps generation from throwing on constructs Gemini
 * doesn't model (e.g. `z.date()`); such fields fall through as unconstrained.
 */
export function zodToResponseSchema(schema: z.ZodType): unknown {
  return z.toJSONSchema(schema, { unrepresentable: "any", io: "output" });
}
