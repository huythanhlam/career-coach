/**
 * Ideator agent — sources blog post ideas. Blends an evergreen seed list with
 * live, search-discovered trends, dedupes against topics we've already covered,
 * and returns focused topic briefs for the Writer.
 */
import { callAgent, parseJsonResponse } from "../gemini.ts";
import { ideatorSystem } from "../prompts.ts";
import { slugify } from "../lib.ts";
import type { TopicBrief } from "../../../src/types/blogPost.ts";

export interface SeedTopic {
  title: string;
  category: string;
}

export interface IdeateOptions {
  seedTopics: SeedTopic[];
  /** Slugs already on disk or in the DB — never re-pitch these. */
  existingSlugs: Set<string>;
  /** How many seed-derived briefs to produce. */
  seedCount: number;
  /** How many trending briefs to discover via web search. */
  trendingCount: number;
  /** Injected for tests; defaults to the real Gemini call. */
  call?: typeof callAgent;
}

interface RawBrief {
  title?: string;
  angle?: string;
  audience?: string;
  keyQuestions?: string[];
  whyNow?: string;
  category?: string;
  tags?: string[];
}

function toBrief(raw: RawBrief, origin: TopicBrief["origin"]): TopicBrief | null {
  const title = (raw.title ?? "").trim();
  if (!title) return null;
  const slug = slugify(title);
  if (!slug) return null;
  return {
    slug,
    title,
    angle: (raw.angle ?? "").trim(),
    audience: (raw.audience ?? "professionals across industries").trim(),
    keyQuestions: Array.isArray(raw.keyQuestions) ? raw.keyQuestions.slice(0, 6) : [],
    whyNow: (raw.whyNow ?? "").trim(),
    category: (raw.category ?? "general").trim().toLowerCase(),
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 6).map((t) => String(t).trim()) : [],
    origin,
  };
}

/** Dedupe briefs against existing slugs and against each other. */
function dedupe(briefs: TopicBrief[], existing: Set<string>): TopicBrief[] {
  const seen = new Set(existing);
  const out: TopicBrief[] = [];
  for (const b of briefs) {
    if (seen.has(b.slug)) continue;
    seen.add(b.slug);
    out.push(b);
  }
  return out;
}

async function ideate(
  origin: TopicBrief["origin"],
  count: number,
  prompt: string,
  search: boolean,
  call: typeof callAgent,
): Promise<TopicBrief[]> {
  if (count <= 0) return [];
  const { text } = await call({ system: ideatorSystem, prompt, search });
  const raw = parseJsonResponse<RawBrief[]>(text);
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => toBrief(r, origin)).filter((b): b is TopicBrief => b !== null);
}

const briefShape = `Return ONLY a JSON array. Each item:
{ "title": string, "angle": string (the specific take), "audience": string,
  "keyQuestions": string[] (3–5 questions the post must answer),
  "whyNow": string (why this is worth reading now),
  "category": string (one of: resume, interview, job-search, career-growth, salary, networking, linkedin, job-market, general),
  "tags": string[] (3–5 lowercase tags) }`;

/**
 * Produce ranked, deduped topic briefs: `seedCount` derived from the evergreen
 * list + `trendingCount` discovered via web search.
 */
export async function sourceIdeas(opts: IdeateOptions): Promise<TopicBrief[]> {
  const call = opts.call ?? callAgent;
  const seedList = opts.seedTopics.map((s) => `- ${s.title} [${s.category}]`).join("\n");

  const seedPrompt = `From these evergreen career themes, choose ${opts.seedCount} and turn each into a fresh, specific topic brief. Vary the categories. Avoid anything resembling these already-published slugs: ${[...opts.existingSlugs].join(", ") || "(none yet)"}.

Themes:
${seedList}

${briefShape}`;

  const trendingPrompt = `Search the web for what is timely and noteworthy in careers and the job market right now (hiring trends, layoffs, AI's impact on work, in-demand skills, remote/return-to-office shifts, salary movements). Propose ${opts.trendingCount} timely blog post briefs that would genuinely help job seekers and professionals this month. Avoid anything resembling these already-published slugs: ${[...opts.existingSlugs].join(", ") || "(none yet)"}.

${briefShape}`;

  const [seedBriefs, trendingBriefs] = await Promise.all([
    ideate("seed", opts.seedCount, seedPrompt, false, call),
    ideate("trending", opts.trendingCount, trendingPrompt, true, call),
  ]);

  return dedupe([...seedBriefs, ...trendingBriefs], opts.existingSlugs);
}
