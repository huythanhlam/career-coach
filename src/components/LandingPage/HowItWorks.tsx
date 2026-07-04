import { ArrowRight } from "lucide-react";
import { steps } from "./content";
import { useReveal } from "./useMotion";
import type { OpenAuth } from "./types";

interface HowItWorksProps {
  openAuth: OpenAuth;
}

export function HowItWorks({ openAuth }: HowItWorksProps) {
  const { ref, isVisible } = useReveal<HTMLDivElement>();

  return (
    <section
      id="how-it-works"
      className="py-20"
      style={{
        background: "var(--paper)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="eyebrow mb-3">How It Works</p>
          <h2 className="font-display text-4xl font-semibold">Get results in minutes, not weeks</h2>
        </div>

        <div ref={ref} className="relative">
          {/* Connecting line (horizontal on md+, vertical on mobile) */}
          <div
            className="hidden md:block absolute left-0 right-0 top-7 h-px"
            style={{ background: "var(--border)" }}
            aria-hidden="true"
          />
          <ol className="grid md:grid-cols-3 gap-10 md:gap-8 relative">
            {steps.map((step, i) => (
              <li
                key={step.number}
                className="reveal text-center flex flex-col items-center"
                data-revealed={isVisible ? "" : undefined}
                style={{ ["--i" as string]: i }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-5 relative z-10"
                  style={{
                    background: "var(--card)",
                    border: "2px solid var(--primary)",
                    color: "var(--primary)",
                  }}
                >
                  <step.icon className="w-6 h-6" />
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
            className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: "var(--primary)", ["--tw-ring-color" as string]: "var(--ring)" }}
          >
            Try it now — it's free <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
