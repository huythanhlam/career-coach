/**
 * Curated Gemini TTS prebuilt voices for the interviewer persona, picked from
 * Google's official style-descriptor table
 * (ai.google.dev/gemini-api/docs/speech-generation) to span firm/informative
 * through upbeat/energetic. See
 * docs/superpowers/specs/2026-07-11-gemini-tts-design.md §6.
 */
export interface GeminiVoice {
  id: string;
  /** Google's official one-word style descriptor for this voice. */
  descriptor: string;
  /** Longer human-readable blurb for the voice picker UI. */
  feel: string;
}

export const GEMINI_VOICES: GeminiVoice[] = [
  { id: "Charon", descriptor: "Informative", feel: "Firm, informative" },
  { id: "Aoede", descriptor: "Breezy", feel: "Breezy, easygoing" },
  { id: "Achird", descriptor: "Friendly", feel: "Warm, friendly" },
  { id: "Puck", descriptor: "Upbeat", feel: "Upbeat, energetic" },
];

export const DEFAULT_GEMINI_VOICE = "Charon";

export const isGeminiVoice = (v: string | undefined): boolean =>
  !!v && GEMINI_VOICES.some((g) => g.id === v);
