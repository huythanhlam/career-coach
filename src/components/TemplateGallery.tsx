import React, { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { ResumeRenderer } from "./ResumeRenderer";
import { ResumeStyleConfig } from "@/types/resumeStyle";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  atsSafe: boolean;
  accent: string; // default accent for thumbnail
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: "modern-clean",
    name: "Modern & Clean",
    description: "Minimalist, professional, ATS-friendly.",
    atsSafe: true,
    accent: "#2F6B4F",
  },
  {
    id: "tech-focused",
    name: "Tech Focused",
    description: "Monospace headings, great for engineering roles.",
    atsSafe: true,
    accent: "#4F46E5",
  },
  {
    id: "executive",
    name: "Executive",
    description: "Serif, centred name, authoritative presence.",
    atsSafe: true,
    accent: "#1E3A5F",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Maximum whitespace, zero distractions.",
    atsSafe: true,
    accent: "#374151",
  },
  {
    id: "academic",
    name: "Academic / Research",
    description: "Dense, structured, great for PhDs & research.",
    atsSafe: true,
    accent: "#7C3AED",
  },
  {
    id: "creative",
    name: "Creative",
    description: "Gradient name, bold colour — for creative roles.",
    atsSafe: false,
    accent: "#D97757",
  },
  {
    id: "photography",
    name: "Photography / Visual",
    description: "Airy, spaced, light-weight typography.",
    atsSafe: false,
    accent: "#0D9488",
  },
  {
    id: "slate",
    name: "Slate",
    description: "Strong accent lines, modern sections.",
    atsSafe: false,
    accent: "#475569",
  },
];

const SAMPLE_MARKDOWN = `# Jane Smith
jane@example.com · linkedin.com/in/janesmith

## Experience

### Senior Product Manager · Acme Corp
*Jan 2022 – Present*

- Led cross-functional team of 12 to ship 3 major product releases
- Increased user retention by 34% through data-driven feature prioritisation

## Education

### B.S. Computer Science · Stanford University
*Class of 2018*

## Skills
React · TypeScript · Python · SQL · Figma
`;

interface TemplateGalleryProps {
  currentTemplateId: string;
  styleConfig: ResumeStyleConfig;
  markdownContent?: string;
  onSelect: (templateId: string) => void;
  onClose: () => void;
}

export function TemplateGallery({
  currentTemplateId,
  styleConfig,
  markdownContent,
  onSelect,
  onClose,
}: TemplateGalleryProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [atsOnly, setAtsOnly] = useState(false);
  const previewContent =
    markdownContent && markdownContent.trim().length > 50 ? markdownContent : SAMPLE_MARKDOWN;

  const visible = atsOnly ? TEMPLATES.filter((t) => t.atsSafe) : TEMPLATES;
  const previewTemplate = hoveredId ?? currentTemplateId;

  return (
    <div
      className="fixed inset-0 z-[200] flex p-3 sm:p-0"
      style={{ background: "rgba(31,27,22,0.72)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="m-auto flex flex-col md:flex-row w-full max-w-6xl rounded-2xl overflow-hidden"
        style={{
          height: "88vh",
          background: "var(--background)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.35)",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left panel — template list */}
        <div
          className="flex flex-col shrink-0 w-full md:w-[340px] h-[42vh] md:h-auto border-b md:border-b-0 md:border-r"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div>
              <div
                className="font-display text-lg font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                Choose a template
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                Hover to preview, click to apply.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close template gallery"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--muted-foreground)",
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ATS toggle */}
          <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <label
              className="flex items-center gap-2 cursor-pointer select-none"
              style={{ fontSize: 12 }}
            >
              <div
                onClick={() => setAtsOnly((v) => !v)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: atsOnly ? "var(--forest)" : "var(--border)",
                  position: "relative",
                  transition: "background 0.2s",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: atsOnly ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </div>
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>
                ATS-safe templates only
              </span>
            </label>
            <p
              className="mt-1"
              style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 44 }}
            >
              Hides visual templates that may reduce recruiter-tool scores.
            </p>
          </div>

          {/* Template list */}
          <div
            className="flex-1 overflow-y-auto p-3"
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            {visible.map((t) => {
              const isActive = currentTemplateId === t.id;
              const isHovered = hoveredId === t.id;
              return (
                <button
                  key={t.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onSelect(t.id);
                    onClose();
                  }}
                  onMouseEnter={() => setHoveredId(t.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    border: isActive ? `2px solid var(--primary)` : "2px solid transparent",
                    background: isActive || isHovered ? "var(--muted)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                >
                  {/* Mini colour swatch */}
                  <div
                    style={{
                      width: 10,
                      height: 36,
                      borderRadius: 4,
                      background: t.accent,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                        {t.name}
                      </span>
                      {!t.atsSafe && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: 4,
                            background: "rgba(217,119,87,0.15)",
                            color: "var(--primary)",
                            letterSpacing: "0.04em",
                          }}
                        >
                          VISUAL
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        marginTop: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      {t.description}
                    </p>
                  </div>
                  {isActive && (
                    <CheckCircle2
                      className="w-4 h-4 shrink-0"
                      style={{ color: "var(--primary)" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel — live preview */}
        <div
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
          style={{ background: "var(--muted)" }}
        >
          <div
            className="shrink-0 px-6 py-3 flex items-center justify-between"
            style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>
              Preview — {TEMPLATES.find((t) => t.id === previewTemplate)?.name}
            </span>
            <button
              onClick={() => {
                onSelect(previewTemplate);
                onClose();
              }}
              style={{
                height: 32,
                padding: "0 16px",
                borderRadius: 8,
                background: "var(--primary)",
                border: "none",
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Apply this template →
            </button>
          </div>
          <div className="flex-1 overflow-y-auto flex justify-center py-8 px-6">
            <div
              style={{
                width: "100%",
                maxWidth: 680,
                background: "var(--card)",
                boxShadow: "0 4px 30px rgba(0,0,0,0.08)",
                borderRadius: 8,
                padding: "48px 56px",
                alignSelf: "flex-start",
              }}
            >
              <ResumeRenderer
                markdownContent={previewContent}
                templateType={previewTemplate}
                styleConfig={{
                  ...styleConfig,
                  templateId: previewTemplate,
                  accentColor:
                    TEMPLATES.find((t) => t.id === previewTemplate)?.accent ??
                    styleConfig.accentColor,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
