/**
 * LinkedInOptimizationWorkspace — two-step review flow.
 *
 *   Step 1 "Design":  live profile screenshot on the left; design recommendations
 *                     on the right. Selecting a tip highlights the exact region of
 *                     the profile (banner, photo, headline, a section…) on the shot.
 *   Step 2 "Content": the uploaded profile PDF on the left (all pages, text layer);
 *                     content suggestions on the right. Selecting one scrolls the
 *                     PDF to and highlights the exact text that needs updating.
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Loader2,
  Check,
  Copy,
  XCircle,
  ImageOff,
  ExternalLink,
  Palette,
  ListChecks,
  RotateCcw,
  Info,
  ArrowRight,
  ArrowLeft,
  Crosshair,
} from "lucide-react";
import Markdown from "react-markdown";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  LinkedInAnalysisResult,
  Improvement,
  DesignRecommendation,
} from "@/services/geminiService";
import type { ScreenshotResult, ProfileRegion } from "@/services/linkedinScreenshotService";
import { configurePdfWorker } from "@/lib/pdfWorker";
import { useIsMobile } from "@/hooks/useIsMobile";

configurePdfWorker(pdfjs);

const priorityStyles: Record<"high" | "medium" | "low", React.CSSProperties> = {
  high: {
    background: "rgba(217,119,87,0.15)",
    border: "1px solid rgba(217,119,87,0.40)",
    color: "var(--primary)",
  },
  medium: {
    background: "rgba(110,101,87,0.10)",
    border: "1px solid rgba(110,101,87,0.25)",
    color: "var(--muted-foreground)",
  },
  low: {
    background: "rgba(110,101,87,0.05)",
    border: "1px solid rgba(110,101,87,0.15)",
    color: "var(--muted-foreground)",
  },
};
const PRIORITY_ORDER: Record<"high" | "medium" | "low", number> = { high: 0, medium: 1, low: 2 };
const PDF_WIDTH = 620;

type Step = "design" | "content";

export interface LinkedInOptimizationWorkspaceProps {
  result: LinkedInAnalysisResult | null;
  isAnalyzing: boolean;
  screenshot: ScreenshotResult | null;
  isCapturing: boolean;
  profileUrl: string;
  file: File | null;
  fileObjectUrl: string | null;
  onReset: () => void;
}

export function LinkedInOptimizationWorkspace({
  result,
  isAnalyzing,
  screenshot,
  isCapturing,
  profileUrl,
  file,
  fileObjectUrl,
  onReset,
}: LinkedInOptimizationWorkspaceProps) {
  const isMobile = useIsMobile();
  const [step, setStep] = useState<Step>("design");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [selectedImpId, setSelectedImpId] = useState<string | null>(null);

  const toggleDismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const sortFn = (
    a: { id: string; priority: "high" | "medium" | "low" },
    b: { id: string; priority: "high" | "medium" | "low" },
  ) =>
    (dismissed.has(a.id) ? 10 : 0) -
    (dismissed.has(b.id) ? 10 : 0) +
    PRIORITY_ORDER[a.priority] -
    PRIORITY_ORDER[b.priority];

  const improvements = [...(result?.improvements ?? [])].sort(sortFn);
  const designRecs = [...(result?.designRecommendations ?? [])].sort(sortFn);

  const selectedDesign = designRecs.find((r) => r.id === selectedDesignId) ?? null;
  const selectedRegion =
    selectedDesign && screenshot?.regions
      ? (screenshot.regions.find((r) => r.key === selectedDesign.region) ?? null)
      : null;
  const selectedImp = improvements.find((i) => i.id === selectedImpId) ?? null;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--background)" }}>
      {/* Header + step switcher */}
      <header
        style={{
          padding: isMobile ? "12px 16px" : "14px 28px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2
            className="font-display"
            style={{
              fontSize: 19,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "var(--foreground)",
              margin: 0,
            }}
          >
            LinkedIn Optimization
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
            {step === "design"
              ? "Step 1 · Design review — fix how your profile looks"
              : "Step 2 · Content review — deep-dive your experience & summary"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <StepPills step={step} onChange={setStep} />
          <button onClick={onReset} style={ghostBtn}>
            <RotateCcw className="w-3.5 h-3.5" /> Start over
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* ── Left pane ─────────────────────────────────────────────── */}
        <div
          className="min-w-0 md:flex-1"
          style={{
            borderRight: isMobile ? "none" : "1px solid var(--border)",
            borderBottom: isMobile ? "1px solid var(--border)" : "none",
            background: "var(--muted)",
            flex: isMobile ? "0 0 auto" : undefined,
            height: isMobile ? "42vh" : undefined,
          }}
        >
          <ScrollArea className="h-full">
            <div style={{ padding: 24 }}>
              {step === "design" ? (
                <DesignPreview
                  screenshot={screenshot}
                  isCapturing={isCapturing}
                  profileUrl={profileUrl}
                  selectedRegion={selectedRegion}
                />
              ) : (
                <ContentPreview
                  fileObjectUrl={fileObjectUrl}
                  fileName={file?.name}
                  profileText={result?.profileText ?? ""}
                  target={selectedImp?.originalText ?? null}
                />
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── Right pane ────────────────────────────────────────────── */}
        <div
          style={{
            width: isMobile ? "100%" : 440,
            flex: isMobile ? "1 1 0%" : "0 0 auto",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {isAnalyzing ? (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              {[80, 64, 64, 64, 56].map((h, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl"
                  style={{ height: h, background: "var(--muted)" }}
                />
              ))}
              <p
                className="text-xs text-center"
                style={{ color: "var(--muted-foreground)", marginTop: 8 }}
              >
                Analysing your profile… this can take up to a minute.
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 min-h-0">
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                  {(result?.overallScore != null || result?.summary) && (
                    <div
                      style={{
                        background: "var(--muted)",
                        border: "1px solid var(--border)",
                        borderRadius: 14,
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {result?.overallScore != null && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 900,
                              textTransform: "uppercase",
                              letterSpacing: "0.15em",
                              color: "var(--muted-foreground)",
                            }}
                          >
                            Profile Score
                          </span>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            <span
                              className="font-display"
                              style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)" }}
                            >
                              {result.overallScore}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color: "var(--muted-foreground)",
                                fontWeight: 500,
                              }}
                            >
                              /100
                            </span>
                          </div>
                        </div>
                      )}
                      {result?.summary && (
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--muted-foreground)",
                            lineHeight: 1.6,
                            margin: 0,
                          }}
                        >
                          {result.summary}
                        </p>
                      )}
                    </div>
                  )}

                  {step === "design" ? (
                    <>
                      <SectionHeader
                        icon={<Palette className="w-3.5 h-3.5" />}
                        label={`Design recommendations (${designRecs.length})`}
                      />
                      <p
                        style={{
                          fontSize: 11.5,
                          color: "var(--muted-foreground)",
                          margin: "-4px 0 0",
                          lineHeight: 1.5,
                        }}
                      >
                        Click a tip to highlight that part of your profile on the left.
                      </p>
                      {designRecs.length === 0 && (
                        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                          No design recommendations — your profile looks polished.
                        </p>
                      )}
                      {designRecs.map((rec) => (
                        <DesignCard
                          key={rec.id}
                          rec={rec}
                          selected={selectedDesignId === rec.id}
                          hasRegion={!!screenshot?.regions?.some((r) => r.key === rec.region)}
                          dismissed={dismissed.has(rec.id)}
                          onSelect={() =>
                            setSelectedDesignId((id) => (id === rec.id ? null : rec.id))
                          }
                          onDismiss={() => toggleDismiss(rec.id)}
                        />
                      ))}
                    </>
                  ) : (
                    <>
                      <SectionHeader
                        icon={<ListChecks className="w-3.5 h-3.5" />}
                        label={`Content suggestions (${improvements.length})`}
                      />
                      <p
                        style={{
                          fontSize: 11.5,
                          color: "var(--muted-foreground)",
                          margin: "-4px 0 0",
                          lineHeight: 1.5,
                        }}
                      >
                        Click a suggestion to jump to and highlight that text in your PDF.
                      </p>
                      {improvements.length === 0 && (
                        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                          No content suggestions — your profile reads well.
                        </p>
                      )}
                      {improvements.map((imp) => (
                        <ImprovementCard
                          key={imp.id}
                          imp={imp}
                          selected={selectedImpId === imp.id}
                          dismissed={dismissed.has(imp.id)}
                          onSelect={() => setSelectedImpId((id) => (id === imp.id ? null : imp.id))}
                          onDismiss={() => toggleDismiss(imp.id)}
                        />
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>

              {/* Step navigation */}
              <div style={{ padding: 16, borderTop: "1px solid var(--border)", flexShrink: 0 }}>
                {step === "design" ? (
                  <button onClick={() => setStep("content")} style={primaryBtn}>
                    Next: Content review <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={() => setStep("design")} style={secondaryBtn}>
                    <ArrowLeft className="w-4 h-4" /> Back to design
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Step 1: design preview with region highlight ───────────────────────────── */

function DesignPreview({
  screenshot,
  isCapturing,
  profileUrl,
  selectedRegion,
}: {
  screenshot: ScreenshotResult | null;
  isCapturing: boolean;
  profileUrl: string;
  selectedRegion: ProfileRegion | null;
}) {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedRegion) boxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedRegion]);

  if (isCapturing) {
    return (
      <Centered>
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--primary)" }} />
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Loading your profile preview…
        </p>
      </Centered>
    );
  }

  if (screenshot?.image && !screenshot.blocked) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <PreviewHeader profileUrl={profileUrl} label="Live profile" />
        <div style={{ position: "relative" }}>
          <img
            src={screenshot.image}
            alt="LinkedIn profile preview"
            onLoad={(e) =>
              setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
            style={{
              width: "100%",
              display: "block",
              borderRadius: 14,
              border: "1px solid var(--border)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
            }}
          />
          {selectedRegion && nat && (
            <div
              ref={boxRef}
              style={{
                position: "absolute",
                left: `${(selectedRegion.x / nat.w) * 100}%`,
                top: `${(selectedRegion.y / nat.h) * 100}%`,
                width: `${(selectedRegion.w / nat.w) * 100}%`,
                height: `${(selectedRegion.h / nat.h) * 100}%`,
                border: "2.5px solid var(--primary)",
                background: "rgba(217,119,87,0.16)",
                borderRadius: 8,
                boxShadow: "0 0 0 3px rgba(217,119,87,0.25), 0 8px 24px rgba(217,119,87,0.25)",
                transition: "all 0.25s ease",
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: -11,
                  left: 8,
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#fff",
                  background: "var(--primary)",
                  padding: "2px 8px",
                  borderRadius: 9999,
                  whiteSpace: "nowrap",
                }}
              >
                {selectedRegion.label}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // No usable live capture.
  return (
    <Centered>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--card)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--muted-foreground)",
        }}
      >
        <ImageOff className="w-6 h-6" />
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
        {screenshot?.blocked ? "LinkedIn blocked the live capture" : "No live preview"}
      </p>
      <p
        style={{
          fontSize: 12.5,
          color: "var(--muted-foreground)",
          lineHeight: 1.6,
          maxWidth: 360,
          margin: 0,
        }}
      >
        {screenshot?.note ??
          "We couldn't load the live profile. You can still review your content in Step 2, and re-run to retry the capture."}
      </p>
      {profileUrl && (
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12.5,
            color: "var(--primary)",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          Open profile <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </Centered>
  );
}

/* ── Step 2: PDF preview with text highlight + navigation ────────────────────── */

function ContentPreview({
  fileObjectUrl,
  fileName,
  profileText,
  target,
}: {
  fileObjectUrl: string | null;
  fileName?: string;
  profileText: string;
  target: string | null;
}) {
  const [numPages, setNumPages] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlighted = useRef<HTMLElement[]>([]);

  const clear = useCallback(() => {
    highlighted.current.forEach((s) => {
      s.style.backgroundColor = "";
      s.style.borderRadius = "";
    });
    highlighted.current = [];
  }, []);

  useEffect(() => {
    if (!target) {
      clear();
      return;
    }
    let cancelled = false;
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const targetNorm = norm(target);

    const attempt = (tries: number) => {
      if (cancelled) return;
      const root = containerRef.current;
      if (!root) return;
      const spans = Array.from(
        root.querySelectorAll<HTMLElement>(".react-pdf__Page__textContent span"),
      );
      if (spans.length === 0) {
        if (tries > 0) setTimeout(() => attempt(tries - 1), 300);
        return;
      }

      clear();
      let full = "";
      const ranges: { span: HTMLElement; start: number; end: number }[] = [];
      for (const span of spans) {
        const t = norm(span.textContent || "");
        if (!t) continue;
        const start = full.length;
        full += t + " ";
        ranges.push({ span, start, end: full.length });
      }

      const apply = (s: number, e: number) => {
        const hit = ranges.filter((r) => r.start < e && r.end > s);
        hit.forEach((r) => {
          r.span.style.backgroundColor = "rgba(217,119,87,0.40)";
          r.span.style.borderRadius = "2px";
          highlighted.current.push(r.span);
        });
        hit[0]?.span.scrollIntoView({ behavior: "smooth", block: "center" });
        return hit.length > 0;
      };

      let idx = full.indexOf(targetNorm);
      if (idx >= 0) {
        apply(idx, idx + targetNorm.length);
        return;
      }
      // Fallback: match the first chunk of the phrase.
      const short = targetNorm.slice(0, 40);
      idx = short.length > 8 ? full.indexOf(short) : -1;
      if (idx >= 0) {
        apply(idx, idx + short.length);
        return;
      }
      if (tries > 0) setTimeout(() => attempt(tries - 1), 300);
    };

    const id = setTimeout(() => attempt(8), 150);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [target, numPages, fileObjectUrl, clear]);

  const isPdf = !!fileObjectUrl && (fileName?.toLowerCase().endsWith(".pdf") ?? true);

  if (fileObjectUrl && isPdf) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <PreviewHeader label={fileName ?? "Your profile PDF"} />
        <div
          ref={containerRef}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
        >
          <Document
            file={fileObjectUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={
              <div style={{ padding: 24, color: "var(--muted-foreground)", fontSize: 13 }}>
                Loading PDF…
              </div>
            }
            error={
              <div style={{ padding: 24, color: "var(--destructive)", fontSize: 13 }}>
                Failed to load the PDF.
              </div>
            }
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 4,
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
                }}
              >
                <Page
                  pageNumber={i + 1}
                  width={PDF_WIDTH}
                  renderAnnotationLayer={false}
                  renderTextLayer
                />
              </div>
            ))}
          </Document>
        </div>
      </div>
    );
  }

  // Non-PDF upload: render the extracted text as the reviewable document.
  if (profileText) {
    return (
      <div
        className="prose prose-sm max-w-none"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "20px 22px",
          color: "var(--foreground)",
        }}
      >
        <Markdown>{profileText}</Markdown>
      </div>
    );
  }

  return (
    <Centered>
      <Info className="w-6 h-6" style={{ color: "var(--muted-foreground)" }} />
      <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
        Upload a profile PDF to review its content here.
      </p>
    </Centered>
  );
}

