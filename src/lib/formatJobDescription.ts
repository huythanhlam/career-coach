// Normalize a job description (HTML, partial-markdown, or plain text) into clean
// Markdown so it renders with real headings, bullet lists, and emphasis — far more
// readable than a flat wall of text. Used by the in-app description renderer.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  bull: "•",
  middot: "·",
  deg: "°",
  trade: "™",
  reg: "®",
  copy: "©",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#?[\w]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isNaN(n) ? m : String.fromCodePoint(n);
    }
    return e in NAMED_ENTITIES ? NAMED_ENTITIES[e] : m;
  });
}

const stripTags = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

function looksLikeHtml(s: string): boolean {
  return /<\/?(p|div|ul|ol|li|br|h[1-6]|strong|b|em|i|span|a|table|tr|td)\b/i.test(s);
}

/** Convert an HTML fragment to Markdown, preserving headings, lists, emphasis & links. */
export function htmlToMarkdown(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Inline emphasis & links first, so list/heading inner text keeps them.
  s = s.replace(/<a\b[^>]*?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, t) => {
    const txt = stripTags(t);
    return txt ? `[${txt}](${href})` : "";
  });
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, t) => `**${stripTags(t)}**`);
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, t) => `*${stripTags(t)}*`);

  // Headings.
  s = s.replace(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi, (_m, t) => `\n\n## ${stripTags(t)}\n\n`);
  s = s.replace(/<h[3-6]\b[^>]*>([\s\S]*?)<\/h[3-6]>/gi, (_m, t) => `\n\n### ${stripTags(t)}\n\n`);

  // List items → "- ", and close list blocks with a blank line.
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, t) => `\n- ${stripTags(t)}`);
  s = s.replace(/<\/(ul|ol)>/gi, "\n\n").replace(/<(ul|ol)\b[^>]*>/gi, "\n");

  // Block boundaries.
  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|tr|h[1-6])>/gi, "\n\n")
    .replace(/<\/(td|th)>/gi, " ");

  // Drop anything left, decode entities, tidy whitespace.
  s = decodeEntities(s.replace(/<[^>]+>/g, ""));
  return s
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Section headers commonly found in job descriptions.
const SECTION_RE =
  /^(about(?: (?:us|the (?:role|team|company|job)))?|the role|role overview|overview|responsibilities|what you(?:'|’)?ll do|what you will do|your role|day[- ]to[- ]day|requirements|requirements?\s*&?\s*qualifications|qualifications|what we(?:'|’)?re looking for|who you are|must[- ]haves?|nice[- ]to[- ]haves?|preferred qualifications|basic qualifications|skills(?: and experience)?|experience|benefits|perks(?: (?:and|&) benefits)?|what we offer|compensation|salary|pay(?: range)?|why (?:join us|work (?:here|with us))|our team|equal (?:employment )?opportunity|how to apply)\s*:?\s*$/i;

const BULLET_RE = /^\s*[•▪◦‣·*–—-]\s+/;

/** Heuristically upgrade plain-text descriptions: bullet glyphs → list items, section lines → headings. */
function textToMarkdown(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const trimmed = line.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    if (BULLET_RE.test(line)) {
      out.push(line.replace(BULLET_RE, "- "));
      continue;
    }
    // A short line that is a known section name (optionally ending with ":") → heading.
    if (
      trimmed.length <= 60 &&
      (SECTION_RE.test(trimmed) || (/:$/.test(trimmed) && trimmed.split(/\s+/).length <= 6))
    ) {
      out.push(`\n## ${trimmed.replace(/:$/, "")}\n`);
      continue;
    }
    out.push(line);
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Normalize any job-description string into clean Markdown. */
export function toMarkdown(input: string | null | undefined): string {
  if (!input) return "";
  const s = looksLikeHtml(input) ? htmlToMarkdown(input) : textToMarkdown(input);
  return s.trim();
}
