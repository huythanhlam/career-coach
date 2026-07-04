import { Building2, PenTool, Megaphone, Rocket, ArrowRight } from "lucide-react";
import type { OpenAuth } from "./types";

interface EmployersProps {
  openAuth: OpenAuth;
}

// Deliberately a single subordinate band — one row, lighter than the candidate
// sections, so it complements rather than competes with the main story.
export function Employers({ openAuth }: EmployersProps) {
  return (
    <section id="for-employers" className="py-12 max-w-6xl mx-auto px-4 sm:px-6">
      <div
        className="rounded-2xl border p-6 sm:p-8"
        style={{ background: "var(--paper)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
          <div className="lg:max-w-md">
            <div
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold mb-3"
              style={{ background: "rgba(217,119,87,0.1)", color: "var(--primary)" }}
            >
              <Building2 className="w-3 h-3" /> For Employers
            </div>
            <h2
              className="font-display text-2xl font-semibold mb-1"
              style={{ color: "var(--foreground)" }}
            >
              Hiring? Post jobs and reach candidates
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Set up a company profile, draft listings with AI, and boost them — all in a dedicated
              Employer Studio.
            </p>
          </div>

          <ul className="flex-1 grid sm:grid-cols-3 gap-3">
            {[
              { icon: PenTool, text: "AI-drafted job posts" },
              { icon: Megaphone, text: "1-click promotion" },
              { icon: Rocket, text: "Boosted reach" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2 text-sm">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(217,119,87,0.12)" }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                </span>
                <span style={{ color: "var(--foreground)" }}>{text}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => openAuth(undefined, "employer")}
              className="inline-flex items-center justify-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ background: "var(--primary)", ["--tw-ring-color" as string]: "var(--ring)" }}
            >
              Create employer account <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => openAuth(undefined, "employer")}
              className="inline-flex items-center justify-center gap-2 font-medium text-sm px-5 py-2.5 rounded-xl transition-colors hover:bg-muted"
              style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              Post a job
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
