/**
 * Editorial orchestrator. For one topic brief: Writer drafts → Editor reviews →
 * if "revise", loop back to the Writer with feedback (capped) → on "approve",
 * finalize a BlogPost (recording the editor score + round count for provenance).
 * On "reject" after retries, return null so weak drafts never reach the PR.
 *
 * The Writer/Editor are injected so the loop is unit-testable without any
 * network/Gemini calls (see pipeline.test.ts).
 */
import { writeDraft as defaultWrite } from "./agents/writer.ts";
import { reviewDraft as defaultReview } from "./agents/editor.ts";
import type { BlogPost, EditorVerdict, PostDraft, TopicBrief } from "../../src/types/blogPost.ts";

export type WriteFn = (opts: { brief: TopicBrief; editorFeedback?: string }) => Promise<(PostDraft & { readingMinutes: number }) | null>;
export type ReviewFn = (opts: { draft: PostDraft }) => Promise<EditorVerdict>;

export interface PipelineDeps {
  write?: WriteFn;
  review?: ReviewFn;
  /** Max writer↔editor rounds before giving up (default 2). */
  maxRounds?: number;
  /** Optional progress logger. */
  log?: (msg: string) => void;
}

export interface PipelineResult {
  post?: BlogPost;
  /** Why a brief produced no post (for logging). */
  rejectedReason?: string;
}

/** Run the editorial loop for a single brief. */
export async function runEditorialPipeline(brief: TopicBrief, deps: PipelineDeps = {}): Promise<PipelineResult> {
  const write = deps.write ?? defaultWrite;
  const review = deps.review ?? defaultReview;
  const maxRounds = deps.maxRounds ?? 2;
  const log = deps.log ?? (() => {});

  let feedback: string | undefined;
  let lastVerdict: EditorVerdict | undefined;

  for (let round = 1; round <= maxRounds; round++) {
    const draft = await write({ brief, editorFeedback: feedback });
    if (!draft) {
      log(`    ✗ writer produced no draft (round ${round})`);
      return { rejectedReason: "writer produced no draft" };
    }

    const verdict = await review({ draft });
    lastVerdict = verdict;
    log(`    editor round ${round}: ${verdict.decision} (score ${verdict.score})`);

    if (verdict.decision === "approve") {
      return { post: finalize(draft, verdict, round) };
    }
    if (verdict.decision === "reject") {
      return { rejectedReason: `editor rejected: ${verdict.issues.join("; ") || "below bar"}` };
    }
    // revise → loop with the editor's instructions
    feedback = verdict.revisionInstructions || verdict.issues.join("\n");
  }

  return {
    rejectedReason: `not approved after ${maxRounds} rounds${lastVerdict ? ` (last score ${lastVerdict.score})` : ""}`,
  };
}

function finalize(draft: PostDraft & { readingMinutes: number }, verdict: EditorVerdict, rounds: number): BlogPost {
  const now = new Date().toISOString();
  return {
    slug: draft.slug,
    title: draft.title,
    excerpt: draft.excerpt,
    category: draft.category,
    tags: draft.tags,
    // Prefer the editor's light copy-edit when provided.
    content: verdict.polishedContent ?? draft.content,
    sources: draft.sources,
    heroEmoji: draft.heroEmoji,
    model: process.env.BLOG_MODEL || "gemini-2.5-flash",
    readingMinutes: draft.readingMinutes,
    editorScore: verdict.score,
    editorRounds: rounds,
    generatedAt: now,
  };
}
