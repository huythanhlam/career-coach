import { describe, it, expect } from "vitest";
import { splitForSpeech } from "./useSpeech";

describe("splitForSpeech", () => {
  it("keeps a short single sentence as one chunk", () => {
    expect(splitForSpeech("Tell me about yourself.")).toEqual(["Tell me about yourself."]);
  });

  it("splits multiple sentences by sentence", () => {
    const chunks = splitForSpeech("First question. Second question.");
    expect(chunks).toEqual(["First question.", "Second question."]);
  });

  it("shortens a long first sentence at its first clause boundary", () => {
    const text =
      "Thank you so much for taking the time to meet with me today, I really do appreciate this opportunity a lot.";
    const chunks = splitForSpeech(text);
    // First chunk is broken at the comma so time-to-first-audio is small…
    expect(chunks[0]).toBe(
      "Thank you so much for taking the time to meet with me today,",
    );
    // …and the remainder is preserved as the next chunk.
    expect(chunks[1]).toBe("I really do appreciate this opportunity a lot.");
    // No text is lost.
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " "));
  });

  it("leaves a long first sentence intact when it has no early clause boundary", () => {
    const text =
      "This is a fairly long opening sentence without any early clause punctuation whatsoever indeed.";
    expect(splitForSpeech(text)).toEqual([text]);
  });

  it("does not isolate a tiny opener before the minimum length", () => {
    // "Hi," is well under FIRST_CHUNK_SPLIT_MIN, so the split point is sought later.
    const text =
      "Hi, thanks a lot for joining this practice interview session with me today, let's begin now.";
    const chunks = splitForSpeech(text);
    expect(chunks[0].startsWith("Hi, thanks")).toBe(true);
    expect(chunks[0]).not.toBe("Hi,");
  });
});