/* ── Cards & bits ───────────────────────────────────────────────────────────── */

function StepPills({ step, onChange }: { step: Step; onChange: (s: Step) => void }) {
  const pill = (s: Step, n: string, label: string): React.CSSProperties => ({
    height: 32,
    padding: "0 12px",
    borderRadius: 9999,
    border: "1px solid var(--border)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 12.5,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: step === s ? "var(--primary)" : "var(--card)",
    color: step === s ? "#fff" : "var(--muted-foreground)",
    borderColor: step === s ? "var(--primary)" : "var(--border)",
  });
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button style={pill("design", "1", "Design")} onClick={() => onChange("design")}>
        <span style={badgeNum(step === "design")}>1</span> Design
      </button>
      <button style={pill("content", "2", "Content")} onClick={() => onChange("content")}>
        <span style={badgeNum(step === "content")}>2</span> Content
      </button>
    </div>
  );
}
const badgeNum = (active: boolean): React.CSSProperties => ({
  width: 16,
  height: 16,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 10,
  fontWeight: 900,
  background: active ? "rgba(255,255,255,0.25)" : "var(--muted)",
  color: active ? "#fff" : "var(--muted-foreground)",
});

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "0.15em",
        color: "var(--muted-foreground)",
        paddingTop: 4,
      }}
    >
      {icon} {label}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "0.15em",
        padding: "3px 8px",
        borderRadius: 9999,
        ...priorityStyles[priority],
      }}
    >
      {priority}
    </span>
  );
}

