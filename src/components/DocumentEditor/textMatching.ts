import type React from "react";

/**
 * Text-matching utilities for the DocumentEditor.
 *
 * AI suggestions quote `originalText` verbatim from the *plain* resume text, but the
 * editor stores it as HTML (markdown→HTML, with block tags, escaping, and the browser
 * normalising whitespace). A naïve substring search therefore misses any quote that
 * spans a line break, has collapsed whitespace, or uses smart quotes/dashes. These
 * helpers walk the text nodes and match tolerantly: whitespace runs collapse to a
 * single space and common typographic characters are normalised on both sides.
 */

/** Normalise smart quotes / dashes / nbsp to their ASCII equivalents (1 char → 1 char). */
export function normalizeChar(ch: string): string {
  switch (ch.charCodeAt(0)) {
    case 0x2018:
    case 0x2019:
    case 0x201a:
    case 0x201b:
      return "'";
    case 0x201c:
    case 0x201d:
    case 0x201e:
    case 0x201f:
      return '"';
    case 0x2013:
    case 0x2014:
    case 0x2212:
      return "-";
    case 0x00a0:
    case 0x2009:
    case 0x202f:
      return " ";
    default:
      return ch;
  }
}

export function collectTextNodes(root: Element): Text[] {
  const out: Text[] = [];
  const walker = (root.ownerDocument ?? document).createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) out.push(n as Text);
  return out;
}

export const BLOCK_SELECTOR = "p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,tr,div,pre,figcaption";

/** flags[i] = true when node i sits in a different block element than node i-1. */
function blockBoundaryFlags(nodes: Text[]): boolean[] {
  const flags = new Array(nodes.length).fill(false);
  let prevBlock: Element | null = null;
  for (let i = 0; i < nodes.length; i++) {
    const block = nodes[i].parentElement?.closest(BLOCK_SELECTOR) ?? null;
    if (i > 0 && block !== prevBlock) flags[i] = true;
    prevBlock = block;
  }
  return flags;
}

export interface TextMatch {
  startNode: number;
  startOffset: number;
  endNode: number;
  endOffset: number;
}

/** Locate `needle` across `nodes`, tolerant of whitespace runs, line breaks, block
 *  boundaries and smart quotes/dashes. Returns node-relative offsets (end exclusive),
 *  or null. `boundaries` defaults to DOM-derived block boundaries (injectable for tests). */
export function locateTextNodes(
  nodes: Text[],
  needle: string,
  boundaries?: boolean[],
): TextMatch | null {
  const flags = boundaries ?? blockBoundaryFlags(nodes);
  let hay = "";
  const map: { node: number; offset: number }[] = [];
  let prevSpace = false;
  for (let ni = 0; ni < nodes.length; ni++) {
    if (ni > 0 && flags[ni] && !prevSpace && hay.length) {
      hay += " ";
      map.push({ node: ni, offset: 0 });
      prevSpace = true;
    }
    const t = nodes[ni].textContent ?? "";
    for (let oi = 0; oi < t.length; oi++) {
      const c = normalizeChar(t[oi]);
      if (/\s/.test(c)) {
        if (prevSpace) continue;
        hay += " ";
        map.push({ node: ni, offset: oi });
        prevSpace = true;
      } else {
        hay += c;
        map.push({ node: ni, offset: oi });
        prevSpace = false;
      }
    }
  }
  const need = needle.split("").map(normalizeChar).join("").replace(/\s+/g, " ").trim();
  if (!need) return null;
  const idx = hay.indexOf(need);
  if (idx === -1) return null;
  const start = map[idx];
  const end = map[idx + need.length - 1];
  return {
    startNode: start.node,
    startOffset: start.offset,
    endNode: end.node,
    endOffset: end.offset + 1,
  };
}

export function replaceTextNodes(nodes: Text[], m: TextMatch, suggested: string): void {
  if (m.startNode === m.endNode) {
    const t = nodes[m.startNode].textContent ?? "";
    nodes[m.startNode].textContent = t.slice(0, m.startOffset) + suggested + t.slice(m.endOffset);
    return;
  }
  nodes[m.startNode].textContent =
    (nodes[m.startNode].textContent ?? "").slice(0, m.startOffset) + suggested;
  for (let i = m.startNode + 1; i <= m.endNode; i++) {
    const t = nodes[i].textContent ?? "";
    nodes[i].textContent = i === m.endNode ? t.slice(m.endOffset) : "";
  }
}

/** Reveals text in the editor with a transient highlight. Returns a cleanup function or null. */
export function revealTextInEditor(
  root: HTMLElement,
  text: string,
  revealTimerRef: React.MutableRefObject<number | null>,
): void {
  const nodes = collectTextNodes(root);
  const m = locateTextNodes(nodes, text);
  if (!m) return;
  const range = document.createRange();
  range.setStart(nodes[m.startNode], m.startOffset);
  range.setEnd(nodes[m.endNode], m.endOffset);
  (range.startContainer.parentElement ?? root).scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
  const highlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  const HighlightCtor = (globalThis as unknown as { Highlight?: new (r: Range) => unknown })
    .Highlight;
  if (highlights && HighlightCtor) {
    highlights.set("tailor-revise", new HighlightCtor(range));
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = window.setTimeout(() => highlights.delete("tailor-revise"), 2400);
  } else {
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}

/** Sets a persistent highlight on text. Returns a cleanup fn via clearHighlightRef. */
export function setTextHighlight(
  root: HTMLElement,
  text: string,
  highlightName: string,
  clearHighlightRef: React.MutableRefObject<(() => void) | null>,
): void {
  const nodes = collectTextNodes(root);
  const m = locateTextNodes(nodes, text);
  if (!m) return;
  const startNode = nodes[m.startNode];
  const block = startNode.parentElement?.closest(BLOCK_SELECTOR) as HTMLElement | null;
  (block ?? startNode.parentElement)?.scrollIntoView({ behavior: "smooth", block: "center" });
  const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown })
    .Highlight;
  const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  if (HighlightCtor && registry) {
    try {
      const range = document.createRange();
      range.setStart(nodes[m.startNode], m.startOffset);
      range.setEnd(nodes[m.endNode], m.endOffset);
      registry.set(highlightName, new HighlightCtor(range));
      clearHighlightRef.current = () => {
        try {
          registry.delete(highlightName);
        } catch {
          /* noop */
        }
      };
      return;
    } catch {
      /* fall through */
    }
  }
  const el = (block ?? startNode.parentElement) as HTMLElement | null;
  if (!el) return;
  const prevBg = el.style.backgroundColor;
  const prevRadius = el.style.borderRadius;
  el.style.backgroundColor = "rgba(217,119,87,0.18)";
  el.style.borderRadius = "4px";
  clearHighlightRef.current = () => {
    el.style.backgroundColor = prevBg;
    el.style.borderRadius = prevRadius;
  };
}

export function replaceInHtml(html: string, original: string, suggested: string): string {
  if (!original || !suggested || original === suggested) return html;
  if (html.includes(original)) return html.replace(original, suggested);
  const encoded = original
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  if (encoded !== original && html.includes(encoded)) return html.replace(encoded, suggested);
  try {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild as HTMLElement;
    const nodes = collectTextNodes(root);
    const m = locateTextNodes(nodes, original);
    if (!m) return html;
    replaceTextNodes(nodes, m, suggested);
    return root.innerHTML;
  } catch {
    return html;
  }
}
