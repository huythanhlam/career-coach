import { describe, it, expect } from "vitest";
import { serializePost, parsePostFile, readingMinutes, parseBuildArgs, slugify } from "./lib.ts";
import { toRow } from "./db.ts";
import type { BlogPost } from "../../src/types/blogPost.ts";

const post: BlogPost = {
  slug: "how-to-write-a-resume",
  title: "How to Write a Resume",
  excerpt: "A practical guide.",
  category: "resume",
  tags: ["resume", "ats"],
  content: "## Start here\n\nLead with impact.\n\n- Bullet one\n- Bullet two",
  sources: [{ label: "BLS", url: "https://bls.gov" }],
  heroEmoji: "📝",
  model: "gemini-2.5-flash",
  readingMinutes: 4,
  editorScore: 88,
  editorRounds: 2,
  generatedAt: "2026-06-23T00:00:00.000Z",
};

describe("serializePost / parsePostFile", () => {
  it("round-trips a post through the on-disk format", () => {
    const round = parsePostFile(serializePost(post));
    expect(round).toEqual(post);
  });

  it("keeps the metadata in a hidden HTML comment and the body as plain markdown", () => {
    const text = serializePost(post);
    expect(text.startsWith("<!-- blog-meta")).toBe(true);
    // Body (after the comment) is clean markdown — renders nicely in a PR.
    const body = text.slice(text.indexOf("-->") + 3).trim();
    expect(body.startsWith("## Start here")).toBe(true);
    expect(body).not.toContain("blog-meta");
  });

  it("throws on a file with no metadata block", () => {
    expect(() => parsePostFile("# Just markdown")).toThrow();
  });
});

describe("readingMinutes", () => {
  it("estimates from word count, min 1", () => {
    expect(readingMinutes("one two three")).toBe(1);
    expect(readingMinutes(Array(450).fill("word").join(" "))).toBe(2);
  });
});

describe("parseBuildArgs", () => {
  it("parses limit and flags", () => {
    expect(parseBuildArgs(["--limit", "5", "--seed-only"])).toEqual({ limit: 5, seedOnly: true, trendingOnly: false, dryRun: false });
    expect(parseBuildArgs(["--trending-only", "--dry-run"])).toEqual({ seedOnly: false, trendingOnly: true, dryRun: true });
    expect(parseBuildArgs([])).toEqual({ seedOnly: false, trendingOnly: false, dryRun: false });
  });
});

describe("slugify (re-exported from company-profiles)", () => {
  it("produces url-safe slugs", () => {
    expect(slugify("How to Write a Résumé!")).toBe("how-to-write-a-resume");
  });
});

describe("db.toRow", () => {
  it("maps a post to a snake_case blog_posts row", () => {
    const row = toRow(post);
    expect(row.slug).toBe("how-to-write-a-resume");
    expect(row.hero_emoji).toBe("📝");
    expect(row.editor_score).toBe(88);
    expect(row.reading_minutes).toBe(4);
    expect(row.published).toBe(true);
    expect(row.tags).toEqual(["resume", "ats"]);
    expect(typeof row.updated_at).toBe("string");
  });
});
