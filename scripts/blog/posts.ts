/**
 * Shared access to the seed topics + committed post files. No side effects on
 * import, so it's safe to use from build.ts, sync.ts, and tests.
 */
import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { serializePost, parsePostFile } from "./lib.ts";
import type { SeedTopic } from "./agents/ideator.ts";
import type { BlogPost } from "../../src/types/blogPost.ts";

export const DIR = join(process.cwd(), "data", "blog");
export const POSTS_DIR = join(DIR, "posts");
export const TOPICS_FILE = join(DIR, "_topics.json");

export function ensureDir(): void {
  mkdirSync(POSTS_DIR, { recursive: true });
}

/** Load the curated evergreen seed topics. */
export function loadSeedTopics(): SeedTopic[] {
  if (!existsSync(TOPICS_FILE)) return [];
  return JSON.parse(readFileSync(TOPICS_FILE, "utf8")) as SeedTopic[];
}

/** Slugs already committed to disk (so the Ideator never re-pitches them). */
export function existingSlugs(): string[] {
  if (!existsSync(POSTS_DIR)) return [];
  return readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => f.replace(/\.md$/, ""));
}

/** Write a finalized post to data/blog/posts/<slug>.md. */
export function writePost(post: BlogPost): string {
  ensureDir();
  const path = join(POSTS_DIR, `${post.slug}.md`);
  writeFileSync(path, serializePost(post));
  return path;
}

/** Load every committed post (for sync). Skips malformed files. */
export function loadPosts(): BlogPost[] {
  if (!existsSync(POSTS_DIR)) return [];
  const out: BlogPost[] = [];
  for (const f of readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_"))) {
    try {
      out.push(parsePostFile(readFileSync(join(POSTS_DIR, f), "utf8")));
    } catch (e) {
      console.warn(`• Skipping ${f}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}
