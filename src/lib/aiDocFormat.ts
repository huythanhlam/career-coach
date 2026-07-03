/**
 * Shared format for AI-generated documents (resumes, cover letters) that the editor
 * needs to extract from a chat response.
 *
 * Previously the AI was told to wrap output in a ```markdown fence, but resume/letter
 * bodies can themselves contain code fences, which broke extraction. We instead use
 * unambiguous sentinel markers. Parsing keeps a legacy fence fallback so older or
 * loosely-formatted responses still work during the transition.
 */

/** Sentinel markers the AI wraps a full generated document in. */
export const DOC_START = "<<<DOC_START>>>";
export const DOC_END = "<<<DOC_END>>>";

/**
 * Instruction appended to a system prompt telling the model how to wrap document output.
 * @param noun e.g. "resume" or "cover letter"
 */
export function docWrapInstruction(noun: string): string {
  return `\n\nCRITICAL INSTRUCTION: When you provide the ${noun}, wrap the ENTIRE ${noun} between ${DOC_START} and ${DOC_END} markers, each on its own line, like:\n${DOC_START}\n[the full ${noun} in Markdown]\n${DOC_END}\nUse these markers only when you intend to create or update the document, and put nothing else between them. This lets the editor extract the document even if it contains code blocks.`;
}

/**
 * Extract the document body from an AI response.
 * Tries the sentinel markers first (robust to bodies containing ``` fences), then falls
 * back to a legacy ```markdown fence. Returns null if neither is present.
 * Handles partial/streaming input (missing DOC_END / closing fence).
 */
export function extractDocument(raw: string): string | null {
  const start = raw.indexOf(DOC_START);
  if (start !== -1) {
    const afterStart = start + DOC_START.length;
    const end = raw.indexOf(DOC_END, afterStart);
    const body = end === -1 ? raw.slice(afterStart) : raw.slice(afterStart, end);
    return body.trim();
  }
  // Legacy fallback: ```markdown ... ``` (or ```md / bare ```), possibly still streaming.
  const fence = raw.match(/```(?:markdown|md)?\s*([\s\S]*?)(?:```|$)/);
  if (fence?.[1]?.trim()) return fence[1].trim();
  return null;
}

/** True if the text contains the start of a document wrapper (sentinel or fence). */
export function hasDocumentWrapper(raw: string): boolean {
  return raw.includes(DOC_START) || raw.includes("```");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace any document block in chat text with a short placeholder for display. */
export function maskDocumentForDisplay(text: string, placeholder = "*(Updated document)*"): string {
  if (text.includes(DOC_START)) {
    const re = new RegExp(
      `${escapeRegExp(DOC_START)}[\\s\\S]*?(?:${escapeRegExp(DOC_END)}|$)`,
      "g",
    );
    return text.replace(re, placeholder);
  }
  if (text.includes("```markdown") || text.includes("```md")) {
    return text.replace(/```(?:markdown|md)?\s*([\s\S]*?)```/g, placeholder);
  }
  return text;
}
