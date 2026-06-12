import { useState } from "react";
import { Loader2, Sparkles, FileText, Link as LinkIcon, ChevronLeft, ChevronRight } from "lucide-react";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PageHeader, MentorCard, FormCard } from "./shared";
import type { WorkflowConfig } from "@/config/workflows";

interface GenericWorkflowProps {
  config: WorkflowConfig;
  formData: Record<string, any>;
  fileData: Record<string, any>;
  isGenerating: boolean;
  mainDocumentText: string;
  onInputChange: (id: string, value: string) => void;
  onFileChange: (id: string, file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
}

export function GenericWorkflow({
  config,
  formData,
  fileData,
  isGenerating,
  mainDocumentText,
  onInputChange,
  onFileChange,
  onSubmit,
  onReset,
}: GenericWorkflowProps) {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState(1);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
      <PageHeader title={config.title} description={config.description} />
      <div className="flex-1 overflow-auto no-scrollbar p-8">
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Form state */}
          {!mainDocumentText && !isGenerating && (
            <FormCard
              config={config}
              formData={formData}
              fileData={fileData}
              isGenerating={isGenerating}
              handleInputChange={onInputChange}
              handleFileChange={onFileChange}
              handleInitialSubmit={onSubmit}
            />
          )}

          {/* File preview */}
          {(mainDocumentText || isGenerating) && Object.values(fileData).length > 0 && (
            <MentorCard style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <FileText className="w-4 h-4" style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                  {Object.values(fileData)[0].name}
                </span>
              </div>
              <div style={{ background: "var(--muted)", display: "flex", flexDirection: "column", alignItems: "center", padding: 16 }}>
                {Object.values(fileData)[0].mimeType === "application/pdf" ? (
                  <>
                    <Document
                      file={Object.values(fileData)[0].objectUrl}
                      onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                      loading={<div style={{ padding: 16, color: "var(--muted-foreground)" }}>Loading PDF…</div>}
                      error={<div style={{ padding: 16, color: "var(--destructive)" }}>Failed to load PDF.</div>}
                    >
                      <Page pageNumber={pageNumber} renderTextLayer={false} renderAnnotationLayer={false} width={420} />
                    </Document>
                    {numPages && numPages > 1 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 9999, padding: "6px 12px" }}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={pageNumber <= 1} onClick={() => setPageNumber(p => Math.max(p - 1, 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{pageNumber} of {numPages}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={pageNumber >= numPages} onClick={() => setPageNumber(p => Math.min(p + 1, numPages))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: 16, color: "var(--muted-foreground)", fontSize: 14 }}>Preview not available for this file type.</div>
                )}
              </div>
            </MentorCard>
          )}

          {/* URL reference */}
          {(mainDocumentText || isGenerating) && formData.url && (
            <MentorCard style={{ padding: "16px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <LinkIcon className="w-4 h-4" style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Linked URL</span>
              </div>
              <a href={formData.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--primary)", wordBreak: "break-all" }}>{formData.url}</a>
            </MentorCard>
          )}

          {/* Main AI result */}
          {(mainDocumentText || isGenerating) && (
            <MentorCard style={{ overflow: "hidden" }} className="animate-in fade-in duration-300">
              <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                {isGenerating && !mainDocumentText.trim()
                  ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
                  : <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />}
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                  {isGenerating && !mainDocumentText.trim() ? "Analysing…" : "Results"}
                </span>
              </div>
              <div style={{ padding: "20px 22px" }}>
                {mainDocumentText.trim() ? (
                  <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
                    <Markdown>{mainDocumentText}</Markdown>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48, color: "var(--muted-foreground)" }}>
                    <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: "var(--primary)" }} />
                    <p style={{ fontSize: 14 }}>Processing your request…</p>
                  </div>
                )}
              </div>
            </MentorCard>
          )}

          {mainDocumentText && (
            <button
              onClick={onReset}
              style={{ height: 48, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}
            >
              Start new analysis
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