function cardShell(selected: boolean, dismissed: boolean): React.CSSProperties {
  return {
    background: "var(--card)",
    borderRadius: 16,
    padding: 16,
    cursor: "pointer",
    border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
    boxShadow: selected ? "0 0 0 2px rgba(217,119,87,0.25)" : "none",
    opacity: dismissed ? 0.55 : 1,
    transition: "border-color 0.15s, box-shadow 0.15s, opacity 0.2s",
  };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          })
          .catch(() => {});
      }}
      style={{
        flex: 1,
        height: 32,
        borderRadius: 8,
        border: "1px solid var(--border)",
        cursor: "pointer",
        background: "var(--card)",
        color: copied ? "var(--forest)" : "var(--primary)",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3" /> Copied
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" /> Copy
        </>
      )}
    </button>
  );
}

function ImprovementCard({
  imp,
  selected,
  dismissed,
  onSelect,
  onDismiss,
}: {
  imp: Improvement;
  selected: boolean;
  dismissed: boolean;
  onSelect: () => void;
  onDismiss: () => void;
}) {
  return (
    <div style={cardShell(selected, dismissed)} onClick={onSelect}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <PriorityBadge priority={imp.priority} />
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--muted-foreground)",
            opacity: 0.7,
          }}
        >
          {imp.category}
        </span>
        {selected && (
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 9,
              fontWeight: 800,
              color: "var(--primary)",
            }}
          >
            <Crosshair className="w-3 h-3" /> shown in PDF
          </span>
        )}
      </div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--foreground)",
          margin: "0 0 4px",
          textDecoration: dismissed ? "line-through" : "none",
        }}
      >
        {imp.checklistLabel}
      </p>
      <p
        style={{
          fontSize: 12,
          color: "var(--muted-foreground)",
          lineHeight: 1.55,
          margin: "0 0 10px",
        }}
      >
        {imp.description}
      </p>
      {imp.originalText && (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            background: "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "8px 10px",
            marginBottom: 8,
          }}
        >
          <span style={{ color: "var(--muted-foreground)", textDecoration: "line-through" }}>
            {imp.originalText}
          </span>
        </div>
      )}
      {imp.suggestedText && (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            background: "rgba(47,107,79,0.06)",
            border: "1px solid rgba(47,107,79,0.20)",
            borderRadius: 10,
            padding: "8px 10px",
            marginBottom: 10,
            color: "var(--foreground)",
          }}
        >
          {imp.suggestedText}
        </div>
      )}
      {!dismissed ? (
        <div style={{ display: "flex", gap: 6 }}>
          {imp.suggestedText && <CopyButton text={imp.suggestedText} />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            style={dismissBtn}
          >
            <XCircle className="w-3 h-3" /> Dismiss
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          style={restoreBtn}
        >
          <RotateCcw className="w-3 h-3" /> Restore
        </button>
      )}
    </div>
  );
}

