import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Star, ExternalLink, Users } from "lucide-react";
import type { CompanyRating } from "@/services/geminiService";
import { MentorCard, SectionHeader } from "./shared";

/** Brand-ish colors per known review source; falls back to a palette. */
const SOURCE_COLORS: Record<string, string> = {
  glassdoor: "#0CAA41",
  indeed: "#2557A7",
  blind: "#1A8E8E",
  comparably: "#6C5CE7",
  ambitionbox: "#0D72C5",
};
const FALLBACK_PALETTE = ["#3B82F6", "#E8B948", "#2F6B4F", "#9333EA", "#EF4444"];

function colorFor(source: string, i: number): string {
  return SOURCE_COLORS[source.trim().toLowerCase()] ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length];
}

/** Count up to `target` on mount (respects reduced-motion). */
function useCountUp(target: number, durationMs = 900): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (reduce) { setValue(target); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, durationMs, reduce]);
  return value;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

/** Animated SVG donut ring showing the composite rating fraction (0–1). */
function CompositeRing({ fraction, label, sub }: { fraction: number; label: string; sub: string }) {
  const reduce = useReducedMotion();
  const r = 46;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={r} fill="none" stroke="var(--muted)" strokeWidth={10} />
        <motion.circle
          cx={60} cy={60} r={r} fill="none" stroke="var(--primary)" strokeWidth={10} strokeLinecap="round"
          transform="rotate(-90 60 60)"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: reduce ? circ * (1 - fraction) : circ }}
          animate={{ strokeDashoffset: circ * (1 - fraction) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span className="font-display" style={{ fontSize: 26, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>{sub}</span>
      </div>
    </div>
  );
}

function RatingBar({ rating, color, index }: { rating: CompanyRating; color: string; index: number }) {
  const reduce = useReducedMotion();
  const fraction = Math.max(0, Math.min(1, rating.score / rating.scale));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Star className="w-3.5 h-3.5" style={{ color, fill: color }} />
        <a
          href={rating.url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          {rating.source}
          <ExternalLink className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
        </a>
        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
          {rating.score.toFixed(1)}
          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}> / {rating.scale}</span>
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "var(--muted)", overflow: "hidden" }}>
        <motion.div
          style={{ height: "100%", borderRadius: 99, background: color }}
          initial={{ width: reduce ? `${fraction * 100}%` : 0 }}
          animate={{ width: `${fraction * 100}%` }}
          transition={{ duration: 0.8, delay: 0.15 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {rating.reviewCount != null && (
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Users className="w-3 h-3" /> {fmtCount(rating.reviewCount)} reviews{rating.asOf ? ` · ${rating.asOf}` : ""}
        </span>
      )}
    </div>
  );
}

export function RatingsPanel({ ratings, summary }: { ratings: CompanyRating[]; summary?: string }) {
  // Defensive: tolerate cached/seed data that wasn't normalized client-side.
  const valid = (ratings ?? []).filter(
    (r) => r && Number.isFinite(r.score) && Number.isFinite(r.scale) && r.scale > 0 && typeof r.url === "string" && r.url,
  );
  // Composite = average normalized score, expressed back on a 5-point scale.
  const avgFraction = valid.length ? valid.reduce((s, r) => s + r.score / r.scale, 0) / valid.length : 0;
  const composite5 = useCountUp(avgFraction * 5);

  if (!valid.length) return null;

  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={Star} color="#E8B948" title="Employee ratings" />
      <div style={{ padding: "20px 22px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <CompositeRing fraction={avgFraction} label={composite5.toFixed(1)} sub="avg / 5" />
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            across {valid.length} source{valid.length > 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 16, minWidth: 240 }}>
          {valid.map((r, i) => (
            <RatingBar key={`${r.source}-${i}`} rating={r} color={colorFor(r.source, i)} index={i} />
          ))}
        </div>
      </div>
      {summary && (
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, padding: "0 22px 18px", lineHeight: 1.55 }}>{summary}</p>
      )}
    </MentorCard>
  );
}
