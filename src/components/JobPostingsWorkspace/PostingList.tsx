import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Star, ExternalLink, Sparkles, Plus, Loader2 } from "lucide-react";
import { companyLogoSources, companyMonogram } from "@/lib/companyLogo";
import { fitLabel, RECOMMENDED_THRESHOLD, type FitFactor } from "@/services/jobRecommendation";
import { JOB_STATUSES, type JobPosting, type JobStatus } from "@/types/jobPosting";
import { STATUS_META } from "./styles";
import type { ListItem } from "./index";

/* ─────────────────────────────────────────────────────────────────────────
   Company logo — official logo via keyless CDNs, falling back to a monogram
   ───────────────────────────────────────────────────────────────────────── */
function CompanyLogo({ company, url, size = 40 }: { company?: string; url?: string; size?: number }) {
  const sources = useMemo(() => companyLogoSources(company, url), [company, url]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [company, url]);

  const radius = Math.round(size / 4);
  const src = sources[idx];

  if (!src) {
    const { letter, color } = companyMonogram(company);
    return (
      <div aria-hidden style={{
        width: size, height: size, flexShrink: 0, borderRadius: radius, background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-display, inherit)", fontWeight: 700, fontSize: size * 0.42,
      }}>{letter}</div>
    );
  }
  return (
    <img
      src={src}
      alt={company ? `${company} logo` : "Company logo"}
      width={size} height={size} loading="lazy"
      onError={() => setIdx((i) => i + 1)}
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: radius, objectFit: "contain",
        background: "#fff", border: "1px solid var(--border)", padding: 4,
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Fit score cell — shows the per-factor "why" breakdown on hover
   ───────────────────────────────────────────────────────────────────────── */
const fitBarColor = (s: number) => (s >= 60 ? "var(--primary)" : s >= 35 ? "#F59E0B" : "var(--muted-foreground)");

function FitScoreCell({ score, factors }: { score: number; factors: FitFactor[] }) {
  const recommended = score >= RECOMMENDED_THRESHOLD;
  const [rect, setRect] = useState<DOMRect | null>(null);

  return (
    <div
      onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
      style={{ flexShrink: 0, textAlign: "right", minWidth: 64, cursor: "help" }}
      aria-label={`${fitLabel(score)} · ${score}% fit. Hover for the breakdown.`}
    >
      <div style={{ fontSize: 17, fontWeight: 700, color: recommended ? "var(--primary)" : "var(--foreground)", lineHeight: 1 }}>
        {score}<span style={{ fontSize: 12, fontWeight: 600 }}>%</span>
      </div>
      <div className="eyebrow" style={{ fontSize: 9 }}>fit</div>

      {rect && createPortal(
        <div
          className="animate-in fade-in zoom-in-95 duration-150"
          style={{
            position: "fixed", zIndex: 200, width: 300, pointerEvents: "none",
            top: Math.min(rect.bottom + 8, window.innerHeight - 12),
            left: Math.max(12, Math.min(rect.right - 300, window.innerWidth - 312)),
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
            boxShadow: "0 16px 44px rgba(0,0,0,0.20)", padding: 14,
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{fitLabel(score)} · {score}% fit</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {factors.map((f) => (
              <div key={f.key}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>
                    {f.label}<span style={{ fontWeight: 500, color: "var(--muted-foreground)" }}> · {f.weight}% of score</span>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: fitBarColor(f.score) }}>{f.score}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 9999, background: "var(--muted)", marginTop: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${f.score}%`, background: fitBarColor(f.score), borderRadius: 9999 }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3, lineHeight: 1.45 }}>{f.detail}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 10 }}>Click the row for full details</div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Unified job row
   ───────────────────────────────────────────────────────────────────────── */
function JobRow({
  item, last, saving, showScore, onOpen, onSave, onToggleFav, onStatus,
}: {
  item: ListItem;
  last: boolean;
  saving: boolean;
  showScore: boolean;
  onOpen: () => void;
  onSave: () => void;
  onToggleFav?: () => void;
  onStatus?: (s: JobStatus) => void;
}) {
  const p = item.posting;
  const recommended = showScore && item.score >= RECOMMENDED_THRESHOLD;
  const meta = p ? STATUS_META[p.status] : null;
  const sub = [item.company, item.location].filter(Boolean).join(" · ") || "—";

  return (
    <div
      onClick={onOpen}
      className="hover:bg-muted/40 transition-colors"
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "16px 20px",
        borderBottom: last ? "none" : "1px solid var(--border)", cursor: "pointer",
      }}>
      {onToggleFav && (
        <button onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: p?.favorite ? "var(--primary)" : "var(--muted-foreground)", display: "flex", padding: 0, flexShrink: 0 }}>
          <Star className="w-4 h-4" fill={p?.favorite ? "var(--primary)" : "none"} />
        </button>
      )}

      <CompanyLogo company={item.company} url={item.url} size={40} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
          {recommended && (
            <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary)", background: "rgba(217,119,87,0.10)", border: "1px solid rgba(217,119,87,0.25)", borderRadius: 9999, padding: "2px 8px" }}>
              <Sparkles className="w-3 h-3" /> Recommended
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
      </div>

      {showScore && <FitScoreCell score={item.score} factors={item.factors} />}

      {item.url && (
        <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
          style={{ color: "var(--muted-foreground)", display: "flex", flexShrink: 0 }}>
          <ExternalLink className="w-4 h-4" />
        </a>
      )}

      {p && onStatus ? (
        <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <select
            value={p.status} onChange={(e) => onStatus(e.target.value as JobStatus)}
            style={{
              height: 30, borderRadius: 9999, padding: "0 10px", cursor: "pointer",
              fontFamily: "inherit", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
              background: meta!.bg, color: meta!.fg, border: `1px solid ${meta!.border}`, outline: "none",
            }}>
            {p.status === "suggested" && <option value="suggested">Suggested</option>}
            {JOB_STATUSES.map((s) => <option key={s} value={s} style={{ color: "var(--foreground)", background: "var(--card)" }}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); onSave(); }} disabled={saving}
          style={{
            height: 34, padding: "0 14px", borderRadius: 9, flexShrink: 0, border: "1px solid var(--primary)",
            background: "var(--primary)", color: "#FFF", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
            cursor: saving ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 5,
          }}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Save
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   PostingList
   ───────────────────────────────────────────────────────────────────────── */
interface PostingListProps {
  items: ListItem[];
  loading: boolean;
  savedOnly: boolean;
  searched: boolean;
  level: string;
  workplace: string;
  family: string;
  industry: string;
  location: string;
  personalized: boolean;
  recommendedCount: number;
  savingKey: string | null;
  onOpen: (item: ListItem) => void;
  onSave: (item: ListItem) => void;
  onToggleFav: (posting: JobPosting) => void;
  onStatus: (posting: JobPosting, status: JobStatus) => void;
  onToggleSavedOnly: () => void;
}

export const PostingList = React.memo(function PostingList({
  items, loading, savedOnly, searched, level, workplace, family, industry, location,
  personalized, recommendedCount, savingKey,
  onOpen, onSave, onToggleFav, onStatus, onToggleSavedOnly,
}: PostingListProps) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--foreground)", margin: 0 }}>
          {savedOnly ? "Your saved jobs" : personalized ? "Jobs for you" : "Jobs"}
          <span style={{ fontSize: 14, color: "var(--muted-foreground)", fontWeight: 500 }}> · {items.length}</span>
          {!savedOnly && personalized && recommendedCount > 0 && (
            <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600, marginLeft: 10 }}>{recommendedCount} recommended</span>
          )}
        </h3>
        <button
          onClick={onToggleSavedOnly}
          style={{
            height: 36, padding: "0 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
            fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
            background: savedOnly ? "var(--primary)" : "var(--card)",
            color: savedOnly ? "#FFF" : "var(--muted-foreground)",
            border: `1px solid ${savedOnly ? "var(--primary)" : "var(--border)"}`,
          }}>
          <Star className="w-3.5 h-3.5" fill={savedOnly ? "#FFF" : "none"} /> Saved only
        </button>
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, padding: 0, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
        {items.length === 0 ? (
          <div style={{ padding: "56px 20px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>
            {loading ? "Finding jobs that fit your profile…"
              : savedOnly ? "No saved jobs yet — search above and save the ones you like."
              : (level !== "any" || workplace !== "any" || family !== "any" || industry !== "any" || location.trim()) ? "No jobs match these filters — try clearing the location, level, workplace, family, or industry filter."
              : searched ? "No jobs to show — try a different search."
              : "Search by job title above to see roles ranked for you."}
          </div>
        ) : items.map((item, i) => (
          <JobRow key={item.key} item={item} last={i === items.length - 1}
            saving={savingKey === item.key}
            showScore={personalized}
            onOpen={() => onOpen(item)}
            onSave={() => onSave(item)}
            onToggleFav={item.posting ? () => onToggleFav(item.posting!) : undefined}
            onStatus={item.posting ? (s) => onStatus(item.posting!, s) : undefined}
          />
        ))}
      </div>
    </div>
  );
});
