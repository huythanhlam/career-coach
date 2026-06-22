import React from "react";
import { Loader2 } from "lucide-react";
import { markdownToHtml } from "@/lib/documentMarkdown";

interface DocumentBodyProps {
  scopeId: string;
  editorRef: React.RefObject<HTMLDivElement>;
  isLoading: boolean;
  content: string;
  rawHtmlMode: boolean;
  headerHtml?: string;
  paperBg: string;
  handleInput: () => void;
  saveSel: () => void;
}

export function DocumentBody({
  scopeId, editorRef, isLoading, content, rawHtmlMode,
  headerHtml, paperBg, handleInput, saveSel,
}: DocumentBodyProps) {
  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "var(--muted)" }}>
      <div className="flex justify-center px-2 pt-4 pb-16 sm:px-0 sm:pt-8 sm:pb-20">
        <div className="px-5 py-8 sm:px-24 sm:py-[72px]" style={{ width: "100%", maxWidth: 816, minHeight: 1056, background: paperBg, boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px var(--border)" }}>
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
              id={scopeId}
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
  );
}
