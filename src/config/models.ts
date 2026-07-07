/**
 * Single source of truth for AI model ids, keyed by capability tier so a model
 * upgrade is a one-line change instead of a hunt across call sites.
 *
 * These are REAL Gemini model ids passed through the `ai-gateway` edge function
 * unchanged — there is no name remapping (the old Claude-name → Gemini remap in
 * `supabase/functions/ai-generate` is retired with the AI Core v2 rebuild, see
 * `docs/rebuild/DEVELOPMENT_PLAN.md` §6 Phase 1). Dev and prod run the same ids.
 *
 * All three tiers currently point at `gemini-3.1-flash-lite`: `gemini-2.5-flash`
 * began returning HTTP 429 "quota exceeded" on the project's Gemini plan, so the
 * tiers were moved to `gemini-3.1-flash-lite`, which has quota on the current
 * plan. (This reverses the earlier PR #76 pin to 2.5-flash — the quota picture
 * flipped.) These are REAL Gemini ids forwarded unchanged; keep them mirrored
 * with `TIER_MODELS` in `supabase/functions/ai-gateway/index.ts`.
 */
export const MODELS = {
  /** Fast/cheap default for structured workflow generations and data extraction. */
  FAST: "gemini-3.1-flash-lite",
  /** Higher-quality drafting (resumes, cover letters) and coaching chat. */
  QUALITY: "gemini-3.1-flash-lite",
  /** Search-grounded company research. */
  RESEARCH: "gemini-3.1-flash-lite",
} as const;

export type ModelTier = keyof typeof MODELS;

/** The concrete model id strings, for the gateway's tier→model resolution. */
export type ModelId = (typeof MODELS)[ModelTier];
