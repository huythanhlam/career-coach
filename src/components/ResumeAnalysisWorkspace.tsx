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
import { parseDocumentToHtml, detectFileType } from "@/services/documentParserService";

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
  const fileType = detectFileType(file);
  const needsConversion = fileType === "pdf" || fileType === "docx";

  const workspaceRef = useRef<ResumeGeneratorWorkspaceHandle>(null);

  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(needsConversion);

  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [selectedImpId, setSelectedImpId] = useState<string | null>(null);

  // Convert file to editable HTML on mount
  useEffect(() => {
    if (!needsConversion) return;
    let cancelled = false;
    (async () => {
      try {
        const h = await parseDocumentToHtml(file);
        if (!cancelled) setHtml(h);
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
