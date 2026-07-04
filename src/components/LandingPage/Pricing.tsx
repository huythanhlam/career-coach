import { Check } from "lucide-react";
import type { OpenAuth } from "./types";

interface PricingProps {
  openAuth: OpenAuth;
}

const INCLUDED = [
  "All 10 AI career tools",
  "Unlimited sessions",
  "Resume builder & analyzer",
  "Company research",
  "Mock interview practice",
  "Salary negotiation scripts",
  "Market compensation data",
];

export function Pricing({ openAuth }: PricingProps) {
  return (
    <section
      id="pricing"
      className="py-20"
      style={{
        background: "var(--paper)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <p className="eyebrow mb-3">Pricing</p>
        <h2 className="font-display text-4xl font-semibold mb-4">Free while in beta</h2>
        <p className="text-muted-foreground mb-12">
          All 10 tools are free during our public beta. No credit card required.
        </p>

        <div
          className="rounded-3xl p-8 border max-w-sm mx-auto"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="font-display text-5xl font-bold mb-1" style={{ color: "var(--primary)" }}>
            $0
          </div>
          <div className="text-muted-foreground text-sm mb-6">Forever free during beta</div>
          <ul className="space-y-3 mb-8 text-left">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm">
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: "var(--forest)" }} />
                {item}
              </li>
            ))}
          </ul>
          <button
            onClick={() => openAuth()}
            className="w-full font-semibold py-3 rounded-xl text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ background: "var(--primary)", ["--tw-ring-color" as string]: "var(--ring)" }}
          >
            Get started free
          </button>
        </div>
      </div>
    </section>
  );
}
