/**
 * Editor agent — reviews a draft like a managing editor and returns a structured
 * verdict (approve / revise / reject) with a quality score and concrete issues.
 * The Writer uses `revisionInstructions` to fix a "revise" verdict.
 */
import { callAgent, parseJsonResponse } from "../gemini.ts";
import { editorSystem } from "../prompts.ts";
import type { EditorVerdict, PostDraft } from "../../../src/types/blogPost.ts";

export interface ReviewOptions {
  draft: PostDraft;
  call?: typeof callAgent;
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

/** Review a draft. On API/parse failure, returns a conservative "revise". */
export async function reviewDraft(opts: ReviewOptions): Promise<EditorVerdict> {
  const call = opts.call ?? callAgent;
  const d = opts.draft;
  const sourceList = d.sources.length
    ? d.sources.map((s) => `- ${s.label}: ${s.url}`).join("\n")
    : "(none provided)";

  const prompt = `Review this draft post.

Title: ${d.title}
Category: ${d.category}
Excerpt: ${d.excerpt}
Sources available to support claims:
${sourceList}

--- DRAFT MARKDOWN ---
${d.content}
--- END DRAFT ---

Return ONLY a JSON object:
{ "decision": "approve" | "revise" | "reject",
  "score": number (0–100 editorial quality),
  "issues": string[] (specific problems; empty if approve),
  "revisionInstructions": string (concrete fixes; required when decision is "revise"),
  "polishedContent": string (OPTIONAL — only when approving with minor copy-edits, the full edited Markdown body) }`;

  let raw: RawVerdict | null = null;
  try {
    const { text } = await call({ system: editorSystem, prompt });
    raw = parseJsonResponse<RawVerdict>(text);
  } catch {
    raw = null;
  }
  if (!raw) {
    return { decision: "revise", score: 0, issues: ["Editor response could not be parsed."], revisionInstructions: "Re-draft cleanly following the brief." };
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
