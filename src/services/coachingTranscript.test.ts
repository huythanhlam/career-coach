import { describe, it, expect } from "vitest";
import { windowCoachingTranscript, COACHING_TRANSCRIPT_CHAR_BUDGET } from "./geminiService";

type Turn = { role: "user" | "model"; text: string };

describe("windowCoachingTranscript", () => {
  it("serializes all turns unchanged when under budget", () => {
    const turns: Turn[] = [
      { role: "user", text: "AAAA" },
      { role: "model", text: "BBBB" },
      { role: "user", text: "CCCC" },
    ];
    expect(windowCoachingTranscript(turns, 10_000)).toBe("User: AAAA\n\nCoach: BBBB\n\nUser: CCCC");
  });

  it("drops the oldest turns and keeps the most recent within budget", () => {
    const turns: Turn[] = [
      { role: "user", text: "OLDEST" },
      { role: "model", text: "MIDDLE" },
      { role: "user", text: "NEWEST" },
    ];
    // Budget fits only the last line ("User: NEWEST" = 12 chars); adding the
    // previous turn would exceed it.
    const out = windowCoachingTranscript(turns, 12);
    expect(out).toBe("User: NEWEST");
    expect(out).not.toContain("OLDEST");
  });

  it("always includes the single most-recent turn even if it alone exceeds budget", () => {
    const long = "X".repeat(500);
    const out = windowCoachingTranscript([{ role: "user", text: long }], 10);
    expect(out).toBe(`User: ${long}`);
  });

  it("returns an empty string for no turns", () => {
    expect(windowCoachingTranscript([], 10_000)).toBe("");
  });

  it("caps a long transcript at roughly the default budget", () => {
    const turns: Turn[] = Array.from({ length: 200 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "model") as Turn["role"],
      text: "z".repeat(500),
    }));
    const out = windowCoachingTranscript(turns);
    // Bounded near the budget (one boundary turn may push slightly over).
    expect(out.length).toBeLessThanOrEqual(COACHING_TRANSCRIPT_CHAR_BUDGET + 600);
    // And it retained the newest content, not the oldest.
    expect(out.endsWith("z".repeat(500))).toBe(true);
  });
});
