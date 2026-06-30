import { describe, expect, it } from "vitest";

import { DEFAULT_TTS_VOICE, TTS_VOICES, isTtsVoice } from "./ttsService";

// The interviewer/recruiter voices are served through the Vercel AI Gateway.
// The picker UI and the persisted `interviewVoice` preference both depend on
// these ids staying valid voice identifiers.
describe("TTS voice options", () => {
  it("exposes a non-empty curated voice list", () => {
    expect(TTS_VOICES.length).toBeGreaterThan(0);
    for (const v of TTS_VOICES) {
      expect(v.id).toBeTruthy();
      expect(v.label).toBeTruthy();
    }
  });

  it("uses a default voice that is part of the list", () => {
    expect(isTtsVoice(DEFAULT_TTS_VOICE)).toBe(true);
  });

  it("recognizes known voices and rejects unknown ones", () => {
    expect(isTtsVoice("nova")).toBe(true);
    expect(isTtsVoice("af_heart")).toBe(false); // old Kokoro id
    expect(isTtsVoice(undefined)).toBe(false);
    expect(isTtsVoice("")).toBe(false);
  });
});
