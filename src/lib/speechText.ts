/**
 * Convert Markdown (as produced by the interviewer model) into clean plain
 * text suitable for speech synthesis. The Web Speech API reads raw strings
 * literally, so symbols like `**`, `#`, and `-` would otherwise be spoken or
 * disrupt the cadence. This strips the common Markdown constructs while keeping
 * the readable words and sentence flow.
 */
export function stripMarkdown(md: string): string {
  if (!md) return "";
  let text = md;

  // Fenced code blocks → keep the inner code as plain lines, drop the fences
  // and the blank lines they leave behind.
  text = text.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_m, code: string) =>
    code.replace(/^\n+|\n+$/g, ""),
  );
  // Inline code `x` → x
  text = text.replace(/`([^`]+)`/g, "$1");
  // Images ![alt](url) → alt
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Links [text](url) → text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Bold / italics (**, __, *, _) → inner text
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");
  // Strikethrough ~~text~~ → text
  text = text.replace(/~~(.*?)~~/g, "$1");
  // Headings: drop leading #'s
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  // Blockquotes: drop leading >
  text = text.replace(/^\s{0,3}>\s?/gm, "");
  // Unordered list bullets (-, *, +) → nothing
  text = text.replace(/^\s{0,3}[-*+]\s+/gm, "");
  // Ordered list markers (1.) → nothing
  text = text.replace(/^\s{0,3}\d+\.\s+/gm, "");
  // Horizontal rules
  text = text.replace(/^\s{0,3}([-*_])\1{2,}\s*$/gm, "");
  // Collapse 3+ newlines, trim trailing spaces per line.
  text = text.replace(/[ \t]+$/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}
