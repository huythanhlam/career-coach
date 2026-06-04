/**
 * documentParserService — unified file-to-HTML/text parsing for the document editor.
 *
 * Supports: PDF, DOCX, TXT
 *
 * Two parse modes:
 *   parseDocumentToHtml  — returns styled HTML for the rich editor (preserves formatting)
 *   parseDocumentToText  — returns plain text for AI analysis / profile extraction
 *
 * DOCX HTML conversion uses a two-pass approach:
 *   Pass 1: mammoth.convertToHtml() — semantic structure (headings, lists, bold/italic, tables)
 *   Pass 2: JSZip + DOMParser on word/document.xml — extracts colors, fonts, backgrounds
 *   Merge:  inline styles applied to mammoth HTML nodes
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedFileType = "pdf" | "docx" | "txt" | "unknown";

export interface ParseResult {
  html: string;
  text: string;
  fileType: SupportedFileType;
}

interface RunFormat {
  color?: string;      // 6-char hex, e.g. "FF0000"
  bgColor?: string;    // 6-char hex for paragraph/cell background
  fontFamily?: string;
  fontSize?: string;   // e.g. "12pt"
}

// ─── File type detection ───────────────────────────────────────────────────────

export function detectFileType(file: File): SupportedFileType {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  )
    return "docx";
  if (mime === "text/plain" || name.endsWith(".txt")) return "txt";

  return "unknown";
}

export function isSupportedFile(file: File): boolean {
  return detectFileType(file) !== "unknown";
}

// ─── Validation ────────────────────────────────────────────────────────────────

function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File is too large. Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`);
  }
  if (detectFileType(file) === "unknown") {
    throw new Error(
      "Unsupported file type. Please upload a PDF, DOCX, or TXT file."
    );
  }
}

// ─── DOCX XML formatting extraction ───────────────────────────────────────────

/**
 * Open the DOCX zip and parse word/document.xml to extract per-paragraph and
 * per-run formatting (colors, fonts, backgrounds) that mammoth discards.
 *
 * Returns an ordered list of paragraph-level records, each containing:
 *   - bgColor: paragraph shading fill
 *   - runs: ordered list of { text, color, fontFamily, fontSize }
 */
async function extractDocxFormatting(
  arrayBuffer: ArrayBuffer
): Promise<Array<{ bgColor?: string; runs: Array<{ text: string } & RunFormat> }>> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(arrayBuffer);

  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) return [];

  const docXml = await docXmlFile.async("string");
  const xmlDoc = new DOMParser().parseFromString(docXml, "application/xml");

  const NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const q = (el: Element, tag: string) =>
    Array.from(el.getElementsByTagNameNS(NS, tag));
  const attr = (el: Element | null, ns: string, name: string) =>
    el?.getAttributeNS(ns, name) ?? el?.getAttribute(`w:${name}`) ?? undefined;

  const paragraphs = q(xmlDoc.documentElement, "p");
  const result: Array<{ bgColor?: string; runs: Array<{ text: string } & RunFormat> }> = [];

  for (const p of paragraphs) {
    // Paragraph-level background from w:pPr/w:shd
    const pPr = q(p, "pPr")[0] ?? null;
    const pShd = pPr ? q(pPr, "shd")[0] ?? null : null;
    const bgFill = pShd ? (attr(pShd, NS, "fill") ?? attr(pShd, "", "fill")) : undefined;
    const bgColor =
      bgFill && bgFill !== "auto" && bgFill !== "none" && bgFill.length === 6
        ? bgFill
        : undefined;

    // Collect runs
    const runs: Array<{ text: string } & RunFormat> = [];
    for (const r of q(p, "r")) {
      // Text content — join all w:t children
      const textNodes = q(r, "t");
      const text = textNodes.map((t) => t.textContent ?? "").join("");
      if (!text.trim()) continue;

      const rPr = q(r, "rPr")[0] ?? null;

      // Text color
      const colorEl = rPr ? q(rPr, "color")[0] ?? null : null;
      const colorVal = colorEl
        ? (attr(colorEl, NS, "val") ?? attr(colorEl, "", "val"))
        : undefined;
      const color =
        colorVal && colorVal !== "auto" && colorVal.length === 6
          ? colorVal
          : undefined;

      // Font family
      const rFonts = rPr ? q(rPr, "rFonts")[0] ?? null : null;
      const fontFamily =
        rFonts
          ? (attr(rFonts, NS, "ascii") ??
             attr(rFonts, "", "ascii") ??
             attr(rFonts, NS, "hAnsi") ??
             attr(rFonts, "", "hAnsi"))
          : undefined;

      // Font size (w:sz is in half-points)
      const szEl = rPr ? q(rPr, "sz")[0] ?? null : null;
      const szVal = szEl ? (attr(szEl, NS, "val") ?? attr(szEl, "", "val")) : undefined;
      const fontSize = szVal ? `${Math.round(parseInt(szVal, 10) / 2)}pt` : undefined;

      runs.push({ text, color, fontFamily, fontSize });
    }

    result.push({ bgColor, runs });
  }

  return result;
}

