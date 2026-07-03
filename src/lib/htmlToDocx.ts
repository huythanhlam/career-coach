/**
 * htmlToDocx — converts editor HTML into a real .docx file (docx-js) and downloads it.
 *
 * Follows the document-skills:docx rules: explicit US Letter page size, heading style
 * overrides, real bullet/number numbering (never literal "•"), DXA widths. Runs entirely
 * in the browser via Packer.toBlob(); no server needed.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  LevelFormat,
  AlignmentType,
  ExternalHyperlink,
  ImageRun,
  BorderStyle,
} from "docx";

export interface DocxExportOptions {
  /** Editor innerHTML (document body content). */
  html: string;
  /** File name without extension. */
  fileName: string;
  title?: string;
  /** Heading font, e.g. from TEMPLATE_FONTS[templateId].heading. */
  headingFont?: string;
  /** Body font, e.g. from TEMPLATE_FONTS[templateId].body. */
  bodyFont?: string;
  /** Accent color as hex ("#2F6B4F" or "2F6B4F"); applied to headings. */
  accentColor?: string;
  /** Optional leading content (e.g. cover-letter letterhead) rendered before the body. */
  headerHtml?: string;
}

type InlineFlags = { bold?: boolean; italics?: boolean; code?: boolean; link?: boolean };

type InlineChild = TextRun | ExternalHyperlink | ImageRun;

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "hr",
  "table",
  "header",
  "footer",
  "article",
  "blockquote",
]);

function normalizeHex(hex?: string): string | undefined {
  if (!hex) return undefined;
  const h = hex.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(h) ? h.toUpperCase() : undefined;
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function imageRunFromEl(el: Element): ImageRun | null {
  try {
    const src = el.getAttribute("src") ?? "";
    const m = src.match(/^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i);
    if (!m) return null; // skip remote/unsupported images so export never throws
    const ext = m[1].toLowerCase();
    const type = (ext === "jpeg" ? "jpg" : ext) as "png" | "jpg" | "gif" | "bmp";
    const data = base64ToUint8(m[2]);
    const width = parseInt(el.getAttribute("width") ?? "", 10) || 220;
    const height = parseInt(el.getAttribute("height") ?? "", 10) || 220;
    return new ImageRun({
      type,
      data,
      transformation: { width, height },
      altText: { title: "Image", description: "Embedded image", name: "Image" },
    });
  } catch {
    return null;
  }
}

/** Collect inline runs (text, links, images) from an element's descendants. */
function collectInline(node: Node, flags: InlineFlags): InlineChild[] {
  const runs: InlineChild[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (text) {
        runs.push(
          new TextRun({
            text,
            bold: flags.bold,
            italics: flags.italics,
            font: flags.code ? "Courier New" : undefined,
            style: flags.link ? "Hyperlink" : undefined,
          }),
        );
      }
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case "strong":
      case "b":
        runs.push(...collectInline(el, { ...flags, bold: true }));
        break;
      case "em":
      case "i":
        runs.push(...collectInline(el, { ...flags, italics: true }));
        break;
      case "code":
        runs.push(...collectInline(el, { ...flags, code: true }));
        break;
      case "br":
        runs.push(new TextRun({ break: 1 }));
        break;
      case "img": {
        const img = imageRunFromEl(el);
        if (img) runs.push(img);
        break;
      }
      case "a": {
        const href = (el.getAttribute("href") ?? "").trim();
        const children = collectInline(el, { ...flags, link: true });
        if (href && href !== "#" && /^(https?:|mailto:|tel:)/i.test(href)) {
          runs.push(new ExternalHyperlink({ link: href, children: children as TextRun[] }));
        } else {
          runs.push(...collectInline(el, flags));
        }
        break;
      }
      default:
        runs.push(...collectInline(el, flags));
    }
  });
  return runs;
}

function hasBlockChildren(el: Element): boolean {
  return Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName.toLowerCase()));
}

function paragraphFromInline(el: Element): Paragraph[] {
  const children = collectInline(el, {});
  if (children.length === 0) return [];
  return [new Paragraph({ children })];
}

const HR_PARAGRAPH = () =>
  new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 } },
    children: [],
  });

/** Walk block-level nodes into docx Paragraphs. */
function walkBlocks(root: Node): Paragraph[] {
  const paras: Paragraph[] = [];
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) paras.push(new Paragraph({ children: [new TextRun(text)] }));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    switch (tag) {
      case "h1":
        paras.push(
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: collectInline(el, {}) }),
        );
        break;
      case "h2":
        paras.push(
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: collectInline(el, {}) }),
        );
        break;
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        paras.push(
          new Paragraph({ heading: HeadingLevel.HEADING_3, children: collectInline(el, {}) }),
        );
        break;
      case "ul":
      case "ol": {
        const ref = tag === "ul" ? "bullets" : "numbers";
        Array.from(el.children)
          .filter((c) => c.tagName.toLowerCase() === "li")
          .forEach((li) => {
            paras.push(
              new Paragraph({
                numbering: { reference: ref, level: 0 },
                children: collectInline(li, {}),
              }),
            );
          });
        break;
      }
      case "hr":
        paras.push(HR_PARAGRAPH());
        break;
      case "br":
        paras.push(new Paragraph({ children: [] }));
        break;
      case "img": {
        const img = imageRunFromEl(el);
        if (img) paras.push(new Paragraph({ children: [img] }));
        break;
      }
      case "p":
        paras.push(
          ...(paragraphFromInline(el).length
            ? paragraphFromInline(el)
            : [new Paragraph({ children: [] })]),
        );
        break;
      case "table": {
        // Flatten table cells to paragraphs (resumes/letters rarely need real tables in export).
        el.querySelectorAll("td, th").forEach((cell) =>
          paras.push(...paragraphFromInline(cell as Element)),
        );
        break;
      }
      default:
        if (hasBlockChildren(el)) paras.push(...walkBlocks(el));
        else paras.push(...paragraphFromInline(el));
    }
  });
  return paras;
}

function htmlToParagraphs(html: string): Paragraph[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return walkBlocks(doc.body);
}

export async function exportHtmlToDocx(opts: DocxExportOptions): Promise<void> {
  const bodyFont = opts.bodyFont || "Arial";
  const headingFont = opts.headingFont || bodyFont;
  const accent = normalizeHex(opts.accentColor) ?? "1A1A1A";

  const children: Paragraph[] = [];
  if (opts.headerHtml) children.push(...htmlToParagraphs(opts.headerHtml));
  children.push(...htmlToParagraphs(opts.html));
  if (children.length === 0) children.push(new Paragraph({ children: [] }));

  const doc = new Document({
    creator: "Career Coach",
    title: opts.title,
    styles: {
      default: { document: { run: { font: bodyFont, size: 22 } } }, // 11pt
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 40, bold: true, font: headingFont, color: accent },
          paragraph: { spacing: { before: 120, after: 120 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, bold: true, font: headingFont, color: accent },
          paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, font: headingFont, color: accent },
          paragraph: { spacing: { before: 160, after: 60 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: "numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 }, // US Letter
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${opts.fileName}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
