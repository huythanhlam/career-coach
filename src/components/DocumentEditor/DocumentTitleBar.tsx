import React, { useRef } from "react";
import { Loader2, Download, Save, Bookmark, PanelRightClose, PanelRightOpen, Palette } from "lucide-react";
import type { DocStyle } from "./index";

interface DocumentTitleBarProps {
  title: string;
  setTitle: (t: string) => void;
  onTitleChange?: (t: string) => void;
  saveStatus: "" | "saving" | "saved";
  showStylePanel: boolean;
  setShowStylePanel: (v: boolean | ((prev: boolean) => boolean)) => void;
  showAI: boolean;
  setShowAI: (v: boolean | ((prev: boolean) => boolean)) => void;
  aiEnabled: boolean;
  onSave?: (content: string, title: string, html: string, style: DocStyle) => void;
  onClose?: () => void;
  content: string;
  docStyle: DocStyle;
  getHtml: () => string;
  exportDocx: () => void;
  exportPDF: () => void;
}

export function DocumentTitleBar({
  title, setTitle, onTitleChange, saveStatus,
  showStylePanel, setShowStylePanel, showAI, setShowAI,
  aiEnabled, onSave, onClose, content, docStyle, getHtml,
  exportDocx, exportPDF,
}: DocumentTitleBarProps) {
  const titleRef = useRef<HTMLSpanElement>(null);

  return (
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
          <button onClick={() => onSave(content, title, getHtml(), docStyle)}
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
  );
}
