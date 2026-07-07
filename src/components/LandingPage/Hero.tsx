import { Zap, ArrowRight, ChevronRight } from "lucide-react";
import { ProductDemo } from "./ProductDemo";
import { proofPoints } from "./content";
import type { OpenAuth } from "./types";

interface HeroProps {
  openAuth: OpenAuth;
  heroCtaRef: React.RefObject<HTMLButtonElement | null>;
}

export function Hero({ openAuth, heroCtaRef }: HeroProps) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 text-center">
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
        style={{
          background: "rgba(217,119,87,0.1)",
          color: "var(--primary)",
          border: "1px solid rgba(217,119,87,0.2)",
        }}
      >
        <Zap className="w-3 h-3" /> Powered by Gemini AI · Free to start
      </div>

      <h1
        className="font-display text-4xl sm:text-6xl lg:text-7xl font-semibold leading-tight mb-6"
        style={{ color: "var(--foreground)" }}
      >
        Land your dream <span style={{ color: "var(--primary)" }}>job</span>
        <br />
        with an AI career coach
      </h1>

      <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-9 leading-relaxed">
        Specific, data-backed coaching for every step of the search — analyze your resume, rehearse
        the interview, and walk into the negotiation with a script. Not generic career advice.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
        <button
          ref={heroCtaRef}
          onClick={() => openAuth()}
          className="flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl text-white transition-all hover:opacity-90 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            background: "var(--primary)",
            boxShadow: "0 12px 40px rgba(217,119,87,0.35)",
            ["--tw-ring-color" as string]: "var(--ring)",
          }}
        >
          Start free <ArrowRight className="w-4 h-4" />
        </button>
        <a
          href="#features"
          className="flex items-center gap-2 text-base font-medium px-8 py-4 rounded-2xl transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2"
          style={{
            border: "1px solid var(--border)",
            ["--tw-ring-color" as string]: "var(--ring)",
          }}
        >
          See all features <ChevronRight className="w-4 h-4" />
        </a>
      </div>

      {/* Honest social-proof strip (replaces the old fabricated stat wall) */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground mb-12">
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

      {/* The product demo — show, don't just tell */}
      <ProductDemo />
    </section>
  );
}