function DesignCard({
  rec,
  selected,
  hasRegion,
  dismissed,
  onSelect,
  onDismiss,
}: {
  rec: DesignRecommendation;
  selected: boolean;
  hasRegion: boolean;
  dismissed: boolean;
  onSelect: () => void;
  onDismiss: () => void;
}) {
  return (
    <div style={cardShell(selected, dismissed)} onClick={onSelect}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <PriorityBadge priority={rec.priority} />
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--muted-foreground)",
            opacity: 0.7,
          }}
        >
          {rec.category}
        </span>
        {hasRegion && (
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 9,
              fontWeight: 800,
              color: selected ? "var(--primary)" : "var(--muted-foreground)",
            }}
          >
            <Crosshair className="w-3 h-3" /> {selected ? "highlighted" : "highlight"}
          </span>
        )}
      </div>
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--foreground)",
          margin: "0 0 4px",
          textDecoration: dismissed ? "line-through" : "none",
        }}
      >
        {rec.title}
      </p>
      <p
        style={{
          fontSize: 12,
          color: "var(--muted-foreground)",
          lineHeight: 1.55,
          margin: "0 0 10px",
        }}
      >
        {rec.description}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        style={dismissed ? restoreBtn : { ...dismissBtn, width: "100%" }}
      >
        {dismissed ? (
          <>
            <RotateCcw className="w-3 h-3" /> Restore
          </>
        ) : (
          <>
            <Check className="w-3 h-3" /> Mark done
          </>
        )}
      </button>
    </div>
  );
}

