import { ArrowRight } from "lucide-react";
import { steps } from "./content";
import { useReveal } from "./useMotion";
import type { OpenAuth } from "./types";

// Three small original illustrations, one per step — replacing generic icon
// badges with the same "real picture, not a stock glyph" language used
// everywhere else on the page. Same card-with-shadow family, distinct scene.
const ART_SHADOW = (
  <filter id="step-art-shadow" x="-60%" y="-60%" width="220%" height="220%">
    <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#2a2823" floodOpacity="0.16" />
  </filter>
);

/** Step 1 — a fresh account: an avatar card with a checkmark just landed. */
function AccountArt() {
  return (
    <svg viewBox="0 0 120 120" className="w-24 h-24" aria-hidden="true">
      <defs>{ART_SHADOW}</defs>
      <g filter="url(#step-art-shadow)">
        <rect x="18" y="20" width="84" height="72" rx="14" fill="var(--card)" stroke="var(--border)" />
        <circle cx="46" cy="50" r="14" fill="var(--lp-mauve)" />
        <path
          d="M32 78c2-11 10-16 14-16s12 5 14 16"
          fill="none"
          stroke="var(--lp-mauve)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <rect x="70" y="42" width="20" height="6" rx="3" fill="var(--border)" />
        <rect x="70" y="54" width="14" height="6" rx="3" fill="var(--border)" />
      </g>
      <g filter="url(#step-art-shadow)">
        <circle cx="94" cy="86" r="18" fill="var(--primary)" />
        <path
          d="M85 86l6 6 12-13"
          fill="none"
          stroke="var(--primary-foreground)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** Step 2 — choosing from several tools; one is selected and highlighted. */
function PickToolArt() {
  const tiles = [
    { x: 22, y: 22, fill: "var(--lp-cool)" },
    { x: 66, y: 22, fill: "var(--lp-mauve)" },
    { x: 22, y: 66, fill: "var(--forest)", opacity: 0.25 },
    { x: 66, y: 66, fill: "var(--border)" },
  ];
  return (
    <svg viewBox="0 0 120 120" className="w-24 h-24" aria-hidden="true">
      <defs>{ART_SHADOW}</defs>
      {tiles.map((t, i) => (
        <rect
          key={i}
          x={t.x}
          y={t.y}
          width="32"
          height="32"
          rx="9"
          fill={t.fill}
          opacity={t.opacity ?? 1}
        />
      ))}
      <g filter="url(#step-art-shadow)">
        <rect
          x="60"
          y="60"
          width="40"
          height="40"
          rx="11"
          fill="var(--card)"
          stroke="var(--primary)"
          strokeWidth="3"
        />
        <path
          d="M72 80l6 6 12-13"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** Step 3 — concrete guidance: a checklist with a real number, not a platitude. */
function ActOnSpecificsArt() {
  return (
    <svg viewBox="0 0 120 120" className="w-24 h-24" aria-hidden="true">
      <defs>{ART_SHADOW}</defs>
      <g filter="url(#step-art-shadow)">
        <rect x="16" y="18" width="88" height="76" rx="14" fill="var(--card)" stroke="var(--border)" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(30 ${36 + i * 18})`}>
            <rect
              width="14"
              height="14"
              rx="4"
              fill={i < 2 ? "var(--forest)" : "none"}
              stroke={i < 2 ? "none" : "var(--muted-foreground)"}
              strokeWidth="1.5"
            />
            {i < 2 && (
              <path
                d="M3 7.5L6 10.5L11 4"
                fill="none"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <rect x="22" y="3" width={48 - i * 10} height="8" rx="4" fill="var(--border)" />
          </g>
        ))}
      </g>
      <g filter="url(#step-art-shadow)">
        <rect x="70" y="14" width="34" height="22" rx="8" fill="var(--primary)" />
        <text
          x="87"
          y="29"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill="var(--primary-foreground)"
        >
          +12%
        </text>
      </g>
    </svg>
  );
}

const STEP_ART = [AccountArt, PickToolArt, ActOnSpecificsArt];

interface HowItWorksProps {
  openAuth: OpenAuth;
}

export function HowItWorks({ openAuth }: HowItWorksProps) {
  const { ref, isVisible } = useReveal<HTMLDivElement>();

  return (
    <section
      id="how-it-works"
      className="py-28"
      style={{
        background: "var(--paper)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <p className="eyebrow-plain justify-center mb-4">How It Works</p>
          <h2 className="font-display text-4xl font-medium tracking-tight">
            Get results in minutes, not weeks
          </h2>
        </div>

        <div ref={ref} className="relative">
          {/* Connecting line (horizontal on md+, vertical on mobile) */}
          <div
            className="hidden md:block absolute left-0 right-0 top-12 h-px"
            style={{ background: "var(--border)" }}
            aria-hidden="true"
          />
          <ol className="grid md:grid-cols-3 gap-10 md:gap-8 relative">
            {steps.map((step, i) => (
              <li
                key={step.number}
                className="reveal relative text-center flex flex-col items-center"
                data-revealed={isVisible ? "" : undefined}
                style={{ ["--i" as string]: i }}
              >
                {/* Oversized ghost numeral — a decorative editorial flourish
                    that overlaps into the whitespace above; purely visual. */}
                <span
                  aria-hidden="true"
                  className="font-display absolute -top-10 left-1/2 -translate-x-1/2 text-8xl font-medium select-none pointer-events-none z-0"
                  style={{ color: "var(--primary)", opacity: 0.12 }}
                >
                  {step.number}
                </span>
                <div className="mb-5 relative z-10">
                  {(() => {
                    const Art = STEP_ART[i];
                    return <Art />;
                  })()}
                </div>
                <div className="eyebrow mb-2" style={{ color: "var(--primary)" }}>
                  Step {step.number}
                </div>
                <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="text-center mt-14">
          <button
            onClick={() => openAuth()}
            className="inline-flex items-center gap-2 font-medium px-6 py-3 rounded-md hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              ["--tw-ring-color" as string]: "var(--ring)",
            }}
          >
            Try it now — it's free <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
