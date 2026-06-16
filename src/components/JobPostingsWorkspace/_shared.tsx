import React, { useState, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { scoreJobFit, fitLabel, RECOMMENDED_THRESHOLD, type ScorableJob } from "@/services/jobRecommendation";
import { companyLogoSources, companyMonogram } from "@/lib/companyLogo";

/* ── SectionHeading ─────────────────────────────────────────────────────── */
export function SectionHeading({
  icon: Icon, title, sub, noMargin,
}: {
  icon: React.ElementType;
  title: string;
  sub?: string;
  noMargin?: boolean;
}) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon className="w-4 h-4" style={{ color: "var(--primary)" }} />
        <h3 className="font-display" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)", margin: 0 }}>{title}</h3>
      </div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3, marginLeft: 24 }}>{sub}</div>}
    </div>
  );
}

/* ── Label ──────────────────────────────────────────────────────────────── */
export function Label({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      <Icon className="w-3.5 h-3.5" /> {text}
    </div>
  );
}

/* ── CompanyLogo ────────────────────────────────────────────────────────── */
export function CompanyLogo({ company, url, size = 40 }: { company?: string; url?: string; size?: number }) {
  const sources = useMemo(() => companyLogoSources(company, url), [company, url]);
  const [idx, setIdx] = useState(0);
  React.useEffect(() => { setIdx(0); }, [company, url]);
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
    <img src={src} alt={company ? `${company} logo` : "Company logo"} width={size} height={size} loading="lazy"
      onError={() => setIdx((i) => i + 1)}
      style={{ width: size, height: size, flexShrink: 0, borderRadius: radius, objectFit: "contain", background: "#fff", border: "1px solid var(--border)", padding: 4 }} />
  );
}

/* ── FitBreakdown ───────────────────────────────────────────────────────── */
export function FitBreakdown({ posting, profile }: { posting: ScorableJob; profile: ReturnType<typeof useUserProfile>["profile"] }) {
  const fit = useMemo(() => scoreJobFit(posting, profile), [posting, profile]);
  const label = fitLabel(fit.score);
  const strong = fit.score >= RECOMMENDED_THRESHOLD;
  const barColor = (s: number) => (s >= 60 ? "var(--primary)" : s >= 35 ? "#F59E0B" : "var(--muted-foreground)");

  return (
    <section style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{
          flexShrink: 0, width: 60, height: 60, borderRadius: 14, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: strong ? "rgba(217,119,87,0.12)" : "var(--card)",
          border: `1px solid ${strong ? "rgba(217,119,87,0.30)" : "var(--border)"}`,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, color: strong ? "var(--primary)" : "var(--foreground)" }}>{fit.score}<span style={{ fontSize: 11 }}>%</span></div>
          <div className="eyebrow" style={{ fontSize: 8, marginTop: 2 }}>fit</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{label}</h3>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3 }}>
            How well this posting matches your profile, skills, experience &amp; work history.
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {fit.factors.map((f) => (
          <div key={f.key}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                {f.label}
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}> · {f.weight}% of score</span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: barColor(f.score) }}>{f.score}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 9999, background: "var(--card)", border: "1px solid var(--border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${f.score}%`, background: barColor(f.score), borderRadius: 9999, transition: "width 300ms ease" }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.5 }}>{f.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
