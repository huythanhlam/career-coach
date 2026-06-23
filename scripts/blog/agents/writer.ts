/**
 * Writer agent — drafts a full blog post from a topic brief, with optional
 * editor feedback for revision rounds. Uses search grounding so claims carry
 * real citations; the grounding sources are attached to the draft.
 */
import { callAgent, parseJsonResponse } from "../gemini.ts";
import { writerSystem } from "../prompts.ts";
import { slugify, readingMinutes } from "../lib.ts";
import type { PostDraft, TopicBrief, BlogSource } from "../../../src/types/blogPost.ts";

export interface WriteOptions {
  brief: TopicBrief;
  editorFeedback?: string;
  call?: typeof callAgent;
}

interface RawDraft {
  title?: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  heroEmoji?: string;
  content?: string;
}

/** Draft (or revise) a post. Returns null if the model produced no usable body. */
export async function writeDraft(opts: WriteOptions): Promise<(PostDraft & { readingMinutes: number }) | null> {
  const call = opts.call ?? callAgent;
  const b = opts.brief;

  const feedback = opts.editorFeedback
    ? `\n\nThe editor reviewed your previous draft and requires these revisions. Address every point:\n${opts.editorFeedback}\n`
    : "";

  const prompt = `Write a blog post for this brief:
Title: ${b.title}
Angle: ${b.angle}
Audience: ${b.audience}
Must answer: ${b.keyQuestions.join("; ")}
Why now: ${b.whyNow}
Suggested category: ${b.category}
${feedback}
Return ONLY a JSON object:
{ "title": string (a strong, specific headline),
  "excerpt": string (1–2 sentence summary for the post card, <= 200 chars),
  "category": string,
  "tags": string[] (3–5 lowercase tags),
  "heroEmoji": string (a single emoji that fits the topic),
  "content": string (the full Markdown body, 700–1100 words, starting with an "## " heading, NO H1) }`;

  const { text, sources } = await call({ system: writerSystem, prompt, search: true });
  const raw = parseJsonResponse<RawDraft>(text);
  const content = (raw?.content ?? "").trim();
  if (!raw || !content) return null;

  const title = (raw.title ?? b.title).trim();
  return {
    slug: slugify(title) || b.slug,
    title,
    excerpt: (raw.excerpt ?? "").trim(),
    category: (raw.category ?? b.category ?? "general").trim().toLowerCase(),
    tags: Array.isArray(raw.tags) && raw.tags.length ? raw.tags.map((t) => String(t).trim()) : b.tags,
    content,
    sources: dedupeSources(sources),
    heroEmoji: (raw.heroEmoji ?? "").trim() || undefined,
    readingMinutes: readingMinutes(content),
  };
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
