import { describe, it, expect } from "vitest";
import { deriveChatStatus } from "./chatStatus";

describe("deriveChatStatus", () => {
  it("defaults to the user's turn when nothing is happening", () => {
    expect(deriveChatStatus({})).toBe("Your turn");
  });

  it("prioritizes scoring above everything", () => {
    expect(
      deriveChatStatus({ isScoring: true, isGenerating: true, speaking: true, listening: true }),
    ).toBe("Scoring your interview…");
  });

  it("shows thinking while generating", () => {
    expect(deriveChatStatus({ isGenerating: true })).toBe("Interviewer is thinking…");
  });

  it("shows speaking when TTS is active and not generating", () => {
    expect(deriveChatStatus({ speaking: true })).toBe("Interviewer is speaking…");
  });

  it("shows listening when the mic is on", () => {
    expect(deriveChatStatus({ listening: true })).toBe("Listening — speak your answer");
  });

  it("ranks generating above speaking and listening", () => {
    expect(deriveChatStatus({ isGenerating: true, speaking: true, listening: true })).toBe(
      "Interviewer is thinking…",
    );
  });
});
