/**
 * Pure helpers for turning a backlog topic into a drafted blog post in the
 * browser. The in-app admin authoring flow runs a trimmed Writer + Editor pass
 * through the AI gateway (see geminiService.generateBlogDraft); these functions
 * build the prompts and parse the responses with no I/O or SDK dependencies, so
 * they're unit-testable in isolation.
 *
 * The prompt shapes intentionally mirror scripts/blog/agents/{writer,editor}.ts
 * (the CI pipeline). The shared *system* prompts live in src/config/blogPrompts.ts;
 * keep the user-prompt JSON schemas below in sync with the agents.
 */
import type { PostDraft, TopicBrief, BlogSource, EditorVerdict } from "@/types/blogPost";

/**
 * Slugify a title. Mirrors scripts/company-profiles/lib.ts `slugify` (which the
 * blog pipeline reuses) so an in-app draft lands on the same slug the pipeline
 * would have chosen for the same topic.
 */
export function slugify(s: string): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Average adult reading speed (~225 wpm); rounded, min 1. Mirrors scripts/blog/lib.ts. */
export function readingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 225));
}

/**
 * Parse a JSON object/array from a model response, tolerating ```json fences and
 * surrounding prose. Returns null instead of throwing so callers can degrade.
 * Mirrors scripts/blog/gemini.ts `parseJsonResponse`.
 */
export function parseJsonResponse<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const trimmed = candidate.trim();
  const tryParse = (s: string): T | null => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  };
  const direct = tryParse(trimmed);
  if (direct !== null) return direct;
  const firstObj = trimmed.indexOf("{");
  const firstArr = trimmed.indexOf("[");
  const start =
    firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
  if (start === -1) return null;
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (end <= start) return null;
  return tryParse(trimmed.slice(start, end + 1));
}

/**
 * Build a topic brief from a backlog entry (just a title + category). The in-app
 * flow skips the Ideator, so we synthesize a thin-but-usable brief deterministically;
 * the detailed Writer system prompt carries most of the quality, and the admin
 * edits the result afterward.
 */
export function briefFromTopic(title: string, category: string): TopicBrief {
  const cleanTitle = (title ?? "").trim();
  return {
    slug: slugify(cleanTitle),
    title: cleanTitle,
    angle: `A practical, specific, example-driven take on "${cleanTitle}".`,
    audience: "professionals across industries and seniority levels",
    keyQuestions: [],
    whyNow: "Evergreen guidance readers search for regularly.",
    category: (category || "general").trim().toLowerCase(),
    tags: [],
    origin: "seed",
  };
}

interface RawDraft {
  title?: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  heroEmoji?: string;
  content?: string;
}

/** The Writer user prompt for a brief (+ optional editor feedback for a revision). */
export function buildWriterPrompt(brief: TopicBrief, editorFeedback?: string): string {
  const feedback = editorFeedback
    ? `\n\nThe editor reviewed your previous draft and requires these revisions. Address every point:\n${editorFeedback}\n`
    : "";
  return `Write a blog post for this brief:
Title: ${brief.title}
Angle: ${brief.angle}
Audience: ${brief.audience}
Must answer: ${brief.keyQuestions.join("; ")}
Why now: ${brief.whyNow}
Suggested category: ${brief.category}
${feedback}
Return ONLY a JSON object:
{ "title": string (a strong, specific headline),
  "excerpt": string (1–2 sentence summary for the post card, <= 200 chars),
  "category": string,
  "tags": string[] (3–5 lowercase tags),
  "heroEmoji": string (a single emoji that fits the topic),
  "content": string (the full Markdown body, 700–1100 words, starting with an "## " heading, NO H1) }`;
}

function dedupeSources(sources: BlogSource[]): BlogSource[] {
  const seen = new Set<string>();
  const out: BlogSource[] = [];
  for (const s of sources) {
    if (!s?.url || seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}

/** Parse the Writer's JSON response into a draft. Returns null if no usable body. */
export function parseWriterDraft(
  text: string,
  brief: TopicBrief,
  sources: BlogSource[]
): (PostDraft & { readingMinutes: number }) | null {
  const raw = parseJsonResponse<RawDraft>(text);
  const content = (raw?.content ?? "").trim();
  if (!raw || !content) return null;

  const title = (raw.title ?? brief.title).trim();
  return {
    slug: slugify(title) || brief.slug,
    title,
    excerpt: (raw.excerpt ?? "").trim(),
    category: (raw.category ?? brief.category ?? "general").trim().toLowerCase(),
    tags:
      Array.isArray(raw.tags) && raw.tags.length
        ? raw.tags.map((t) => String(t).trim())
        : brief.tags,
    content,
    sources: dedupeSources(sources),
    heroEmoji: (raw.heroEmoji ?? "").trim() || undefined,
    readingMinutes: readingMinutes(content),
  };
}

interface RawVerdict {
  decision?: string;
  score?: number;
  issues?: string[];
  revisionInstructions?: string;
  polishedContent?: string;
}

function normalizeDecision(d: string | undefined): EditorVerdict["decision"] {
  const v = (d ?? "").toLowerCase();
  if (v === "approve" || v === "revise" || v === "reject") return v;
  return "revise";
}

/** The Editor user prompt for a draft. */
export function buildEditorPrompt(draft: PostDraft): string {
  const sourceList = draft.sources.length
    ? draft.sources.map((s) => `- ${s.label}: ${s.url}`).join("\n")
    : "(none provided)";
  return `Review this draft post.

Title: ${draft.title}
Category: ${draft.category}
Excerpt: ${draft.excerpt}
Sources available to support claims:
${sourceList}

--- DRAFT MARKDOWN ---
${draft.content}
--- END DRAFT ---

Return ONLY a JSON object:
{ "decision": "approve" | "revise" | "reject",
  "score": number (0–100 editorial quality),
  "issues": string[] (specific problems; empty if approve),
  "revisionInstructions": string (concrete fixes; required when decision is "revise"),
  "polishedContent": string (OPTIONAL — only when approving with minor copy-edits, the full edited Markdown body) }`;
}

/** Parse the Editor's JSON response into a verdict. On parse failure, a conservative "revise". */
export function parseEditorVerdict(text: string): EditorVerdict {
  const raw = parseJsonResponse<RawVerdict>(text);
  if (!raw) {
    return {
      decision: "revise",
      score: 0,
      issues: ["Editor response could not be parsed."],
      revisionInstructions: "Re-draft cleanly following the brief.",
    };
  }
  const decision = normalizeDecision(raw.decision);
  const polished = typeof raw.polishedContent === "string" ? raw.polishedContent.trim() : undefined;
  return {
    decision,
    score: typeof raw.score === "number" ? Math.max(0, Math.min(100, raw.score)) : 0,
    issues: Array.isArray(raw.issues) ? raw.issues.map((i) => String(i)) : [],
    revisionInstructions: raw.revisionInstructions?.trim() || undefined,
    polishedContent: decision === "approve" && polished ? polished : undefined,
  };
}
