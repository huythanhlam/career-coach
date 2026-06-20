import { describe, it, expect } from "vitest";
import { pickVoice, scoreVoice, type VoiceLike } from "./voicePick";

const v = (name: string, lang = "en-US", extra: Partial<VoiceLike> = {}): VoiceLike => ({
  name, lang, ...extra,
});

describe("pickVoice", () => {
  it("returns null when there are no voices", () => {
    expect(pickVoice([])).toBeNull();
  });

  it("prefers a neural/natural voice over a robotic one", () => {
    const picked = pickVoice([v("Albert"), v("Microsoft Aria Natural")]);
    expect(picked?.name).toBe("Microsoft Aria Natural");
  });

  it("prefers a known friendly voice over an unremarkable one", () => {
    const picked = pickVoice([v("Generic Voice"), v("Samantha")]);
    expect(picked?.name).toBe("Samantha");
  });

  it("prefers en-US over other languages", () => {
    const picked = pickVoice([v("Marie", "fr-FR"), v("Sam", "en-US")]);
    expect(picked?.name).toBe("Sam");
  });

  it("down-ranks novelty voices below plain ones", () => {
    expect(scoreVoice(v("Zarvox"))).toBeLessThan(scoreVoice(v("Plain")));
  });

  it("ranks a Google/en-US voice highly", () => {
    const picked = pickVoice([v("Fred"), v("Google US English"), v("Albert")]);
    expect(picked?.name).toBe("Google US English");
  });
});
