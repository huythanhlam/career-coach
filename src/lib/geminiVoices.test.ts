import { describe, expect, it } from "vitest";

import { DEFAULT_GEMINI_VOICE, GEMINI_VOICES, isGeminiVoice } from "./geminiVoices";

describe("GEMINI_VOICES", () => {
  it("offers exactly the 4 curated interviewer voices", () => {
    expect(GEMINI_VOICES.map((v) => v.id)).toEqual(["Charon", "Aoede", "Achird", "Puck"]);
  });

  it("spans firm/informative to upbeat/energetic via each voice's descriptor", () => {
    expect(GEMINI_VOICES.map((v) => v.descriptor)).toEqual([
      "Informative",
      "Breezy",
      "Friendly",
      "Upbeat",
    ]);
  });
});

describe("DEFAULT_GEMINI_VOICE", () => {
  it("defaults to Charon, the firm/informative voice", () => {
    expect(DEFAULT_GEMINI_VOICE).toBe("Charon");
  });

  it("is itself a valid voice id", () => {
    expect(isGeminiVoice(DEFAULT_GEMINI_VOICE)).toBe(true);
  });
});

describe("isGeminiVoice", () => {
  it("accepts every curated voice id", () => {
    for (const v of GEMINI_VOICES) expect(isGeminiVoice(v.id)).toBe(true);
  });

  it("rejects a stale Kokoro voice id", () => {
    expect(isGeminiVoice("af_heart")).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isGeminiVoice(undefined)).toBe(false);
  });

  it("rejects a Gemini voice that exists but isn't in the curated shortlist", () => {
    expect(isGeminiVoice("Zephyr")).toBe(false);
  });
});
