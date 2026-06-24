import { CheckCircle2, XCircle, AlertTriangle, Scan, Wrench } from "lucide-react";
import type { ScreeningResult, ScreeningVerdict, FixPriority } from "@/types/screening";
import { VERDICT_LABELS } from "@/types/screening";

// Visual treatment per verdict — reuses the app's terracotta / forest / amber palette.
const verdictStyle: Record<
  ScreeningVerdict,
  { color: string; bg: string; border: string; icon: typeof CheckCircle2; blurb: string }
> = {
  advance: {
    color: "var(--forest)",
    bg: "rgba(47,107,79,0.10)",
    border: "rgba(47,107,79,0.30)",
    icon: CheckCircle2,
    blurb: "A recruiter would likely move this forward.",
  },
  borderline: {
    color: "#9A7B1F",
    bg: "rgba(232,185,72,0.14)",
    border: "rgba(232,185,72,0.40)",
    icon: AlertTriangle,
    blurb: "This could go either way — a few fixes tip it toward advance.",
  },
  reject: {
    color: "var(--primary)",
    bg: "rgba(217,119,87,0.12)",
    border: "rgba(217,119,87,0.35)",
    icon: XCircle,
    blurb: "A recruiter would likely cut this in the first pass.",
  },
};

const priorityStyle: Record<FixPriority, React.CSSProperties> = {
  high: { background: "rgba(217,119,87,0.15)", border: "1px solid rgba(217,119,87,0.40)", color: "var(--primary)" },
  medium: { background: "rgba(110,101,87,0.10)", border: "1px solid rgba(110,101,87,0.25)", color: "var(--muted-foreground)" },
  low: { background: "rgba(110,101,87,0.05)", border: "1px solid rgba(110,101,87,0.15)", color: "var(--muted-foreground)" },
};

interface ScreeningVerdictProps {
  result: ScreeningResult;
  /** Optional CTA to hand the fixes off to the tailoring flow. */
  onTailor?: () => void;
}

export function ScreeningVerdictView({ result, onTailor }: ScreeningVerdictProps) {
  const v = verdictStyle[result.verdict];
  const Icon = v.icon;

  return (
    <div className="flex flex-col gap-4">
      {/* Verdict header */}
      <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: v.bg, border: `1px solid ${v.border}` }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--card)", color: v.color }}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-semibold" style={{ color: v.color }}>
              {VERDICT_LABELS[result.verdict]}
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: "var(--card)", color: v.color, border: `1px solid ${v.border}` }}>
              {result.score}/100
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{v.blurb}</p>
        </div>
      </div>

      {result.summary && (
        <p className="text-sm leading-relaxed px-1" style={{ color: "var(--foreground)" }}>{result.summary}</p>
      )}

      {/* Knockouts */}
      {result.knockouts.length > 0 && (
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Scan className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Must-have requirements</span>
          </div>
          <div className="flex flex-col gap-2">
            {result.knockouts.map((k, i) => (
              <div key={i} className="flex items-start gap-2.5">
                {k.met ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--forest)" }} />
                ) : (
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{k.requirement}</div>
                  {k.evidence && <div className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{k.evidence}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing keywords */}
      {result.missingKeywords.length > 0 && (
        <div className="rounded-2xl p-4 flex flex-col gap-2.5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Missing keywords</span>
          <div className="flex flex-wrap gap-1.5">
            {result.missingKeywords.map((kw, i) => (
              <span key={i} className="text-[11px] font-medium px-2 py-1 rounded-md" style={{ background: "rgba(217,119,87,0.08)", color: "var(--primary)", border: "1px solid rgba(217,119,87,0.20)" }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Prioritized fixes */}
      {result.fixes.length > 0 && (
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>How to clear the screen</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {result.fixes.map((f, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide" style={priorityStyle[f.priority]}>
                    {f.priority}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{f.label}</span>
                </div>
                {f.detail && <p className="text-[11px] leading-relaxed pl-1" style={{ color: "var(--muted-foreground)" }}>{f.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {onTailor && (
        <button
          onClick={onTailor}
          className="h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
          style={{ background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer" }}
        >
          <Wrench className="w-4 h-4" /> Tailor my resume to fix these
        </button>
      )}
    </div>
  );
}
