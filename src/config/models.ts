/**
 * Single source of truth for AI model ids. Pick by capability tier so a model
 * upgrade is a one-line change instead of a hunt across call sites.
 */
export const MODELS = {
  /** Fast/cheap default for structured workflow generations. */
  FAST: "claude-haiku-4-5-20251001",
  /** Higher-quality drafting (resumes, cover letters) and coaching chat. */
  QUALITY: "claude-sonnet-4-6",
  /** Lightweight profile/data extraction. */
  // gemini-2.5-flash is verified working on the project's Gemini plan; the 3.x
  // flash models 429 "quota exceeded" on this tier, which silently broke import.
  EXTRACTION: "gemini-2.5-flash",
  /** Search-grounded company research. */
  RESEARCH: "gemini-2.5-flash",
} as const;
