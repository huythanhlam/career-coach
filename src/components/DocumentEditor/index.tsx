/**
 * DocumentEditor — reusable rich-text editor with AI sidebar.
 * Matches the app's Mentor Mode design tokens (terracotta / cream / forest).
 */
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  Loader2, Download, Save, Bookmark,
  PanelRightClose, PanelRightOpen, Palette,
} from "lucide-react";
import { sendMessageStream } from "@/services/geminiService";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { extractDocument, DOC_START, DOC_END } from "@/lib/aiDocFormat";
import { getScopedStyles, loadGoogleFont } from "@/components/ResumeRenderer";
import { exportHtmlToDocx } from "@/lib/htmlToDocx";
import { markdownToHtml, htmlToMarkdown } from "@/lib/documentMarkdown";
import { StylePanelInline, InsertItem } from "./StylePanel";
import { EditorToolbar } from "./EditorToolbar";
import { AiSuggestionsPanel } from "./AiSuggestionsPanel";

export { markdownToHtml, htmlToMarkdown } from "@/lib/documentMarkdown";

// ─── types ─────────────────────────────────────────────────────────────────────

export interface DocMessage { role: "user" | "model"; text: string; }

export interface DocStyle {
  templateId: string;
  accentColor: string;
  accentStyle: "line" | "filled" | "minimal";
  paperBg: string;
}

export interface StoredDocumentPayload {
  version: 1;
  html: string;
  style: DocStyle;
  title?: string;
}

export interface DocumentEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  isLoading?: boolean;
  title?: string;
  onTitleChange?: (t: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiChat?: any;
  aiMessages?: DocMessage[];
  aiEnabled?: boolean;
  aiPlaceholder?: string;
  onClose?: () => void;
  onSave?: (content: string, title: string, html: string, style: DocStyle) => void;
  exportFileName?: string;
  stylePanel?: React.ReactNode;
  /** Raw HTML to load directly (bypasses markdown→html conversion). Used when reopening a saved HTML document. */
  rawHtml?: string;
  /** Style to restore when reopening a saved document. */
  initialStyle?: Partial<DocStyle>;
  /** Optional non-editable header rendered above the document body (e.g. cover letter letterhead). */
  headerHtml?: string;
  rightSidebarContent?: React.ReactNode;
  /** When provided, the editor is seeded with raw HTML on mount, bypassing the
   *  markdown → HTML conversion. Use this when you have pre-formatted HTML (e.g.
   *  from mammoth DOCX conversion) that should not be round-tripped through markdown. */
  initialHtml?: string;
  /** When true, skips template CSS injection and uses DOCX-compatible styles instead.
   *  Use together with initialHtml when displaying mammoth-converted DOCX content. */
  rawHtmlMode?: boolean;
  /** Show a "Tailor to job description" suggested prompt chip in the AI sidebar */
  showTailorPrompt?: boolean;
  /** Replace the AI sidebar with custom content (e.g. suggestion cards) */
  customSidebar?: React.ReactNode;
}

export interface DocumentEditorHandle {
  /** Finds `original` text in the editor and replaces it with `suggested`. */
  applyFix(original: string, suggested: string): void;
  /** Scrolls `text` into view within the document and briefly highlights it. */
  revealText(text: string): void;
  /** Scrolls to `text` and keeps it highlighted until called with `null` to clear. */
  setHighlight(text: string | null): void;
}

// ─── template font map ─────────────────────────────────────────────────────────

const TEMPLATE_FONTS: Record<string, { heading: string; body: string }> = {
  "modern-clean":  { heading: "Inter",            body: "Inter" },
  "tech-focused":  { heading: "JetBrains Mono",   body: "Inter" },
  "executive":     { heading: "Playfair Display",  body: "Georgia" },
  "minimal":       { heading: "Inter",             body: "Inter" },
  "academic":      { heading: "Merriweather",      body: "Georgia" },
  "creative":      { heading: "Montserrat",        body: "Lato" },
  "photography":   { heading: "Lato",              body: "Lato" },
  "slate":         { heading: "Inter",             body: "Inter" },
};

