import { describe, it, expect } from "vitest";
import { stripMarkdown } from "./speechText";

describe("stripMarkdown", () => {
  it("returns empty string for empty input", () => {
    expect(stripMarkdown("")).toBe("");
  });

  it("removes bold and italic markers but keeps the words", () => {
    expect(stripMarkdown("This is **very** _important_ feedback")).toBe(
      "This is very important feedback",
    );
  });

  it("strips heading hashes", () => {
    expect(stripMarkdown("## Question 1\nTell me about a time…")).toBe(
      "Question 1\nTell me about a time…",
    );
  });

  it("removes list bullets and ordered markers", () => {
    const md = "- first point\n- second point\n1. step one\n2. step two";
    expect(stripMarkdown(md)).toBe("first point\nsecond point\nstep one\nstep two");
  });

  it("keeps link text and drops the URL", () => {
    expect(stripMarkdown("See [the docs](https://example.com) here")).toBe(
      "See the docs here",
    );
  });

  it("keeps inline code contents", () => {
    expect(stripMarkdown("Use the `useDictation` hook")).toBe("Use the useDictation hook");
  });

  it("unwraps fenced code blocks", () => {
    const md = "Here:\n```ts\nconst x = 1;\n```\ndone";
    expect(stripMarkdown(md)).toBe("Here:\nconst x = 1;\ndone");
  });

  it("collapses excessive blank lines", () => {
    expect(stripMarkdown("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("strips blockquotes and horizontal rules", () => {
    expect(stripMarkdown("> quoted\n\n---\n\ntext")).toBe("quoted\n\ntext");
  });
});
