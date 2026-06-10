import { markdownToHtml } from "@/lib/documentMarkdown";
import { exportHtmlToDocx } from "@/lib/htmlToDocx";
import { TEMPLATE_FONTS } from "./useDocumentStyle";
import type { DocStyle } from "./types";

interface ExportOptions {
  title: string;
  docStyle: DocStyle;
  html: string;
  content: string;
}

export function exportToPDF({ title, docStyle, html, content }: ExportOptions): void {
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
  </head><body>${html || markdownToHtml(content)}</body></html>`);
  win.document.close(); win.focus(); setTimeout(() => win.print(), 500);
}

interface DocxOptions {
  docStyle: DocStyle;
  html: string;
  content: string;
  exportFileName: string;
  title: string;
  headerHtml?: string;
}

export async function exportToDocx({ docStyle, html, content, exportFileName, title, headerHtml }: DocxOptions): Promise<void> {
  const fonts = TEMPLATE_FONTS[docStyle.templateId] ?? { heading: "Inter", body: "Inter" };
  await exportHtmlToDocx({
    html: html || markdownToHtml(content),
    fileName: exportFileName,
    title,
    headingFont: fonts.heading,
    bodyFont: fonts.body,
    accentColor: docStyle.accentColor,
    headerHtml,
  });
}
