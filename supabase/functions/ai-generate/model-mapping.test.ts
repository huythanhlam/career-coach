import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MODELS } from "../../../src/config/models";

// Regression guard for the mock-interview "Gateway 500: AI generation failed"
// bug. The edge function maps the Claude tiers to a Gemini model and passes
// gemini-* model ids straight through. The 3.x flash family (e.g.
// gemini-3.1-flash-lite) returns HTTP 429 "quota exceeded" on the project's
// Gemini plan, so any call routed to it threw and surfaced as a gateway 500.
// gemini-2.5-flash is verified working on the current key — keep everything
// pointed at a model the key can actually reach.

const here = dirname(fileURLToPath(import.meta.url));
const edgeSource = readFileSync(join(here, "index.ts"), "utf8");

// Pull the string literals `toGeminiModel` returns for the sonnet/haiku tiers.
function mappedTarget(tier: "sonnet" | "haiku"): string {
  const re = new RegExp(`includes\\("${tier}"\\)\\)\\s*return\\s*"([^"]+)"`);
  const m = edgeSource.match(re);
  if (!m) throw new Error(`toGeminiModel mapping for ${tier} not found`);
  return m[1];
}

describe("ai-generate model mapping", () => {
  it("routes the Claude tiers to a reachable, non-3.x Gemini model", () => {
    for (const tier of ["sonnet", "haiku"] as const) {
      const target = mappedTarget(tier);
      expect(target.startsWith("gemini-3")).toBe(false);
      expect(target).toBe("gemini-2.5-flash");
    }
  });

  it("never leaves a gemini-3.x model id in the shared MODELS config", () => {
    // These ids flow straight through toGeminiModel's pass-through branch, so a
    // 3.x id here reintroduces the same 429 → gateway 500 failure.
    for (const [tier, id] of Object.entries(MODELS)) {
      expect(id.startsWith("gemini-3"), `${tier} is ${id}`).toBe(false);
    }
  });
});
