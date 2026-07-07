import { ChevronRight } from "lucide-react";
import { marqueeFeatures, featuresByStage, type Feature, type VignetteId } from "./content";
import { ResumeScene, InterviewScene, MarketScene, SalaryScene } from "./scenes";
import { useReveal } from "./useMotion";
import type { OpenAuth } from "./types";

// A resolved (progress = 1) mini-screenshot of the tool, reusing the very same
// scene primitives the hero demo animates. Decorative — aria-hidden.
function Vignette({ id }: { id: VignetteId }) {
  const scene =
    id === "resume" ? (
      <ResumeScene progress={1} />
    ) : id === "interview" ? (
      <InterviewScene progress={1} />
    ) : id === "market" ? (
      <MarketScene progress={1} />
    ) : (
      <SalaryScene progress={1} />
    );
  return (
    <div
      aria-hidden="true"
      className="rounded-xl overflow-hidden mb-5"
      style={{ height: 190, border: "1px solid var(--border)" }}
    >
      {scene}
    </div>
  );
}

function StagePill({ stage }: { stage: Feature["stage"] }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
    >
      {stage}
    </span>
  );
}

interface FeaturesProps {
  openAuth: OpenAuth;
}

export function Features({ openAuth }: FeaturesProps) {
  const { ref, isVisible } = useReveal<HTMLDivElement>();
  const marquee = marqueeFeatures();
  const marqueeIds = new Set(marquee.map((f) => f.id));
  const rest = featuresByStage().flatMap((g) => g.features.filter((f) => !marqueeIds.has(f.id)));

  return (
    <section id="features" className="py-24 max-w-6xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-14">
        <p className="eyebrow mb-3">Features</p>
        <h2 className="font-display text-4xl font-semibold">Every step of the search, covered</h2>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
          Ten specialized AI coaches spanning Plan, Apply, Practice, and Research. Click any tool to
          try it free.
        </p>
      </div>

      <div ref={ref}>
        {/* Marquee bento — the four flagship tools, each with a live UI preview */}
        <div className="grid md:grid-cols-2 gap-5 mb-5">
          {marquee.map((f, i) => (
            <button
              key={f.id}
              onClick={() => openAuth(f.tab)}
              data-revealed={isVisible ? "" : undefined}
              className="reveal text-left rounded-2xl p-6 border transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 group"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                ["--i" as string]: i,
                ["--tw-ring-color" as string]: "var(--ring)",
              }}
            >
              <Vignette id={f.vignette!} />
              <div className="flex items-center gap-2 mb-2">
                <StagePill stage={f.stage} />
              </div>
              <h3 className="font-semibold text-lg mb-1.5" style={{ color: "var(--foreground)" }}>
                {f.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{f.description}</p>
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: f.color }}
              >
                Try it free <ChevronRight className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>

        {/* The remaining tools — compact, still grouped by stage via a pill */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rest.map((f, i) => (
            <button
              key={f.id}
              onClick={() => openAuth(f.tab)}
              data-revealed={isVisible ? "" : undefined}
              className="reveal text-left rounded-2xl p-5 border transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 group"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                ["--i" as string]: i,
                ["--tw-ring-color" as string]: "var(--ring)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: `${f.color}18` }}
                >
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <StagePill stage={f.stage} />
              </div>
              <h3 className="font-semibold text-base mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{f.description}</p>
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: f.color }}
              >
                Try it free <ChevronRight className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