const DENSITY = { lineHeight: "1.6", fontSize: "11pt" };

let _cnt = 0;

// ─── text matching (shared with ResumeAnalysisWorkspace) ───────────────────────
//
// AI suggestions quote `originalText` verbatim from the *plain* resume text, but the
// editor stores it as HTML (markdown→HTML, with block tags, escaping, and the browser
// normalising whitespace). A naïve substring search therefore misses any quote that
// spans a line break, has collapsed whitespace, or uses smart quotes/dashes. These
// helpers walk the text nodes and match tolerantly: whitespace runs collapse to a
// single space and common typographic characters are normalised on both sides.

/** Normalise smart quotes / dashes / nbsp to their ASCII equivalents (1 char → 1 char). */
function normalizeChar(ch: string): string {
  switch (ch.charCodeAt(0)) {
    case 0x2018: case 0x2019: case 0x201a: case 0x201b: return "'";
    case 0x201c: case 0x201d: case 0x201e: case 0x201f: return '"';
    case 0x2013: case 0x2014: case 0x2212: return "-";
    case 0x00a0: case 0x2009: case 0x202f: return " ";
    default: return ch;
  }
}

function collectTextNodes(root: Element): Text[] {
  const out: Text[] = [];
  const walker = (root.ownerDocument ?? document).createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) out.push(n as Text);
  return out;
}

const BLOCK_SELECTOR = "p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,tr,div,pre,figcaption";

/** flags[i] = true when node i sits in a different block element than node i-1.
 *  Adjacent text nodes across a block boundary (e.g. </p><p>) have no whitespace
 *  between them in the DOM, yet AI quotes render that boundary as a space — so the
 *  caller injects a separator there. */
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

interface TextMatch { startNode: number; startOffset: number; endNode: number; endOffset: number; }

/** Locate `needle` across `nodes`, tolerant of whitespace runs, line breaks, block
 *  boundaries and smart quotes/dashes. Returns node-relative offsets (end exclusive),
 *  or null. `boundaries` defaults to DOM-derived block boundaries (injectable for tests). */
function locateTextNodes(nodes: Text[], needle: string, boundaries?: boolean[]): TextMatch | null {
  const flags = boundaries ?? blockBoundaryFlags(nodes);
  let hay = "";
  const map: { node: number; offset: number }[] = []; // map[i] → source location of hay[i]
  let prevSpace = false;
  for (let ni = 0; ni < nodes.length; ni++) {
    if (ni > 0 && flags[ni] && !prevSpace && hay.length) {
      hay += " "; map.push({ node: ni, offset: 0 }); prevSpace = true; // synthetic block separator
    }
    const t = nodes[ni].textContent ?? "";
    for (let oi = 0; oi < t.length; oi++) {
      const c = normalizeChar(t[oi]);
      if (/\s/.test(c)) {
        if (prevSpace) continue;           // collapse runs of whitespace
        hay += " "; map.push({ node: ni, offset: oi }); prevSpace = true;
      } else {
        hay += c; map.push({ node: ni, offset: oi }); prevSpace = false;
      }
    }
  }
  const need = needle.split("").map(normalizeChar).join("").replace(/\s+/g, " ").trim();
  if (!need) return null;
  const idx = hay.indexOf(need);
  if (idx === -1) return null;
  const start = map[idx];
  const end = map[idx + need.length - 1]; // last matched (non-space) char
  return { startNode: start.node, startOffset: start.offset, endNode: end.node, endOffset: end.offset + 1 };
}

function replaceTextNodes(nodes: Text[], m: TextMatch, suggested: string): void {
  if (m.startNode === m.endNode) {
    const t = nodes[m.startNode].textContent ?? "";
    nodes[m.startNode].textContent = t.slice(0, m.startOffset) + suggested + t.slice(m.endOffset);
    return;
  }
  nodes[m.startNode].textContent = (nodes[m.startNode].textContent ?? "").slice(0, m.startOffset) + suggested;
  for (let i = m.startNode + 1; i <= m.endNode; i++) {
    const t = nodes[i].textContent ?? "";
    nodes[i].textContent = i === m.endNode ? t.slice(m.endOffset) : "";
  }
}

