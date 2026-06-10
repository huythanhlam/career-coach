// Shared HTML → Markdown conversion for job descriptions.
//
// Job boards return descriptions as HTML. We convert to Markdown (not flat text)
// so the app can render real headings, bullet lists, and emphasis — and we keep a
// generous length cap so the FULL description (responsibilities, requirements,
// benefits, etc.) survives rather than being truncated mid-section.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " ",
  mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  hellip: "…", bull: "•", middot: "·", deg: "°", trade: "™", reg: "®", copy: "©",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#?[\w]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isNaN(n) ? m : String.fromCodePoint(n);
    }
    return e in NAMED_ENTITIES ? NAMED_ENTITIES[e] : m;
  });
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Convert an HTML fragment to Markdown (headings, lists, emphasis, links), capped to maxLen. */
export function htmlToMarkdown(html: string, maxLen = 24000): string {
  if (!html) return "";
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  s = s.replace(/<a\b[^>]*?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, t) => {
    const txt = stripTags(t);
    return txt ? `[${txt}](${href})` : "";
  });
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, t) => `**${stripTags(t)}**`);
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, t) => `*${stripTags(t)}*`);

  s = s.replace(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi, (_m, t) => `\n\n## ${stripTags(t)}\n\n`);
  s = s.replace(/<h[3-6]\b[^>]*>([\s\S]*?)<\/h[3-6]>/gi, (_m, t) => `\n\n### ${stripTags(t)}\n\n`);

  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, t) => `\n- ${stripTags(t)}`);
  s = s.replace(/<\/(ul|ol)>/gi, "\n\n").replace(/<(ul|ol)\b[^>]*>/gi, "\n");

  s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|section|article|header|tr|h[1-6])>/gi, "\n\n").replace(/<\/(td|th)>/gi, " ");

  s = decodeEntities(s.replace(/<[^>]+>/g, ""));
  s = s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return s.slice(0, maxLen);
}
