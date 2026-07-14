import { ArrowRight, ChevronRight } from "lucide-react";
import { ProductDemo } from "./ProductDemo";
import { proofPoints } from "./content";
import { useMounted } from "./useMotion";
import type { OpenAuth } from "./types";

interface HeroProps {
  openAuth: OpenAuth;
  heroCtaRef: React.RefObject<HTMLButtonElement | null>;
}

export function Hero({ openAuth, heroCtaRef }: HeroProps) {
  const mounted = useMounted();
  // A merge-friendly fade-in-up: appends the class and folds --i into any
  // existing inline style, so callers keep their own className/style intact.
  const fadeUp = (i: number, style?: React.CSSProperties) => ({
    "data-mounted": mounted ? "" : undefined,
    style: { ...style, ["--i" as string]: i },
  });

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-20 text-center">
      <p className="eyebrow-plain fade-in-up justify-center mb-7" {...fadeUp(0)}>
        Powered by Gemini AI · Free while in beta
      </p>

      <h1
        className="font-hero fade-in-up text-4xl sm:text-6xl lg:text-7xl leading-[1.05] mb-6 tracking-tight"
        {...fadeUp(1, { color: "var(--foreground)" })}
      >
        Land your dream <span className="marker-highlight">job</span>
        <br />
        with an AI career coach
      </h1>

      <p
        className="fade-in-up text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-9 leading-relaxed"
        {...fadeUp(2)}
      >
        Specific, data-backed coaching for every step of the search — analyze your resume, rehearse
        the interview, and walk into the negotiation with a script. Not generic career advice.
      </p>

      <div
        className="fade-in-up flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
        {...fadeUp(3)}
      >
        <button
          ref={heroCtaRef}
          onClick={() => openAuth()}
          className="flex items-center gap-2 text-base font-medium px-7 py-3.5 rounded-md transition-all hover:opacity-90 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            boxShadow: "0 8px 24px rgba(240,182,58,0.35)",
            ["--tw-ring-color" as string]: "var(--ring)",
          }}
        >
          Start free <ArrowRight className="w-4 h-4" />
        </button>
        <a
          href="#features"
          className="flex items-center gap-2 text-base font-medium px-7 py-3.5 rounded-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2"
          style={{
            border: "1px solid var(--border)",
            ["--tw-ring-color" as string]: "var(--ring)",
          }}
        >
          See all features <ChevronRight className="w-4 h-4" />
        </a>
      </div>

      {/* Honest social-proof strip (replaces the old fabricated stat wall) */}
      <div
        className="fade-in-up flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground mb-14"
        {...fadeUp(4)}
      >
        {proofPoints.map((p, i) => (
          <span key={p} className="inline-flex items-center gap-3">
            {i > 0 && (
              <span aria-hidden="true" style={{ color: "var(--border)" }}>
                ·
              </span>
            )}
            {p}
          </span>
        ))}
      </div>

      {/* The product demo — show, don't just tell. A soft ambient glow behind
          it breaks up the otherwise flat cream field with a little depth. */}
      <div className="fade-in-up relative" {...fadeUp(5)}>
        <div
          aria-hidden="true"
          className="absolute -inset-x-10 -top-16 -bottom-16 -z-10 blur-3xl"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 30%, rgba(240,182,58,0.35), rgba(221,226,226,0.4) 55%, transparent 75%)",
          }}
        />
        <ProductDemo />
      </div>
    </section>
  );
}