/**
 * Apply formatting extracted from DOCX XML to the mammoth HTML output.
 * Matches paragraphs by order, then matches runs by text content.
 */
function applyFormattingToHtml(
  mammothHtml: string,
  docxFormatting: Array<{ bgColor?: string; runs: Array<{ text: string } & RunFormat> }>
): string {
  const doc = new DOMParser().parseFromString(mammothHtml, "text/html");

  // Gather block elements that correspond to paragraphs
  const blocks = Array.from(
    doc.body.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, td, th")
  );

  let fmtIdx = 0;
  for (const block of blocks) {
    if (fmtIdx >= docxFormatting.length) break;
    const fmt = docxFormatting[fmtIdx++];

    // Apply paragraph background
    if (fmt.bgColor) {
      const existing = block.getAttribute("style") ?? "";
      block.setAttribute(
        "style",
        `${existing}${existing ? ";" : ""}background-color:#${fmt.bgColor};`
      );
    }

    if (!fmt.runs.length) continue;

    // For runs: walk text nodes in the block and wrap matching text in <span> with styles
    const runQueue = [...fmt.runs];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let node: Text | null;

    // eslint-disable-next-line no-cond-assign
    while ((node = walker.nextNode() as Text | null)) {
      const nodeText = node.textContent ?? "";
      if (!nodeText.trim()) continue;

      // Find a run whose text overlaps this text node
      const match = runQueue.find(
        (r) => nodeText.includes(r.text) || r.text.includes(nodeText.trim())
      );
      if (!match) continue;

      const styles: string[] = [];
      if (match.color) styles.push(`color:#${match.color}`);
      if (match.fontFamily) styles.push(`font-family:${match.fontFamily},sans-serif`);
      if (match.fontSize) styles.push(`font-size:${match.fontSize}`);

      if (styles.length && node.parentElement) {
        const span = doc.createElement("span");
        span.style.cssText = styles.join(";");
        node.parentNode!.replaceChild(span, node);
        span.appendChild(node);
      }
    }
  }

  return doc.body.innerHTML;
}

// ─── DOCX parser (styled) ─────────────────────────────────────────────────────

async function parseDocxToStyledHtml(file: File): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const buf = await file.arrayBuffer();

  // Pass 1: mammoth semantic HTML
  const { value: mammothHtml } = await mammoth.convertToHtml({ arrayBuffer: buf });

  // Pass 2: extract formatting from DOCX XML
  let formatting: Awaited<ReturnType<typeof extractDocxFormatting>> = [];
  try {
    formatting = await extractDocxFormatting(buf);
  } catch {
    // If XML extraction fails, return mammoth HTML as-is
    return mammothHtml;
  }

  // Merge
  return applyFormattingToHtml(mammothHtml, formatting);
}

async function parseWordToText(file: File): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  return value;
}

// ─── PDF parser ────────────────────────────────────────────────────────────────

