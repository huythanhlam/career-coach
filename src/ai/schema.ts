import { z } from "zod";

/**
 * Convert a Zod schema to the JSON Schema the gateway forwards to Gemini as
 * `responseJsonSchema`. Gemini's structured-output path accepts standard JSON
 * Schema, so this is a thin wrapper over Zod 4's `toJSONSchema` — the single
 * place any provider-specific massaging would live if it becomes necessary.
 *
 * `unrepresentable: "any"` keeps generation from throwing on constructs Gemini
 * doesn't model (e.g. `z.date()`); such fields fall through as unconstrained.
 *
 * Zod 4 stamps a `$schema` dialect marker on the document. Gemini's proto-backed
 * `responseJsonSchema` parser rejects meta-keywords it doesn't model and throws
 * `Invalid JSON payload received. Unknown name "$schema"` — which the gateway
 * turns into a 500 on every structured workflow. Strip it (recursively, in case a
 * future schema nests one) so the payload only carries keywords Gemini accepts.
 */
export function zodToResponseSchema(schema: z.ZodType): unknown {
  return stripSchemaKeyword(z.toJSONSchema(schema, { unrepresentable: "any", io: "output" }));
}

/** Recursively drop the JSON Schema `$schema` dialect marker Gemini rejects. */
function stripSchemaKeyword(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripSchemaKeyword);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "$schema") continue;
      out[k] = stripSchemaKeyword(v);
    }
    return out;
  }
  return node;
}
