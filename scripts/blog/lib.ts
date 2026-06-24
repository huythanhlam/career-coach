/**
 * Shared utilities for the blog editorial pipeline. No side effects on import,
 * so it's safe to use from build.ts, sync.ts, and tests.
 *
 * On-disk format (data/blog/posts/<slug>.md): a markdown body with a leading
 * HTML-comment JSON metadata block. The comment is hidden when the file renders
 * in a GitHub PR (so reviewers read clean markdown), and it parses with zero
 * extra dependencies (respects .npmrc ignore-scripts).
 *
 *   <!-- blog-meta
 *   { "slug": "...", "title": "...", ... }
 *   -->
 *
 *   # Title
 *   ...body...
 */
import type { BlogPost, PostFileMeta } from "../../src/types/blogPost.ts";

// Reuse the deterministic slugify + polite sleep from the company-profiles
// pipeline so the two stay in lock-step (and we don't duplicate the logic).
export { slugify, sleep } from "../company-profiles/lib.ts";

const META_OPEN = "<!-- blog-meta";
const META_CLOSE = "-->";

/** Average adult reading speed (~225 wpm); rounded up, min 1. */
export function readingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

/** Serialize a post to the on-disk markdown-with-metadata format. */
export function serializePost(post: BlogPost): string {
  const meta: PostFileMeta = {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    tags: post.tags,
    sources: post.sources,
    heroEmoji: post.heroEmoji,
    model: post.model,
    readingMinutes: post.readingMinutes,
    editorScore: post.editorScore,
    editorRounds: post.editorRounds,
    generatedAt: post.generatedAt,
  };
  const body = post.content.trim();
  return `${META_OPEN}\n${JSON.stringify(meta, null, 2)}\n${META_CLOSE}\n\n${body}\n`;
}

/** Parse an on-disk post file back into a BlogPost. Throws on malformed input. */
export function parsePostFile(text: string): BlogPost {
  const start = text.indexOf(META_OPEN);
  if (start === -1) throw new Error("missing blog-meta block");
  const metaStart = start + META_OPEN.length;
  const close = text.indexOf(META_CLOSE, metaStart);
  if (close === -1) throw new Error("unterminated blog-meta block");

  const meta = JSON.parse(text.slice(metaStart, close).trim()) as PostFileMeta;
  const content = text.slice(close + META_CLOSE.length).trim();
  if (!meta.slug || !meta.title) throw new Error("blog-meta missing slug/title");

  return {
    slug: meta.slug,
    title: meta.title,
    excerpt: meta.excerpt ?? "",
    category: meta.category ?? "general",
    tags: meta.tags ?? [],
    content,
    sources: meta.sources ?? [],
    heroEmoji: meta.heroEmoji,
    model: meta.model,
    readingMinutes: meta.readingMinutes ?? readingMinutes(content),
    editorScore: meta.editorScore,
    editorRounds: meta.editorRounds,
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
  };
}

/** Parse the shared CLI flags used by build.ts. */
export interface BlogBuildArgs {
  limit?: number;
  seedOnly: boolean;
  trendingOnly: boolean;
  dryRun: boolean;
}
export function parseBuildArgs(argv: string[]): BlogBuildArgs {
  const out: BlogBuildArgs = { seedOnly: false, trendingOnly: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit") out.limit = Number(argv[++i]);
    else if (argv[i] === "--seed-only") out.seedOnly = true;
    else if (argv[i] === "--trending-only") out.trendingOnly = true;
    else if (argv[i] === "--dry-run") out.dryRun = true;
  }
  return out;
}