async function parsePdfToHtml(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc =
      `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const pageChunks: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (tc.items as any[]).filter((it) => it.str?.trim());
    if (!items.length) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sz = (it: any) =>
      Math.sqrt(it.transform[0] ** 2 + it.transform[1] ** 2) || it.height || 10;
    const sizes = items.map(sz);
    const medianSz =
      [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)];
    const Y_TOL = medianSz * 0.6;

    type XItem = { x: number; w: number; str: string; sz: number };
    type Line = { y: number; xs: XItem[] };
    const lines: Line[] = [];

    for (const it of items) {
      const y = it.transform[5];
      let line = lines.find((l) => Math.abs(l.y - y) < Y_TOL);
      if (!line) { line = { y, xs: [] }; lines.push(line); }
      line.xs.push({ x: it.transform[4], w: it.width ?? 0, str: it.str, sz: sz(it) });
    }

    lines.sort((a, b) => b.y - a.y);
    const lineHtmls: string[] = [];

    for (const line of lines) {
      line.xs.sort((a, b) => a.x - b.x);
      let text = "";
      for (let i = 0; i < line.xs.length; i++) {
        const it = line.xs[i];
        if (i > 0) {
          const prev = line.xs[i - 1];
          if (it.x - (prev.x + prev.w) > it.sz * 0.3) text += " ";
        }
        text += it.str;
      }
      text = text.trim();
      if (!text) continue;

      const lineSz = line.xs[0].sz;
      if (lineSz > medianSz * 1.9) {
        lineHtmls.push(`<h1>${esc(text)}</h1>`);
      } else if (lineSz > medianSz * 1.3) {
        lineHtmls.push(`<h2>${esc(text)}</h2>`);
      } else if (
        text.length >= 3 &&
        text === text.toUpperCase() &&
        /[A-Z]/.test(text) &&
        !/\b\d{4}\b/.test(text)
      ) {
        lineHtmls.push(`<h2>${esc(text)}</h2>`);
      } else if (/^[•·▪▸●○\-–—]\s+/.test(text)) {
        lineHtmls.push(`<li>${esc(text.replace(/^[•·▪▸●○\-–—]\s+/, ""))}</li>`);
      } else {
        lineHtmls.push(`<p>${esc(text)}</p>`);
      }
    }
    pageChunks.push(lineHtmls.join("\n"));
  }

  let html = pageChunks.join("\n");
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  return html;
}

async function parsePdfToText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc =
      `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, (_, i) =>
      pdf
        .getPage(i + 1)
        .then((p) => p.getTextContent())
        .then((c) =>
          c.items.map((item) => ("str" in item ? item.str : "")).join(" ")
        )
    )
  );
  return pages.join("\n");
}

// ─── TXT parser ───────────────────────────────────────────────────────────────

async function parseTxtToHtml(file: File): Promise<string> {
  const text = await file.text();
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = text.split(/\r?\n/);
  const htmlParts: string[] = [];
  const pendingListItems: string[] = [];

  const flushList = () => {
    if (pendingListItems.length) {
      htmlParts.push(`<ul>${pendingListItems.join("")}</ul>`);
      pendingListItems.length = 0;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      htmlParts.push("<br>");
      continue;
    }
    if (/^[•·▪▸●○\-–—]\s+/.test(line)) {
      pendingListItems.push(
        `<li>${esc(line.replace(/^[•·▪▸●○\-–—]\s+/, "").trim())}</li>`
      );
    } else {
      flushList();
      htmlParts.push(`<p>${esc(line)}</p>`);
    }
  }
  flushList();

  return htmlParts.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a document file to styled HTML for use in DocumentEditor via
 * `initialHtml` + `rawHtmlMode`.
 *
 * DOCX: two-pass (mammoth structure + JSZip color/font extraction)
 * PDF:  pdfjs-dist with heading/list detection
 * TXT:  plain text wrapped in semantic HTML
 */
export async function parseDocumentToHtml(file: File): Promise<string> {
  validateFile(file);
  const type = detectFileType(file);

  switch (type) {
    case "pdf":
      return parsePdfToHtml(file);
    case "docx":
      return parseDocxToStyledHtml(file);
    case "txt":
      return parseTxtToHtml(file);
    default:
      throw new Error("Unsupported file type.");
  }
}

/**
 * Parse a document file to plain text for AI analysis / profile extraction.
 */
export async function parseDocumentToText(file: File): Promise<string> {
  validateFile(file);
  const type = detectFileType(file);

  switch (type) {
    case "pdf":
      return parsePdfToText(file);
    case "docx":
      return parseWordToText(file);
    case "txt":
      return file.text();
    default:
      throw new Error("Unsupported file type.");
  }
}

/**
 * Parse a document to both HTML (editor) and plain text (AI) simultaneously.
 */
export async function parseDocument(file: File): Promise<ParseResult> {
  validateFile(file);
  const fileType = detectFileType(file);

  const [html, text] = await Promise.all([
    parseDocumentToHtml(file),
    parseDocumentToText(file),
  ]);

  return { html, text, fileType };
}
