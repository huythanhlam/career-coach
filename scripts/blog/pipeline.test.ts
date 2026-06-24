import { describe, it, expect, vi } from "vitest";
import { runEditorialPipeline } from "./pipeline.ts";
import { sourceIdeas } from "./agents/ideator.ts";
import type { EditorVerdict, PostDraft, TopicBrief } from "../../src/types/blogPost.ts";

const brief: TopicBrief = {
  slug: "how-to-pivot-careers",
  title: "How to Pivot Careers",
  angle: "transferable skills",
  audience: "career changers",
  keyQuestions: ["where to start?"],
  whyNow: "layoffs",
  category: "career-growth",
  tags: ["pivot"],
  origin: "seed",
};

function draft(overrides: Partial<PostDraft> = {}): PostDraft & { readingMinutes: number } {
  return {
    slug: "how-to-pivot-careers",
    title: "How to Pivot Careers",
    excerpt: "A guide.",
    category: "career-growth",
    tags: ["pivot"],
    content: "## Intro\n\nBody text.",
    sources: [],
    heroEmoji: "🔁",
    readingMinutes: 5,
    ...overrides,
  };
}

describe("runEditorialPipeline", () => {
  it("returns a finalized post when the editor approves on round 1", async () => {
    const write = vi.fn(async () => draft());
    const review = vi.fn(async (): Promise<EditorVerdict> => ({ decision: "approve", score: 91, issues: [] }));

    const { post } = await runEditorialPipeline(brief, { write, review });
    expect(post?.slug).toBe("how-to-pivot-careers");
    expect(post?.editorScore).toBe(91);
    expect(post?.editorRounds).toBe(1);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("loops back to the writer with feedback, then approves", async () => {
    const write = vi.fn(async () => draft());
    const review = vi
      .fn<(o: { draft: PostDraft }) => Promise<EditorVerdict>>()
      .mockResolvedValueOnce({ decision: "revise", score: 60, issues: ["weak intro"], revisionInstructions: "Sharpen the opening." })
      .mockResolvedValueOnce({ decision: "approve", score: 85, issues: [] });

    const { post } = await runEditorialPipeline(brief, { write, review, maxRounds: 2 });
    expect(post?.editorRounds).toBe(2);
    // The writer received the editor's revision instructions on the 2nd call.
    expect(write).toHaveBeenLastCalledWith({ brief, editorFeedback: "Sharpen the opening." });
  });

  it("applies the editor's polished copy-edit when approving", async () => {
    const write = vi.fn(async () => draft());
    const review = vi.fn(async (): Promise<EditorVerdict> => ({ decision: "approve", score: 90, issues: [], polishedContent: "## Polished\n\nTighter." }));

    const { post } = await runEditorialPipeline(brief, { write, review });
    expect(post?.content).toBe("## Polished\n\nTighter.");
  });

  it("returns no post when the editor rejects", async () => {
    const write = vi.fn(async () => draft());
    const review = vi.fn(async (): Promise<EditorVerdict> => ({ decision: "reject", score: 20, issues: ["off topic"] }));

    const { post, rejectedReason } = await runEditorialPipeline(brief, { write, review });
    expect(post).toBeUndefined();
    expect(rejectedReason).toContain("off topic");
  });

  it("gives up after maxRounds when never approved", async () => {
    const write = vi.fn(async () => draft());
    const review = vi.fn(async (): Promise<EditorVerdict> => ({ decision: "revise", score: 55, issues: ["x"], revisionInstructions: "more" }));

    const { post } = await runEditorialPipeline(brief, { write, review, maxRounds: 2 });
    expect(post).toBeUndefined();
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("returns no post when the writer produces nothing", async () => {
    const write = vi.fn(async () => null);
    const review = vi.fn(async (): Promise<EditorVerdict> => ({ decision: "approve", score: 99, issues: [] }));

    const { post } = await runEditorialPipeline(brief, { write, review });
    expect(post).toBeUndefined();
    expect(review).not.toHaveBeenCalled();
  });
});

describe("sourceIdeas (ideator parsing + dedupe)", () => {
  it("parses briefs and drops ones matching existing slugs", async () => {
    // The ideator makes a seed call and a trending call; return canned JSON for both.
    const call = vi.fn(async () => ({
      text: JSON.stringify([
        { title: "How to Pivot Careers", angle: "a", category: "career-growth", tags: ["pivot"] },
        { title: "Brand New Topic", angle: "b", category: "resume", keyQuestions: ["q1", "q2"] },
      ]),
      sources: [],
    }));

    const briefs = await sourceIdeas({
      seedTopics: [{ title: "x", category: "resume" }],
      existingSlugs: new Set(["how-to-pivot-careers"]),
      seedCount: 2,
      trendingCount: 0,
      call,
    });

    // The already-existing slug is removed; the new one survives (deduped across calls).
    expect(briefs.map((b) => b.slug)).toEqual(["brand-new-topic"]);
    expect(briefs[0].origin).toBe("seed");
  });
});
