/**
 * Blog post types — shared between the editorial pipeline (scripts/blog/*) and
 * the frontend blog UI. Posts are auto-curated by a 3-agent pipeline (Ideator →
 * Writer → Editor), committed as markdown to data/blog/posts/, reviewed in a PR,
 * then synced into the public `blog_posts` table.
 */

/** A grounding citation surfaced from Gemini's Google-Search metadata. */
export interface BlogSource {
  label: string;
  url: string;
}

/**
 * A topic idea produced by the Ideator. The brief (not just a title) keeps the
 * Writer focused and non-generic.
 */
export interface TopicBrief {
  slug: string;
  title: string;
  angle: string;
  audience: string;
  keyQuestions: string[];
  whyNow: string;
  category: string;
  tags: string[];
  /** Where the idea came from: a curated seed topic or AI-discovered trend. */
  origin: "seed" | "trending";
}

/** A drafted post before it is finalized to disk. */
export interface PostDraft {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  content: string; // markdown body
  sources: BlogSource[];
  heroEmoji?: string;
}

/** The Editor's structured verdict on a draft. */
export interface EditorVerdict {
  decision: "approve" | "revise" | "reject";
  score: number; // 0–100 editorial quality
  issues: string[];
  revisionInstructions?: string;
  /** Optional light copy-edit the Editor applied; used when decision is approve. */
  polishedContent?: string;
}

/** The full, finalized blog post (mirrors a `blog_posts` row, camelCased). */
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  content: string; // markdown body
  sources: BlogSource[];
  heroEmoji?: string;
  model?: string;
  readingMinutes: number;
  /** Editorial provenance recorded for transparency in the PR + DB. */
  editorScore?: number;
  editorRounds?: number;
  generatedAt: string;
  publishedAt?: string;
  /** Lifecycle: 'review' = queued draft (not public), 'published' = live. */
  status?: "draft" | "review" | "published";
  /** Whether the post is publicly visible. */
  published?: boolean;
}

/** The JSON metadata block stored in each markdown file's leading HTML comment. */
export interface PostFileMeta {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  sources: BlogSource[];
  heroEmoji?: string;
  model?: string;
  readingMinutes: number;
  editorScore?: number;
  editorRounds?: number;
  generatedAt: string;
}
