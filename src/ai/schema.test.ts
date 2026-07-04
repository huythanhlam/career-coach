import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToResponseSchema } from "@/ai/schema";

/**
 * Gemini's structured-output parser (`responseJsonSchema`) is proto-backed and
 * rejects JSON Schema meta-keywords it doesn't model — most notably the `$schema`
 * dialect marker Zod 4 emits at the document root. Left in, it makes Gemini throw
 * `Invalid JSON payload received. Unknown name "$schema"`, which the gateway
 * surfaces as a 500 on every non-streaming (structured) workflow. Guard against a
 * regression here so we never ship a schema Gemini refuses.
 */
describe("zodToResponseSchema", () => {
  it("omits the $schema dialect marker Gemini rejects", () => {
    const schema = zodToResponseSchema(
      z.object({
        name: z.string().optional(),
        items: z.array(z.object({ id: z.string().optional() })).optional(),
      }),
    );
    expect(JSON.stringify(schema)).not.toContain('"$schema"');
  });

  it("still produces a usable object schema", () => {
    const schema = zodToResponseSchema(z.object({ verdict: z.string(), score: z.number() })) as {
      type: string;
      properties: Record<string, unknown>;
    };
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(["verdict", "score"]));
  });
});
