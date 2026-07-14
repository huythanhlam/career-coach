import {
  FileText,
  Mic,
  LineChart,
  DollarSign,
  Check,
  Star,
  Target,
  PenTool,
  ShieldCheck,
  Zap,
  Building,
  ExternalLink,
} from "lucide-react";
import { typewriter } from "./demoTimeline";

// Simplified recreations of real product screens, driven by a 0..1 `progress`.
// They use the app's own theme tokens so the hero demo genuinely looks like the
// product. Decorative by design — the demo wrapper marks them aria-hidden.

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Map a sub-window [start,end] of the scene's progress to its own 0..1 range. */
function seg(p: number, start: number, end: number): number {
  return clamp01((p - start) / (end - start));
}

function SceneShell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="h-full w-full flex flex-col p-4 sm:p-6"
      style={{ background: "var(--background)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "color-mix(in srgb, var(--primary) 15%, transparent)" }}
        >
          {icon}
        </div>
        <span className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
          {title}
        </span>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

/** Scene 1 — Resume Analyzer: a match score ring counts up and gap chips appear. */
export function ResumeScene({ progress }: { progress: number }) {
  const score = Math.round(seg(progress, 0, 0.55) * 86);
  const r = 34;
  const c = 2 * Math.PI * r;
  const gaps = [
    { label: "Add measurable impact to 3 bullets", w: 0.35 },
    { label: "Match 5 missing keywords", w: 0.55 },
    { label: "Tighten summary to 2 lines", w: 0.75 },
  ];
  return (
    <SceneShell
      icon={<FileText className="w-4 h-4" style={{ color: "var(--primary)" }} />}
      title="Resume Analyzer"
    >
      <div className="flex items-center gap-5 h-full">
        <div className="relative flex-shrink-0" style={{ width: 92, height: 92 }}>
          <svg width="92" height="92" viewBox="0 0 92 92">
            <circle cx="46" cy="46" r={r} fill="none" stroke="var(--muted)" strokeWidth="8" />
            <circle
              cx="46"
              cy="46"
              r={r}
              fill="none"
              stroke="var(--forest)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - score / 100)}
              transform="rotate(-90 46 46)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-display text-2xl font-bold"
              style={{ color: "var(--foreground)" }}
            >
              {score}
            </span>
            <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              match
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
            Top fixes to raise your score
          </div>
          {gaps.map((g, i) => {
            const shown = seg(progress, 0.45 + i * 0.12, 0.6 + i * 0.12);
            return (
              <div
                key={g.label}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  opacity: shown,
                  transform: `translateX(${(1 - shown) * 8}px)`,
                }}
              >
                <span
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(232,185,72,0.18)" }}
                >
                  <Check className="w-2.5 h-2.5" style={{ color: "#b8860b" }} />
                </span>
                <span className="text-xs truncate" style={{ color: "var(--foreground)" }}>
                  {g.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
}

/** Scene 2 — Mock Interview: a question, a streamed STAR answer, then a rating. */
export function InterviewScene({ progress }: { progress: number }) {
  const full =
    "When our launch slipped, I regrouped the team around the two blockers, cut scope on the rest, and shipped the core flow in a week.";
  const typed = typewriter(full, seg(progress, 0.18, 0.9));
  const showRating = seg(progress, 0.88, 1) > 0.5;
  return (
    <SceneShell
      icon={<Mic className="w-4 h-4" style={{ color: "var(--primary)" }} />}
      title="Mock Interview"
    >
      <div className="flex flex-col gap-3 h-full">
        <div
          className="rounded-xl rounded-tl-sm px-3 py-2 text-xs max-w-[85%]"
          style={{ background: "var(--muted)", color: "var(--foreground)" }}
        >
          Tell me about a time you led through ambiguity.
        </div>
        <div
          className="rounded-xl rounded-tr-sm px-3 py-2 text-xs self-end max-w-[90%]"
          style={{
            background: "color-mix(in srgb, var(--primary) 15%, transparent)",
            color: "var(--foreground)",
            minHeight: 54,
          }}
        >
          {typed}
          <span style={{ opacity: typed.length < full.length ? 1 : 0, color: "var(--primary)" }}>
            ▍
          </span>
        </div>
        <div
          className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{
            background: "rgba(47,107,79,0.1)",
            color: "var(--forest)",
            opacity: showRating ? 1 : 0,
            transform: `translateY(${showRating ? 0 : 6}px)`,
            transition: "opacity 0.2s ease",
          }}
        >
          <Star className="w-3 h-3 fill-current" /> Strong STAR answer · 4.6 / 5
        </div>
      </div>
    </SceneShell>
  );
}

/** Scene 3 — Market Data: salary-band bars grow in with a p50 marker. */
export function MarketScene({ progress }: { progress: number }) {
  const bands = [
    { label: "p10", value: "$150k", frac: 0.62, color: "var(--muted-foreground)" },
    { label: "p50", value: "$182k", frac: 0.78, color: "var(--primary)" },
    { label: "p90", value: "$224k", frac: 1.0, color: "var(--forest)" },
  ];
  return (
    <SceneShell
      icon={<LineChart className="w-4 h-4" style={{ color: "var(--primary)" }} />}
      title="Market Compensation"
    >
      <div className="flex flex-col h-full">
        <div className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
          Senior Product Manager · San Francisco
        </div>
        <div className="flex-1 flex flex-col justify-center gap-3">
          {bands.map((b, i) => {
            const grow = seg(progress, 0.1 + i * 0.15, 0.55 + i * 0.15);
            const highlight = b.label === "p50";
            return (
              <div key={b.label} className="flex items-center gap-2">
                <span
                  className="text-[11px] w-7 flex-shrink-0"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {b.label}
                </span>
                <div
                  className="flex-1 h-6 rounded-md overflow-hidden"
                  style={{ background: "var(--muted)" }}
                >
                  <div
                    className="h-full rounded-md flex items-center justify-end pr-2"
                    style={{
                      width: `${b.frac * grow * 100}%`,
                      background: highlight ? "var(--primary)" : `${String(b.color)}`,
                      opacity: highlight ? 1 : 0.5,
                    }}
                  >
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: highlight ? "#fff" : "transparent" }}
                    >
                      {b.value}
                    </span>
                  </div>
                </div>
                <span
                  className="text-[11px] font-semibold w-11 text-right flex-shrink-0"
                  style={{ color: highlight ? "var(--primary)" : "var(--muted-foreground)" }}
                >
                  {b.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
}

/** Scene 4 — Salary Negotiator: a counter-offer script reveals line by line. */
export function SalaryScene({ progress }: { progress: number }) {
  const lines = [
    "Thanks — I'm excited about the role and the team.",
    "Based on market data for this level in SF, I'd expect $195k base.",
    "Given my track record shipping revenue features, can we close that gap?",
    "I'm confident we can find a number that works for both of us.",
  ];
  return (
    <SceneShell
      icon={<DollarSign className="w-4 h-4" style={{ color: "var(--primary)" }} />}
      title="Salary Negotiator"
    >
      <div className="flex flex-col gap-2 h-full justify-center">
        <div className="text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
          Your counter-offer script
        </div>
        {lines.map((line, i) => {
          const shown = seg(progress, 0.1 + i * 0.2, 0.28 + i * 0.2);
          return (
            <div
              key={i}
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                opacity: shown,
                transform: `translateY(${(1 - shown) * 6}px)`,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </SceneShell>
  );
}

// The five scenes below are static (no `progress` animation — they only ever
// appear resolved, as a feature-card thumbnail, never in the hero timeline)
// but still take an optional `progress` prop so every scene shares one call
// signature and the card grid never needs a conditional per id.

/** Goal Planning: a week-by-week roadmap, two weeks done, one in progress. */
export function GoalPlanScene({ progress: _progress }: { progress?: number }) {
  const weeks = [
    { label: "Audit your skills gap", done: true },
    { label: "Ship a portfolio piece", done: true },
    { label: "Apply to 10 target roles", done: false, current: true },
    { label: "Run the interview loop", done: false },
  ];
  return (
    <SceneShell icon={<Target className="w-4 h-4" style={{ color: "var(--primary)" }} />} title="Goal Plan">
      <div className="flex flex-col gap-2 h-full justify-center">
        {weeks.map((w, i) => (
          <div key={w.label} className="flex items-center gap-2.5">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
              style={{
                background: w.done ? "#3B82F6" : w.current ? "rgba(59,130,246,0.15)" : "var(--muted)",
                color: w.done ? "#fff" : w.current ? "#3B82F6" : "var(--muted-foreground)",
                border: w.current ? "1.5px solid #3B82F6" : "none",
              }}
            >
              {w.done ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            <span
              className="text-xs"
              style={{
                color: w.current ? "var(--foreground)" : "var(--muted-foreground)",
                fontWeight: w.current ? 600 : 400,
              }}
            >
              {w.label}
            </span>
          </div>
        ))}
      </div>
    </SceneShell>
  );
}

/** Resume Generation: a document preview with a template selector strip. */
export function ResumeGenScene({ progress: _progress }: { progress?: number }) {
  const lineWidths = [88, 72, 95, 60, 80];
  return (
    <SceneShell
      icon={<PenTool className="w-4 h-4" style={{ color: "var(--primary)" }} />}
      title="Resume Builder"
    >
      <div className="flex flex-col h-full">
        <div
          className="flex-1 rounded-lg p-3 min-h-0"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="h-2.5 w-2/5 rounded mb-2" style={{ background: "var(--foreground)" }} />
          <div className="h-1.5 w-1/4 rounded mb-3" style={{ background: "var(--primary)" }} />
          {lineWidths.map((w, i) => (
            <div
              key={i}
              className="h-1.5 rounded mb-1.5"
              style={{ width: `${w}%`, background: "var(--muted)" }}
            />
          ))}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-3 flex-shrink-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: i === 2 ? 16 : 6,
                height: 6,
                background: i === 2 ? "var(--primary)" : "var(--border)",
              }}
            />
          ))}
        </div>
      </div>
    </SceneShell>
  );
}

/** LinkedIn Optimizer: a headline rewrite with keyword chips surfacing below. */
export function LinkedInScene({ progress: _progress }: { progress?: number }) {
  const keywords = ["Product Manager", "0→1", "B2B SaaS", "Growth"];
  return (
    <SceneShell
      icon={<ShieldCheck className="w-4 h-4" style={{ color: "var(--primary)" }} />}
      title="LinkedIn Optimizer"
    >
      <div className="flex flex-col gap-3 h-full justify-center">
        <div className="flex items-center gap-2.5">
          <span
            className="w-9 h-9 rounded-full flex-shrink-0"
            style={{ background: "#0A66C2", opacity: 0.15 }}
          />
          <div
            className="flex-1 rounded-lg px-3 py-2 text-xs"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            Product Manager turning 0→1 ideas into shipped, revenue-generating features.
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pl-[46px]">
          {keywords.map((k) => (
            <span
              key={k}
              className="text-[10px] font-semibold px-2 py-1 rounded-full"
              style={{ background: "rgba(10,102,194,0.1)", color: "#0A66C2" }}
            >
              {k}
            </span>
          ))}
        </div>
      </div>
    </SceneShell>
  );
}

/** Job-search plan: today's short list, one task already done. */
export function JobPlanScene({ progress: _progress }: { progress?: number }) {
  const tasks = [
    { label: "Tailor resume for Acme Corp", done: true },
    { label: "Practice 2 behavioral questions", done: false },
    { label: "Follow up with referral", done: false },
  ];
  return (
    <SceneShell icon={<Zap className="w-4 h-4" style={{ color: "var(--primary)" }} />} title="Today's Plan">
      <div className="flex flex-col gap-2 h-full justify-center">
        {tasks.map((t) => (
          <div
            key={t.label}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <span
              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
              style={{
                background: t.done ? "#8B5CF6" : "transparent",
                border: t.done ? "none" : "1.5px solid var(--border)",
              }}
            >
              {t.done && <Check className="w-2.5 h-2.5 text-white" />}
            </span>
            <span
              className="text-xs"
              style={{
                color: t.done ? "var(--muted-foreground)" : "var(--foreground)",
                textDecoration: t.done ? "line-through" : "none",
              }}
            >
              {t.label}
            </span>
          </div>
        ))}
      </div>
    </SceneShell>
  );
}

/** Company Research: a company card with a couple of sourced findings. */
export function CompanyResearchScene({ progress: _progress }: { progress?: number }) {
  const findings = ["Series C · $80M raised", "Engineering values async work", "3 recruiters posted this week"];
  return (
    <SceneShell
      icon={<Building className="w-4 h-4" style={{ color: "var(--primary)" }} />}
      title="Company Research"
    >
      <div className="flex flex-col gap-3 h-full justify-center">
        <div className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(232,185,72,0.18)" }}
          >
            <Building className="w-4 h-4" style={{ color: "#b8860b" }} />
          </span>
          <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
            Acme Corp
          </span>
        </div>
        <div className="space-y-1.5">
          {findings.map((f) => (
            <div key={f} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--foreground)" }}>
              <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
              {f}
            </div>
          ))}
        </div>
      </div>
    </SceneShell>
  );
}
