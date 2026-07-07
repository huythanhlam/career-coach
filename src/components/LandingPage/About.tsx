import { Check, Sparkles, LineChart, ShieldCheck, Gift } from "lucide-react";
import { useReveal } from "./useMotion";

const PRINCIPLES = [
  {
    icon: Sparkles,
    title: "Specific, not generic",
    text: "Every output is tailored to your resume, your target role, and the job in front of you.",
  },
  {
    icon: LineChart,
    title: "Grounded in real data",
    text: "Salary bands, market intelligence, and company research are backed by verifiable sources.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    text: "Your profile and documents are yours. Row-level security protects every record.",
  },
  {
    icon: Gift,
    title: "Free to start",
    text: "All ten tools are free during our public beta — no credit card, no catch.",
  },
];

export function About() {
  const { ref, isVisible } = useReveal<HTMLDivElement>();

  return (
    <section id="about" className="py-24 max-w-6xl mx-auto px-4 sm:px-6">
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div>
          <p className="eyebrow mb-3">About Us</p>
          <h2 className="font-display text-4xl font-semibold mb-6">
            The career coaching that used to cost thousands — for everyone
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            The job search is broken. Candidates pour hundreds of hours into resumes, prep, and
            negotiation — usually alone, without expert guidance.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            We built ten AI-powered tools so every professional gets the same caliber of coaching
            that once required a big budget or the right referral.
          </p>
        </div>

        <div ref={ref} className="grid sm:grid-cols-2 gap-4">
          {PRINCIPLES.map((p, i) => (
            <div
              key={p.title}
              className="reveal rounded-2xl p-5 border"
              data-revealed={isVisible ? "" : undefined}
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                ["--i" as string]: i,
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "rgba(47,107,79,0.1)" }}
              >
                <p.icon className="w-4 h-4" style={{ color: "var(--forest)" }} />
              </div>
              <h3 className="font-semibold text-sm mb-1.5 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" style={{ color: "var(--forest)" }} /> {p.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
