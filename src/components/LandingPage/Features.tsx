import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { features, type Feature } from "./content";
import {
  ResumeScene,
  InterviewScene,
  MarketScene,
  SalaryScene,
  GoalPlanScene,
  ResumeGenScene,
  LinkedInScene,
  JobPlanScene,
  CompanyResearchScene,
} from "./scenes";
import { useReveal } from "./useMotion";
import type { OpenAuth } from "./types";

// Every feature gets a real picture — a mini recreation of its actual screen —
// not a decorative icon. Keyed by feature id so the mapping stays explicit
// even as features.ts evolves independently of this file.
const SCENE_BY_ID: Record<string, React.ComponentType<{ progress: number }>> = {
  goal_planning: GoalPlanScene,
  resume_generation: ResumeGenScene,
  resume: ResumeScene,
  linkedin: LinkedInScene,
  mock_behavioral: InterviewScene,
  interview: JobPlanScene,
  market: MarketScene,
  salary: SalaryScene,
  company_research: CompanyResearchScene,
};

function StageLabel({ stage, color }: { stage: Feature["stage"]; color: string }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
      {stage}
    </span>
  );
}

const CARD_WIDTH = 300;

// A single carousel card — the tool's actual screen up top, plain-label copy
// below. No icon chips, no pill badges: the picture does the convincing.
function FeatureCard({
  f,
  i,
  isVisible,
  onClick,
}: {
  f: Feature;
  i: number;
  isVisible: boolean;
  onClick: () => void;
}) {
  const Scene = SCENE_BY_ID[f.id];
  return (
    <button
      onClick={onClick}
      data-revealed={isVisible ? "" : undefined}
      className={`reveal snap-start flex-shrink-0 text-left rounded-lg border overflow-hidden transition-all duration-300 ease-out hover:shadow-[0_16px_40px_rgba(42,40,35,0.1)] hover:-translate-y-1 ${i % 2 === 0 ? "hover:-rotate-1" : "hover:rotate-1"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 group`}
      style={{
        width: CARD_WIDTH,
        background: "var(--card)",
        borderColor: "var(--border)",
        ["--i" as string]: i,
        ["--tw-ring-color" as string]: "var(--primary)",
      }}
    >
      <div
        aria-hidden="true"
        className="relative overflow-hidden transition-transform duration-500 ease-out group-hover:scale-[1.02]"
        style={{ height: 190, background: `${f.color}12`, borderBottom: "1px solid var(--border)" }}
      >
        {Scene && <Scene progress={1} />}
      </div>
      <div className="p-6">
        <div className="mb-2">
          <StageLabel stage={f.stage} color={f.color} />
        </div>
        <h3 className="font-display text-lg mb-1.5" style={{ color: "var(--foreground)" }}>
          {f.title}
        </h3>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--muted-foreground)" }}>
          {f.description}
        </p>
        <span
          className="inline-flex items-center gap-1 text-xs font-semibold transition-transform duration-300 group-hover:translate-x-0.5"
          style={{ color: f.color }}
        >
          Try it free <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}

interface FeaturesProps {
  openAuth: OpenAuth;
}

export function Features({ openAuth }: FeaturesProps) {
  const { ref, isVisible } = useReveal<HTMLDivElement>();
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCard(dir: 1 | -1) {
    scrollerRef.current?.scrollBy({ left: dir * (CARD_WIDTH + 24), behavior: "smooth" });
  }

  return (
    <section id="features" className="py-28" style={{ background: "var(--lp-cool)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
          <div className="text-center sm:text-left">
            <p
              className="eyebrow-plain justify-center sm:justify-start mb-4"
              style={{ color: "var(--muted-foreground)" }}
            >
              Features
            </p>
            <h2
              className="font-display text-4xl tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              Every step of the search, <span className="marker-highlight">covered</span>
            </h2>
            <p className="mt-3 max-w-xl" style={{ color: "var(--muted-foreground)" }}>
              Ten specialized AI coaches spanning Plan, Apply, Practice, and Research. Click any
              tool to try it free.
            </p>
          </div>

          {/* Carousel controls — native touch/trackpad scroll works without
              them, but a mouse-only visitor needs an obvious way to advance. */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              aria-label="Scroll features left"
              className="w-10 h-10 rounded-md flex items-center justify-center transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2"
              style={{
                border: "1px solid var(--border)",
                ["--tw-ring-color" as string]: "var(--primary)",
              }}
            >
              <ChevronLeft className="w-4 h-4" style={{ color: "var(--foreground)" }} />
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              aria-label="Scroll features right"
              className="w-10 h-10 rounded-md flex items-center justify-center transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2"
              style={{
                border: "1px solid var(--border)",
                ["--tw-ring-color" as string]: "var(--primary)",
              }}
            >
              <ChevronRight className="w-4 h-4" style={{ color: "var(--foreground)" }} />
            </button>
          </div>
        </div>
      </div>

      {/* Full-bleed carousel — cards run edge to edge so the next one always
          peeks in at the right, the same "there's more, keep going" cue
          timespent.so uses under its own section header. */}
      <div
        ref={(node) => {
          ref.current = node;
          scrollerRef.current = node;
        }}
        className="overflow-x-auto no-scrollbar snap-x snap-mandatory"
      >
        <div className="flex gap-6 pl-6 pr-4 sm:pl-10 sm:pr-6" style={{ width: "max-content" }}>
          <div
            className="flex-shrink-0"
            style={{ width: "calc((100vw - min(100vw, 72rem)) / 2)" }}
          />
          {features.map((f, i) => (
            <FeatureCard
              key={f.id}
              f={f}
              i={i}
              isVisible={isVisible}
              onClick={() => openAuth(f.tab)}
            />
          ))}
          <div className="flex-shrink-0 w-4 sm:w-6" />
        </div>
      </div>
    </section>
  );
}
