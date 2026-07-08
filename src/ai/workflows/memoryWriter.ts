import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { uc, injectionTrailer } from "@/ai/prompt";

/**
 * Coach OS memory-writer (Roadmap F1). After a meaningful event — a mock
 * interview, a generated application package, a saved/checked-in career plan —
 * this FAST-tier extraction pass distils a few durable, coach-useful notes from
 * a compact event summary. Those notes are persisted to `user_memories` and later
 * injected into coach turns (see `src/ai/coach/context.ts`) so the coach can say
 * "last week's behavioral interview scored low on Result" without the user
 * restating it.
 *
 * Structured output (native `responseSchema`). The event summary is
 * app-generated but may embed user text (a plan title, a company name), so it is
 * wrapped in `uc()` + the injection trailer like other data-extracting workflows.
 *
 * Kinds:
 * - `fact`       — a stable truth about the user's situation ("targeting Staff SRE roles").
 * - `preference` — how they like to work or be coached ("prefers concise, direct feedback").
 * - `episode`    — a time-anchored event summary ("2026-07-06 mock interview: 62/100, weak on Result").
 */

// NOTE: this schema is deliberately CONSTRAINT-FREE (no `.max()`/`.min()`/`.int()`).
// Gemini's `responseJsonSchema` parser 500s on the JSON-Schema keywords those emit
// (`maxLength`, `minimum`, `maximum`, `maxItems`) — the same class of unmodeled
// keyword as the `$schema` marker stripped in `src/ai/schema.ts`. The limits are
// requested in the prompt and enforced in `coachMemory.recordEvent` (salience
// clamped to 1–5, list sliced to 5) before the DB write.
export const memorySchema = z.object({
  kind: z.enum(["fact", "preference", "episode"]),
  /** One short sentence (length requested in the prompt, not schema-enforced). */
  content: z.string(),
  /** 1 (minor) … 5 (defining). Clamped to [1,5] in coachMemory. Drives top-k order. */
  salience: z.number(),
});

export const memoryWriterSchema = z.object({
  memories: z.array(memorySchema),
});

export type ExtractedMemory = z.infer<typeof memorySchema>;
export type MemoryWriterOutput = z.infer<typeof memoryWriterSchema>;

export const memorySourceFeatures = ["mock_interview", "autopilot", "goal_planner"] as const;
export type MemorySourceFeature = (typeof memorySourceFeatures)[number];

const inputSchema = z.object({
  sourceFeature: z.enum(memorySourceFeatures),
  /** Compact, app-built description of what just happened. */
  eventSummary: z.string(),
});

const SYSTEM = `You maintain the long-term memory of an AI career coach. Given a short summary of something that just happened for the user, extract only the notes worth remembering for future coaching conversations.

Rules:
- Extract at most 5 notes; extract FEWER (even zero) rather than padding with obvious or low-value items.
- Do NOT restate the user's static profile (name, current role, listed skills) — that is always available separately. Capture what is new, situational, or revealed by THIS event.
- kind: "episode" for a time-anchored event summary (interview result, package sent); "fact" for a durable situational truth; "preference" for how the user likes to work or be coached.
- content: one factual sentence, max ~30 words, written in the third person ("The user…"). No advice, no fluff.
- salience: 1 (minor) to 5 (defining). Reserve 4–5 for things that should shape most future conversations.`;

export const memoryWriterWorkflow = defineWorkflow({
  id: "memory_writer",
  tier: "FAST",
  inputSchema,
  outputSchema: memoryWriterSchema,
  buildSystem: () => SYSTEM,
  buildPrompt: ({ sourceFeature, eventSummary }) =>
    `Event source: ${sourceFeature}\n\nEvent summary:\n${uc(eventSummary)}${injectionTrailer()}`,
});