function replaceInHtml(html: string, original: string, suggested: string): string {
  if (!original || !suggested || original === suggested) return html;
  // Fast paths: verbatim or HTML-entity-encoded substring.
  if (html.includes(original)) return html.replace(original, suggested);
  const encoded = original.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  if (encoded !== original && html.includes(encoded)) return html.replace(encoded, suggested);
  // Robust path: tolerant text-node walk.
  try {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild as HTMLElement;
    const nodes = collectTextNodes(root);
    const m = locateTextNodes(nodes, original);
    if (!m) return html;
    replaceTextNodes(nodes, m, suggested);
    return root.innerHTML;
  } catch { return html; }
}

/** Registered name for the CSS Custom Highlight used to mark the selected suggestion. */
const SUGGESTION_HIGHLIGHT = "de-suggestion-highlight";

// ─── component ─────────────────────────────────────────────────────────────────

export const DocumentEditor = forwardRef<DocumentEditorHandle, DocumentEditorProps>(function DocumentEditor({
  content, onChange, isLoading = false,
  title: titleProp = "Untitled document", onTitleChange,
  aiChat, aiMessages: aiMessagesProp,
  aiEnabled = true, aiPlaceholder = "Ask AI to edit, rewrite, or improve…",
  onClose, onSave, exportFileName = "document", stylePanel,
  rawHtml, initialStyle, headerHtml,
  rightSidebarContent, initialHtml, rawHtmlMode = false,
  showTailorPrompt = false, customSidebar,
}, ref) {
  const [title, setTitle] = useState(titleProp);
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved">("");
  const [showAI, setShowAI] = useState(true);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [aiMessages, setAiMessages] = useState<DocMessage[]>(aiMessagesProp ?? []);
  const [chatInput, setChatInput] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [selectedContext, setSelectedContext] = useState("");
  const [showTailorJd, setShowTailorJd] = useState(false);
  const [tailorJdInput, setTailorJdInput] = useState("");

  const [docStyle, setDocStyle] = useState<DocStyle>({
    templateId: "modern-clean",
    accentColor: "#D97757",
    accentStyle: "line",
    paperBg: "#ffffff",
    ...initialStyle,
  });

  const [currentTextColor, setCurrentTextColor] = useState("#1F1B16");
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [currentHighlightColor, setCurrentHighlightColor] = useState("transparent");
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("de_recent_colors") ?? "[]"); } catch { return []; }
  });
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const scopeId = useRef(`de-${++_cnt}`);
  const sourceRef = useRef<"external" | "user">("external");
  // Tears down the current suggestion highlight (CSS Highlight entry or inline style).
  const clearHighlightRef = useRef<(() => void) | null>(null);

  const clearHighlight = useCallback(() => {
    clearHighlightRef.current?.();
    clearHighlightRef.current = null;
  }, []);

  const revealTimerRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    applyFix: (original, suggested) => {
      if (!editorRef.current) return;
      const newHtml = replaceInHtml(editorRef.current.innerHTML, original, suggested);
      editorRef.current.innerHTML = newHtml;
      sourceRef.current = "user";
      onChange(htmlToMarkdown(newHtml));
    },
    revealText: (text) => {
      const root = editorRef.current;
      if (!root || !text) return;
      const nodes = collectTextNodes(root);
      const m = locateTextNodes(nodes, text);
      if (!m) return;
      const range = document.createRange();
      range.setStart(nodes[m.startNode], m.startOffset);
      range.setEnd(nodes[m.endNode], m.endOffset);
      (range.startContainer.parentElement ?? root).scrollIntoView({ behavior: "smooth", block: "center" });

      // Prefer the CSS Custom Highlight API — it highlights a Range without
      // mutating the editable HTML (so content/markdown round-tripping is untouched).
      const highlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
      const HighlightCtor = (globalThis as unknown as { Highlight?: new (r: Range) => unknown }).Highlight;
      if (highlights && HighlightCtor) {
        highlights.set("tailor-revise", new HighlightCtor(range));
        if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = window.setTimeout(() => highlights.delete("tailor-revise"), 2400);
      } else {
        // Fallback: select the range so it's visibly marked.
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    },
    setHighlight: (text) => {
      clearHighlight();
      const root = editorRef.current;
      if (!root || !text) return;
      const nodes = collectTextNodes(root);
      const m = locateTextNodes(nodes, text);
      if (!m) return;
      const startNode = nodes[m.startNode];
      const block = startNode.parentElement?.closest(BLOCK_SELECTOR) as HTMLElement | null;
      (block ?? startNode.parentElement)?.scrollIntoView({ behavior: "smooth", block: "center" });

      // Preferred: CSS Custom Highlight API — precise, non-destructive (no DOM mutation).
      const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
      const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
      if (HighlightCtor && registry) {
        try {
          const range = document.createRange();
          range.setStart(nodes[m.startNode], m.startOffset);
          range.setEnd(nodes[m.endNode], m.endOffset);
          registry.set(SUGGESTION_HIGHLIGHT, new HighlightCtor(range));
          clearHighlightRef.current = () => { try { registry.delete(SUGGESTION_HIGHLIGHT); } catch { /* noop */ } };
          return;
        } catch { /* fall through to inline-style fallback */ }
      }

      // Fallback: persistent terracotta background on the nearest block element.
      const el = (block ?? startNode.parentElement) as HTMLElement | null;
      if (!el) return;
      const prevBg = el.style.backgroundColor;
      const prevRadius = el.style.borderRadius;
      el.style.backgroundColor = "rgba(217,119,87,0.18)";
      el.style.borderRadius = "4px";
      clearHighlightRef.current = () => { el.style.backgroundColor = prevBg; el.style.borderRadius = prevRadius; };
    },
  }));
  const savedSelRef = useRef<Range | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear any pending reveal-highlight timer on unmount
  useEffect(() => () => { if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current); }, []);

  // Seed editor on mount — runs synchronously before paint so editorRef is guaranteed set
  const seededRef = useRef(false);
  useLayoutEffect(() => {
    if (!editorRef.current || seededRef.current) return;
    seededRef.current = true;
    if (rawHtml) {
      editorRef.current.innerHTML = rawHtml;
    } else if (initialHtml) {
      editorRef.current.innerHTML = initialHtml;
    } else if (content) {
      editorRef.current.innerHTML = markdownToHtml(content);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external content changes after mount — skip if content is empty
  // (empty content on mount would overwrite the rawHtml/initialHtml seed)
  useEffect(() => {
    if (!editorRef.current || !seededRef.current) return;
    if (sourceRef.current === "external" && content)
      editorRef.current.innerHTML = markdownToHtml(content);
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drop any active suggestion highlight when the editor unmounts.
  useEffect(() => clearHighlight, [clearHighlight]);

  useEffect(() => {
    if (!content) return;
    setSaveStatus("saving");
    const t = setTimeout(() => { setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 2000); }, 800);
    return () => clearTimeout(t);
  }, [content]);

  // Don't let the tab close while a debounced autosave may not have flushed.
  useUnsavedChangesWarning(saveStatus === "saving");

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages]);

  // Inject scoped CSS — use DOCX-compatible styles in rawHtmlMode, template styles otherwise
  useEffect(() => {
    const id = `${scopeId.current}-theme`;
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    if (rawHtmlMode) {
      const scope = `#${scopeId.current}`;
      el.textContent = `
        ${scope} { font-family: Calibri, Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1a1a1a; }
        ${scope} h1 { font-size: 18pt; font-weight: 700; margin: 0 0 6px; }
        ${scope} h2 { font-size: 12pt; font-weight: 700; margin: 16px 0 4px; border-bottom: 1px solid #d1d5db; padding-bottom: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
        ${scope} h3 { font-size: 11pt; font-weight: 700; margin: 10px 0 2px; }
        ${scope} h4 { font-size: 10.5pt; font-weight: 600; margin: 8px 0 2px; }
        ${scope} p  { margin: 2px 0 4px; }
        ${scope} ul { margin: 2px 0 6px; padding-left: 18px; }
        ${scope} li { margin: 1px 0; }
        ${scope} strong, ${scope} b { font-weight: 700; }
        ${scope} em, ${scope} i { font-style: italic; }
        ${scope} a  { color: inherit; text-decoration: underline; }
        ${scope} table { width: 100%; border-collapse: collapse; margin: 6px 0; }
        ${scope} td, ${scope} th { padding: 3px 6px; border: 1px solid #e5e7eb; }
      `;
    } else {
      const fonts = TEMPLATE_FONTS[docStyle.templateId] ?? { heading: "Inter", body: "Inter" };
      loadGoogleFont(fonts.heading);
      if (fonts.body !== fonts.heading) loadGoogleFont(fonts.body);
      el.textContent = getScopedStyles(
        scopeId.current, docStyle.templateId,
        docStyle.accentColor, docStyle.accentStyle,
        fonts.heading, fonts.body, DENSITY,
      );
    }
    // Highlight style for revealText() — registry name is global, scope the rule to this editor.
    el.textContent += `\n#${scopeId.current} ::highlight(tailor-revise) { background-color: rgba(232,185,72,0.45); color: var(--foreground); }`;
    return () => { document.getElementById(id)?.remove(); };
  }, [rawHtmlMode, docStyle.templateId, docStyle.accentColor, docStyle.accentStyle]);

  // Capture selection
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (text && editorRef.current?.contains(sel.anchorNode)) setSelectedContext(text);
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    sourceRef.current = "user";
    onChange(htmlToMarkdown(editorRef.current.innerHTML));
  }, [onChange]);

  const saveSel = useCallback(() => {
    const s = window.getSelection();
    if (s && s.rangeCount > 0) savedSelRef.current = s.getRangeAt(0).cloneRange();
  }, []);

  const restoreSel = useCallback(() => {
    if (!savedSelRef.current) return;
    const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(savedSelRef.current);
  }, []);

  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus(); restoreSel();
    document.execCommand(cmd, false, value);
    handleInput();
  }, [handleInput, restoreSel]);

  const trackColor = useCallback((color: string) => {
    setRecentColors(prev => {
      const next = [color, ...prev.filter(c => c !== color)].slice(0, 8);
      try { localStorage.setItem("de_recent_colors", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const applyTextColor = useCallback((color: string) => {
    setCurrentTextColor(color); trackColor(color);
    exec("foreColor", color); setShowTextColorPicker(false);
  }, [exec, trackColor]);

  const applyHighlightColor = useCallback((color: string) => {
    setCurrentHighlightColor(color); trackColor(color);
    exec("hiliteColor", color === "transparent" ? "transparent" : color);
    setShowHighlightPicker(false);
  }, [exec, trackColor]);

  const insertHtml = useCallback((html: string) => {
    editorRef.current?.focus(); restoreSel();
    document.execCommand("insertHTML", false, html);
    handleInput();
  }, [restoreSel, handleInput]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      insertHtml(`<img src="${ev.target?.result as string}" alt="${file.name}" style="max-width:100%;height:auto;border-radius:4px;display:block;margin:8px 0;" />`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const insertItems: InsertItem[] = [
    { label: "Image", hint: "Upload a photo or picture", action: () => fileInputRef.current?.click() },
    { label: "Contact Row", hint: "✉ 📞 🔗 📍 icon row", action: () => insertHtml(`<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:8px 0;font-size:12px;color:#666;"><span>✉ email@example.com</span><span>📞 (555) 000-0000</span><span>🔗 linkedin.com/in/you</span><span>📍 City, State</span></div><br>`) },
    { label: "Skill Badges", hint: "Row of rounded tag chips", action: () => insertHtml(`<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;"><span style="background:#f0e9dc;border:1px solid #e8dfce;border-radius:20px;padding:3px 12px;font-size:12px;color:#1f1b16;">Skill 1</span><span style="background:#f0e9dc;border:1px solid #e8dfce;border-radius:20px;padding:3px 12px;font-size:12px;color:#1f1b16;">Skill 2</span><span style="background:#f0e9dc;border:1px solid #e8dfce;border-radius:20px;padding:3px 12px;font-size:12px;color:#1f1b16;">Skill 3</span></div><br>`) },
    { label: "Decorative Divider", hint: "Ornamental separator", action: () => insertHtml(`<div style="text-align:center;margin:16px 0;color:${docStyle.accentColor};letter-spacing:8px;font-size:14px;">✦ ✦ ✦</div>`) },
    { label: "Horizontal Rule", hint: "Plain section separator", action: () => exec("insertHorizontalRule") },
  ];

  const handleAiSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = chatInput.trim();
    if (!text || !aiChat || isAiGenerating) return;
    const ctx = selectedContext ? `\n\nHighlighted text:\n"""\n${selectedContext}\n"""` : "";
    const prompt = `User request: ${text}${ctx}\n\nFull document:\n\n${content}\n\nApply the request and return the COMPLETE updated document (preserve everything you are not explicitly changing), wrapped between ${DOC_START} and ${DOC_END} markers.`;
    setChatInput(""); setSelectedContext(""); setIsAiGenerating(true);
    setAiMessages(prev => [...prev,
      { role: "user", text: selectedContext ? `${text}\n\n*Context: "${selectedContext.slice(0, 80)}…"*` : text },
      { role: "model", text: "" },
    ]);
    try {
      let full = "";
      await sendMessageStream(aiChat, prompt, chunk => {
        full += chunk;
        setAiMessages(prev => { const m = [...prev]; m[m.length - 1] = { role: "model", text: full }; return m; });
        const body = extractDocument(full);
        if (body) { sourceRef.current = "external"; onChange(body); }
      });
    } catch (err) {
      console.error(err);
      setAiMessages(prev => { const m = [...prev]; m[m.length - 1].text += "\n\n**Error:** Could not reach AI."; return m; });
    } finally { setIsAiGenerating(false); }
  };

  const exportPDF = () => {
    const fonts = TEMPLATE_FONTS[docStyle.templateId] ?? { heading: "Inter", body: "Inter" };
    const win = window.open("", "_blank");
    if (!win) { window.print(); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none';">
      <title>${title}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonts.heading)}:wght@400;500;600;700&family=${encodeURIComponent(fonts.body)}:wght@400;500;700&display=swap">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:"${fonts.body}",Arial,sans-serif;font-size:11pt;line-height:1.6;color:#1a1a1a;padding:40px 50px;max-width:800px;margin:0 auto;background:${docStyle.paperBg};}
        h1,h2,h3{font-family:"${fonts.heading}",sans-serif;color:${docStyle.accentColor};}
        h1{font-size:22pt;font-weight:700;margin:0 0 8px;}
        h2{font-size:14pt;font-weight:700;margin:20px 0 6px;border-bottom:2px solid ${docStyle.accentColor}55;padding-bottom:4px;}
        h3{font-size:12pt;font-weight:600;margin:14px 0 4px;}
        p{margin-bottom:6px;}ul,ol{margin:4px 0 8px 20px;}li{margin-bottom:2px;}
        hr{border:none;border-top:1px solid ${docStyle.accentColor}44;margin:16px 0;}
        a{color:${docStyle.accentColor};}img{max-width:100%;height:auto;}
        @media print{body{padding:20px 30px;}}
      </style>
    </head><body>${editorRef.current?.innerHTML ?? markdownToHtml(content)}</body></html>`);
    win.document.close(); win.focus(); setTimeout(() => win.print(), 500);
  };

  const exportDocx = async () => {
    const fonts = TEMPLATE_FONTS[docStyle.templateId] ?? { heading: "Inter", body: "Inter" };
    await exportHtmlToDocx({
      html: editorRef.current?.innerHTML ?? markdownToHtml(content),
      fileName: exportFileName,
      title,
      headingFont: fonts.heading,
      bodyFont: fonts.body,
      accentColor: docStyle.accentColor,
      headerHtml,
    });
  };

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full" style={{ background: "var(--background)", fontFamily: "var(--font-sans, Inter, sans-serif)" }}>

      {/* Title bar */}
      <div className="flex items-center gap-3 px-5 shrink-0 print:hidden"
        style={{ height: 54, background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(217,119,87,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
            <path d="M1 0h9l5 5v13H1V0z" fill="var(--primary)" fillOpacity=".15" />
            <path d="M10 0l5 5h-5V0z" fill="var(--primary)" fillOpacity=".3" />
            <rect x="3" y="8" width="9" height="1.2" rx=".6" fill="var(--primary)" />
            <rect x="3" y="11" width="9" height="1.2" rx=".6" fill="var(--primary)" />
            <rect x="3" y="14" width="6" height="1.2" rx=".6" fill="var(--primary)" />
          </svg>
        </div>
        <span ref={titleRef} contentEditable suppressContentEditableWarning
          onBlur={() => { const t = titleRef.current?.textContent?.trim() || "Untitled document"; setTitle(t); onTitleChange?.(t); if (titleRef.current) titleRef.current.style.background = "transparent"; }}
          onFocus={() => { if (titleRef.current) titleRef.current.style.background = "var(--muted)"; }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); titleRef.current?.blur(); } }}
          style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", outline: "none", minWidth: 60, maxWidth: 360, cursor: "text", padding: "3px 6px", borderRadius: 6, transition: "background 0.1s" }}>
          {title}
        </span>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {saveStatus === "saving" && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> Saving…</span>}
          {saveStatus === "saved" && <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--forest)" }}><Save style={{ width: 11, height: 11 }} /> Saved</span>}
        </div>
        <div style={{ flex: 1 }} />
        <div className="flex items-center gap-2">
          <button onClick={() => setShowStylePanel(v => !v)} title={showStylePanel ? "Hide style" : "Style"}
            style={{ width: 32, height: 32, borderRadius: 8, background: showStylePanel ? "rgba(217,119,87,0.10)" : "transparent", border: showStylePanel ? "1px solid rgba(217,119,87,0.25)" : "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: showStylePanel ? "var(--primary)" : "var(--muted-foreground)", transition: "all 0.15s" }}>
            <Palette style={{ width: 14, height: 14 }} />
          </button>
          {onSave && (
            <button onClick={() => onSave(content, title, editorRef.current?.innerHTML ?? markdownToHtml(content), docStyle)}
              style={{ height: 32, padding: "0 14px", background: "var(--primary)", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 5 }}>
              <Bookmark style={{ width: 13, height: 13 }} /> Save
            </button>
          )}
          <button onClick={exportDocx}
            style={{ height: 32, padding: "0 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 5 }}>
            <Download style={{ width: 13, height: 13 }} /> DOCX
          </button>
          <button onClick={exportPDF}
            style={{ height: 32, padding: "0 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 5 }}>
            <Download style={{ width: 13, height: 13 }} /> PDF
          </button>
          {aiEnabled && (
            <button onClick={() => setShowAI(v => !v)} title={showAI ? "Hide AI" : "Show AI"}
              style={{ width: 32, height: 32, borderRadius: 8, background: showAI ? "rgba(217,119,87,0.10)" : "transparent", border: showAI ? "1px solid rgba(217,119,87,0.25)" : "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: showAI ? "var(--primary)" : "var(--muted-foreground)", transition: "all 0.15s" }}>
              {showAI ? <PanelRightClose style={{ width: 14, height: 14 }} /> : <PanelRightOpen style={{ width: 14, height: 14 }} />}
            </button>
          )}
          {onClose && (
            <button onClick={onClose}
              style={{ height: 32, padding: "0 12px", background: "transparent", border: "none", fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer", color: "var(--muted-foreground)" }}>
              Exit
            </button>
          )}
        </div>
      </div>

      {/* Formatting toolbar */}
      <EditorToolbar
        exec={exec}
        saveSel={saveSel}
        insertHtml={insertHtml}
        insertItems={insertItems}
        currentTextColor={currentTextColor}
        showTextColorPicker={showTextColorPicker}
        setShowTextColorPicker={setShowTextColorPicker}
        applyTextColor={applyTextColor}
        currentHighlightColor={currentHighlightColor}
        showHighlightPicker={showHighlightPicker}
        setShowHighlightPicker={setShowHighlightPicker}
        applyHighlightColor={applyHighlightColor}
        recentColors={recentColors}
        showIconPicker={showIconPicker}
        setShowIconPicker={setShowIconPicker}
        showInsertMenu={showInsertMenu}
        setShowInsertMenu={setShowInsertMenu}
      />

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Style panel (left) */}
        {showStylePanel && (
          <StylePanelInline
            style={docStyle}
            onChange={patch => setDocStyle(prev => ({ ...prev, ...patch }))}
            extraPanel={stylePanel}
            onClose={() => setShowStylePanel(false)}
          />
        )}

        {/* Document canvas */}
        <div className="flex-1 overflow-y-auto" style={{ background: "var(--muted)" }}>
          <div style={{ padding: "32px 0 80px", display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 816, minHeight: 1056, background: docStyle.paperBg, boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px var(--border)", padding: "72px 96px" }}>
              {headerHtml && (
                <div
                  dangerouslySetInnerHTML={{ __html: headerHtml }}
                  style={{ marginBottom: 20, userSelect: "text", pointerEvents: "none" }}
                />
              )}
              {isLoading && !content ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, color: "var(--muted-foreground)", gap: 12 }}>
                  <Loader2 style={{ width: 32, height: 32, color: "var(--primary)" }} className="animate-spin" />
                  <span style={{ fontSize: 14 }}>Generating…</span>
                </div>
              ) : (
                <div
                  id={scopeId.current}
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onBlur={saveSel}
                  className={rawHtmlMode
                    ? "outline-none"
                    : "outline-none prose max-w-none prose-headings:font-semibold prose-h1:text-4xl prose-h1:mb-3 prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2 prose-p:my-2 prose-p:leading-relaxed prose-ul:my-3 prose-li:my-1"
                  }
                  style={rawHtmlMode
                    ? { minHeight: 900, caretColor: "var(--primary)" }
                    : { minHeight: 900, color: "var(--foreground)", fontSize: 11, lineHeight: 1.65, caretColor: "var(--primary)" }
                  }
                  data-placeholder="Start typing or ask the AI assistant to generate content…"
                />
              )}
            </div>
          </div>
        </div>

        {/* Analysis/custom sidebar (overrides AI chat when provided) */}
        {(rightSidebarContent ?? customSidebar) && (
          <div className="flex flex-col shrink-0 print:hidden overflow-hidden"
            style={{ width: 380, background: "var(--card)", borderLeft: "1px solid var(--border)" }}>
            {rightSidebarContent ?? customSidebar}
          </div>
        )}

        {/* AI sidebar */}
        {!rightSidebarContent && !customSidebar && aiEnabled && showAI && (
          <AiSuggestionsPanel
            aiMessages={aiMessages}
            isAiGenerating={isAiGenerating}
            chatInput={chatInput}
            setChatInput={setChatInput}
            selectedContext={selectedContext}
            setSelectedContext={setSelectedContext}
            aiPlaceholder={aiPlaceholder}
            aiChat={aiChat}
            showTailorPrompt={showTailorPrompt}
            showTailorJd={showTailorJd}
            setShowTailorJd={setShowTailorJd}
            tailorJdInput={tailorJdInput}
            setTailorJdInput={setTailorJdInput}
            scrollRef={scrollRef}
            handleAiSubmit={handleAiSubmit}
          />
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />

      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: var(--muted-foreground);
          opacity: 0.5;
          pointer-events: none;
        }
        ::highlight(${SUGGESTION_HIGHLIGHT}) {
          background-color: rgba(217,119,87,0.28);
          color: inherit;
        }
      `}</style>
    </div>
  );
});
