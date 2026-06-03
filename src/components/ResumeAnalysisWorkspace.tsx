/**
 * ResumeAnalysisWorkspace
 *
 * Single-view: editable resume on the left (DocumentEditor with DOCX-compatible
 * styles) + analysis panel on the right (score + improvement cards).
 *
 * File conversion on mount:
 *   PDF  → pdfjs-dist getTextContent() reconstructs headings / bullets / paragraphs
 *   DOCX → mammoth.convertToHtml() preserves bold / italic / lists
 *   TXT  → plain text seeded directly
 *
 * Apply Fix:
 *   Calls DocumentEditor.applyFix() imperatively (no re-mount, cursor preserved),
 *   which uses a 3-pass text search: verbatim → HTML-entity → DOMParser text-nodes.
 *   Score updates instantly based on priority of applied fixes.
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { AnalysisPanel } from "@/components/ResumeGeneratorWorkspace";
import { ResumeGeneratorWorkspace, ResumeGeneratorWorkspaceHandle } from "@/components/ResumeGeneratorWorkspace";
import type { ResumeAnalysisResult, Improvement } from "@/services/geminiService";

// ─── PDF → HTML conversion ────────────────────────────────────────────────────

async function pdfToHtml(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc)
    pdfjs.GlobalWorkerOptions.workerSrc =
      `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const pageChunks: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (tc.items as any[]).filter(it => it.str?.trim());
    if (!items.length) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sz = (it: any) =>
      Math.sqrt(it.transform[0] ** 2 + it.transform[1] ** 2) || it.height || 10;
    const sizes = items.map(sz);
    const medianSz = [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)];
    const Y_TOL = medianSz * 0.6;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type XItem = { x: number; w: number; str: string; sz: number };
    type Line  = { y: number; xs: XItem[] };
    const lines: Line[] = [];

    for (const it of items) {
      const y = it.transform[5];
      let line = lines.find(l => Math.abs(l.y - y) < Y_TOL);
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
      if (lineSz > medianSz * 1.3) {
        lineHtmls.push(`<${lineSz > medianSz * 1.9 ? "h1" : "h2"}>${esc(text)}</${lineSz > medianSz * 1.9 ? "h1" : "h2"}>`);
      } else if (text.length >= 3 && text === text.toUpperCase() && /[A-Z]/.test(text) && !/\b\d{4}\b/.test(text)) {
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
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  return html;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResumeAnalysisWorkspaceProps {
  file: File;
  fileObjectUrl: string;
  resumeText: string;
  analysisResult: ResumeAnalysisResult | null;
  isAnalyzing: boolean;
  onReset: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ResumeAnalysisWorkspace({
  file,
  resumeText,
  analysisResult,
  isAnalyzing,
  onReset,
}: ResumeAnalysisWorkspaceProps) {
  const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
  const isDocx =
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".docx");

  const workspaceRef = useRef<ResumeGeneratorWorkspaceHandle>(null);

  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(isPdf || isDocx);

  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [selectedImpId, setSelectedImpId] = useState<string | null>(null);

  // Convert file to editable HTML on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isPdf) {
          const h = await pdfToHtml(file);
          if (!cancelled) setHtml(h);
        } else if (isDocx) {
          const mammoth = (await import("mammoth")).default;
          const buf = await file.arrayBuffer();
          const { value: h } = await mammoth.convertToHtml({ arrayBuffer: buf });
          if (!cancelled) setHtml(h);
        }
      } catch {
        // fall back to plain text
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = useCallback((imp: Improvement) => {
    if (appliedIds.has(imp.id)) return;
    workspaceRef.current?.applyFix(imp.originalText, imp.suggestedText);
    setAppliedIds(prev => new Set(prev).add(imp.id));
    if (selectedImpId === imp.id) setSelectedImpId(null);
  }, [appliedIds, selectedImpId]);

  const analysisPanel = (
    <AnalysisPanel
      result={analysisResult}
      isAnalyzing={isAnalyzing}
      appliedIds={appliedIds}
      selectedImpId={selectedImpId}
      onSelect={id => setSelectedImpId(prev => prev === id ? null : id)}
      onApply={handleApply}
    />
  );

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--muted-foreground)", fontSize: 13, background: "var(--muted)" }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} />
        Preparing your resume…
      </div>
    );
  }

  return (
    <ResumeGeneratorWorkspace
      ref={workspaceRef}
      initialResumeText={html ? "" : resumeText}
      initialHtml={html ?? undefined}
      rawHtmlMode={!!html}
      rightSidebarContent={analysisPanel}
      onReset={onReset}
    />
  );
}
