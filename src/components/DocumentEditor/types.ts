import React from "react";

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
  /** Load raw HTML directly (bypasses markdown→html). Used when reopening a saved document. */
  rawHtml?: string;
  initialStyle?: Partial<DocStyle>;
  headerHtml?: string;
  rightSidebarContent?: React.ReactNode;
  /** Seed with pre-formatted HTML (e.g. from mammoth DOCX) — skips markdown conversion. */
  initialHtml?: string;
  /** Use DOCX-compatible styles instead of template CSS. Use with initialHtml. */
  rawHtmlMode?: boolean;
  showTailorPrompt?: boolean;
  customSidebar?: React.ReactNode;
}

export interface DocumentEditorHandle {
  applyFix(original: string, suggested: string): void;
  revealText(text: string): void;
  setHighlight(text: string | null): void;
}
