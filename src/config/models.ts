/**
 * Single source of truth for AI model ids, keyed by capability tier so a model
 * upgrade is a one-line change instead of a hunt across call sites.
 *
 * These are REAL Gemini model ids passed through the `ai-gateway` edge function
 * unchanged — there is no name remapping (the old Claude-name → Gemini remap in
 * `supabase/functions/ai-generate` is retired with the AI Core v2 rebuild, see
 * `docs/rebuild/DEVELOPMENT_PLAN.md` §6 Phase 1). Dev and prod run the same ids.
 */
export const MODELS = {
  /** Fast/cheap default for structured workflow generations and data extraction. */
  FAST: "gemini-3.1-flash-lite",
  /** Higher-quality drafting (resumes, cover letters) and coaching chat. */
  QUALITY: "gemini-3.5-flash",
  /**
   * Search-grounded research. `gemini-2.5-flash` is verified working with
   * Google-Search grounding on the current key; the 3.x flash *preview* models
   * return HTTP 429 on grounding for this billing tier. The eval suite
   * (`scripts/evals/`) gates a bump to `gemini-3.5-flash` once grounding quota
   * is confirmed there.
   */
  RESEARCH: "gemini-2.5-flash",
} as const;

export type ModelTier = keyof typeof MODELS;

/** The concrete model id strings, for the gateway's tier→model resolution. */
export type ModelId = (typeof MODELS)[ModelTier];
