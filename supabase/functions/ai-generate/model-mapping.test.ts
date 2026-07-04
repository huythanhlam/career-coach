import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MODELS } from "../../../src/config/models";

// Guards the shared MODELS config against pointing at a model the Gemini key
// can't reach (which surfaces as a gateway 500 from a 429 "quota exceeded").
// The quota picture flipped: gemini-2.5-flash began 429ing on the project's
// plan, so the tiers were moved to gemini-3.1-flash-lite, which has quota. This
// test pins MODELS to that intended id so an accidental edit is caught.
//
// The retired `ai-generate` function's own Claude→Gemini remap is unrelated and
// still targets gemini-2.5-flash; the first test only documents that legacy path.

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

  it("pins every shared MODELS tier to the quota-having gemini-3.1-flash-lite", () => {
    // gemini-2.5-flash started 429ing on the project's plan; the tiers moved to
    // gemini-3.1-flash-lite, which has quota. Pin it so a stray edit is caught.
    for (const [tier, id] of Object.entries(MODELS)) {
      expect(id, `${tier} is ${id}`).toBe("gemini-3.1-flash-lite");
    }
  });
});
