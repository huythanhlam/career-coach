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
import { AnalysisPanel, type SuggestionStatus } from "@/components/ResumeGeneratorWorkspace";
import {
  ResumeGeneratorWorkspace,
  ResumeGeneratorWorkspaceHandle,
} from "@/components/ResumeGeneratorWorkspace";
import type { ResumeAnalysisResult, Improvement } from "@/services/geminiService";

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
  const workspaceRef = useRef<ResumeGeneratorWorkspaceHandle>(null);

  const [html] = useState<string | null>(null);
  const [loading] = useState(false);

  const [statuses, setStatuses] = useState<Record<string, SuggestionStatus>>({});
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [selectedImpId, setSelectedImpId] = useState<string | null>(null);

  const statusOf = useCallback(
    (id: string): SuggestionStatus => statuses[id] ?? "pending",
    [statuses],
  );

  // applyFix rewrites the editor DOM, invalidating any active highlight range — re-apply
  // the highlight to whichever suggestion is still selected (no-op when none is).
  const reapplyHighlight = useCallback(() => {
    const imp = selectedImpId
      ? analysisResult?.improvements.find((i) => i.id === selectedImpId)
      : null;
    workspaceRef.current?.setHighlight(imp?.originalText ?? null);
  }, [selectedImpId, analysisResult]);

  const handleApply = useCallback(
    (imp: Improvement) => {
      if (statusOf(imp.id) === "applied") return;
      workspaceRef.current?.applyFix(imp.originalText, imp.suggestedText);
      setStatuses((prev) => ({ ...prev, [imp.id]: "applied" }));
      if (selectedImpId === imp.id) setSelectedImpId(null);
      else reapplyHighlight();
    },
    [statusOf, selectedImpId, reapplyHighlight],
  );

  const handleDismiss = useCallback(
    (imp: Improvement) => {
      setStatuses((prev) => ({ ...prev, [imp.id]: "dismissed" }));
      if (selectedImpId === imp.id) setSelectedImpId(null);
    },
    [selectedImpId],
  );

  const handleUndo = useCallback(
    (imp: Improvement) => {
      if (statusOf(imp.id) === "applied") {
        // Revert the edit by swapping the suggested text back to the original.
        workspaceRef.current?.applyFix(imp.suggestedText, imp.originalText);
        reapplyHighlight();
      }
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[imp.id];
        return next;
      });
    },
    [statusOf, reapplyHighlight],
  );

  const handleToggleHide = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedImpId((prev) => (prev === id ? null : prev));
  }, []);

  // Clicking a card toggles selection.
  const handleSelect = useCallback((id: string) => {
    setSelectedImpId((prev) => (prev === id ? null : id));
  }, []);

  // Keep the document highlight in sync with the selected suggestion: scroll + highlight
  // the quoted section while selected, and clear it the moment nothing is selected
  // (deselected, applied, dismissed, hidden, or a different card chosen).
  useEffect(() => {
    const imp = selectedImpId
      ? analysisResult?.improvements.find((i) => i.id === selectedImpId)
      : null;
    workspaceRef.current?.setHighlight(imp?.originalText ?? null);
  }, [selectedImpId, analysisResult]);

  const analysisPanel = (
    <AnalysisPanel
      result={analysisResult}
      isAnalyzing={isAnalyzing}
      statuses={statuses}
      hiddenIds={hiddenIds}
      selectedImpId={selectedImpId}
      onSelect={handleSelect}
      onApply={handleApply}
      onDismiss={handleDismiss}
      onUndo={handleUndo}
      onToggleHide={handleToggleHide}
    />
  );

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          color: "var(--muted-foreground)",
          fontSize: 13,
          background: "var(--muted)",
        }}
      >
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
