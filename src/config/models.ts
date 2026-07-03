/**
 * Single source of truth for AI model ids, keyed by capability tier so a model
 * upgrade is a one-line change instead of a hunt across call sites.
 *
 * These are REAL Gemini model ids passed through the `ai-gateway` edge function
 * unchanged — there is no name remapping (the old Claude-name → Gemini remap in
 * `supabase/functions/ai-generate` is retired with the AI Core v2 rebuild, see
 * `docs/rebuild/DEVELOPMENT_PLAN.md` §6 Phase 1). Dev and prod run the same ids.
 *
 * All three tiers currently point at `gemini-2.5-flash`: it is the model
 * verified reachable on the project's Gemini plan. The 3.x flash family
 * (`gemini-3.1-flash-lite`, `gemini-3.5-flash`) returns HTTP 429 "quota
 * exceeded" on this billing tier — that is exactly what surfaced as the
 * mock-interview "Gateway 500" (PR #76). The golden-set eval suite
 * (`scripts/evals/`, Phase 1) gates any per-tier bump back to a 3.x model once
 * that model is confirmed to have quota, so tier differentiation returns without
 * silently reintroducing the 429.
 */
export const MODELS = {
  /** Fast/cheap default for structured workflow generations and data extraction. */
  FAST: "gemini-2.5-flash",
  /** Higher-quality drafting (resumes, cover letters) and coaching chat. */
  QUALITY: "gemini-2.5-flash",
  /** Search-grounded company research. */
  RESEARCH: "gemini-2.5-flash",
} as const;

export type ModelTier = keyof typeof MODELS;

/** The concrete model id strings, for the gateway's tier→model resolution. */
export type ModelId = (typeof MODELS)[ModelTier];
