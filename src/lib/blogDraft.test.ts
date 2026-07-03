import { describe, it, expect } from "vitest";
import {
  slugify,
  readingMinutes,
  parseJsonResponse,
  briefFromTopic,
  buildWriterPrompt,
  parseWriterDraft,
  buildEditorPrompt,
  parseEditorVerdict,
} from "./blogDraft";
import type { PostDraft, TopicBrief } from "@/types/blogPost";

describe("slugify", () => {
  it("lowercases, strips punctuation, and collapses dashes", () => {
    expect(slugify("How to Pivot Careers!")).toBe("how-to-pivot-careers");
    expect(slugify("Resume & Cover Letter")).toBe("resume-and-cover-letter");
    expect(slugify("  Spaced   Out  ")).toBe("spaced-out");
  });
});

describe("readingMinutes", () => {
  it("is at least 1 and scales with word count", () => {
    expect(readingMinutes("one two three")).toBe(1);
    expect(readingMinutes(Array(450).fill("word").join(" "))).toBe(2);
  });
});

describe("parseJsonResponse", () => {
  it("parses raw JSON", () => {
    expect(parseJsonResponse<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });
  it("parses fenced JSON with surrounding prose", () => {
    expect(parseJsonResponse('Here you go:\n```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it("recovers an object embedded in prose", () => {
    expect(parseJsonResponse('blah {"a":3} trailing')).toEqual({ a: 3 });
  });
  it("returns null for non-JSON (e.g. a gateway error message)", () => {
    expect(parseJsonResponse("The AI request timed out. Please try again.")).toBeNull();
    expect(parseJsonResponse("")).toBeNull();
  });
});

describe("briefFromTopic", () => {
  it("synthesizes a usable brief from title + category", () => {
    const b = briefFromTopic("How to Negotiate a Job Offer", "Salary");
    expect(b.slug).toBe("how-to-negotiate-a-job-offer");
    expect(b.title).toBe("How to Negotiate a Job Offer");
    expect(b.category).toBe("salary");
    expect(b.origin).toBe("seed");
  });
});

const brief: TopicBrief = briefFromTopic("How to Pivot Careers", "career-growth");

describe("buildWriterPrompt", () => {
  it("includes the title and asks for the JSON contract", () => {
    const p = buildWriterPrompt(brief);
    expect(p).toContain("How to Pivot Careers");
    expect(p).toContain('"content"');
    expect(p).not.toContain("The editor reviewed");
  });
  it("appends editor feedback when revising", () => {
    const p = buildWriterPrompt(brief, "Sharpen the opening.");
    expect(p).toContain("Sharpen the opening.");
    expect(p).toContain("The editor reviewed");
  });
});

describe("parseWriterDraft", () => {
  const sources = [
    { label: "A", url: "https://a.com" },
    { label: "A dup", url: "https://a.com" },
    { label: "B", url: "https://b.com" },
  ];

  it("builds a draft, derives the slug from the title, and dedupes sources", () => {
    const text = JSON.stringify({
      title: "A Sharper Pivot Guide",
      excerpt: "Do it well.",
      category: "Career-Growth",
      tags: ["pivot", "skills"],
      heroEmoji: "🔁",
      content: "## Intro\n\nBody.",
    });
    const draft = parseWriterDraft(text, brief, sources)!;
    expect(draft.slug).toBe("a-sharper-pivot-guide");
    expect(draft.category).toBe("career-growth");
    expect(draft.sources).toHaveLength(2);
    expect(draft.readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it("returns null when the body is missing", () => {
    expect(parseWriterDraft(JSON.stringify({ title: "x" }), brief, [])).toBeNull();
    expect(parseWriterDraft("not json", brief, [])).toBeNull();
  });

  it("falls back to the brief tags/title when omitted", () => {
    const draft = parseWriterDraft(JSON.stringify({ content: "## H\n\nx" }), brief, [])!;
    expect(draft.title).toBe(brief.title);
    expect(draft.tags).toEqual(brief.tags);
  });
});

describe("buildEditorPrompt", () => {
  it("includes the draft body and lists sources", () => {
    const draft: PostDraft = {
      slug: "s",
      title: "T",
      excerpt: "E",
      category: "resume",
      tags: [],
      content: "## Body",
      sources: [{ label: "Src", url: "https://x.com" }],
    };
    const p = buildEditorPrompt(draft);
    expect(p).toContain("## Body");
    expect(p).toContain("Src: https://x.com");
    expect(p).toContain('"decision"');
  });
});

describe("parseEditorVerdict", () => {
  it("parses an approval and applies a polished copy-edit", () => {
    const v = parseEditorVerdict(
      JSON.stringify({ decision: "approve", score: 92, issues: [], polishedContent: "## Tighter" }),
    );
    expect(v.decision).toBe("approve");
    expect(v.score).toBe(92);
    expect(v.polishedContent).toBe("## Tighter");
  });
  it("ignores polishedContent unless approving", () => {
    const v = parseEditorVerdict(
      JSON.stringify({ decision: "revise", score: 50, polishedContent: "x" }),
    );
    expect(v.polishedContent).toBeUndefined();
  });
  it("clamps the score to 0–100", () => {
    expect(parseEditorVerdict(JSON.stringify({ decision: "approve", score: 250 })).score).toBe(100);
  });
  it("falls back to a conservative revise on parse failure", () => {
    const v = parseEditorVerdict("the gateway is down");
    expect(v.decision).toBe("revise");
    expect(v.score).toBe(0);
  });
});