function PreviewHeader({ profileUrl, label }: { profileUrl?: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          color: "var(--muted-foreground)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {profileUrl && (
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            color: "var(--primary)",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          Open <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
        padding: "64px 16px",
        minHeight: 360,
      }}
    >
      {children}
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  height: 34,
  padding: "0 14px",
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontFamily: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  color: "var(--foreground)",
  display: "flex",
  alignItems: "center",
  gap: 6,
};
const primaryBtn: React.CSSProperties = {
  width: "100%",
  height: 44,
  background: "var(--primary)",
  color: "#fff",
  border: "1px solid var(--primary)",
  borderRadius: 12,
  fontFamily: "inherit",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: "0 4px 14px rgba(217,119,87,0.25)",
};
const secondaryBtn: React.CSSProperties = {
  width: "100%",
  height: 44,
  background: "var(--card)",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontFamily: "inherit",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};
const dismissBtn: React.CSSProperties = {
  height: 32,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  cursor: "pointer",
  background: "transparent",
  color: "var(--muted-foreground)",
  fontSize: 11,
  fontWeight: 700,
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
};
const restoreBtn: React.CSSProperties = {
  width: "100%",
  height: 32,
  borderRadius: 8,
  border: "1px solid var(--border)",
  cursor: "pointer",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 11,
  fontWeight: 700,
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};
