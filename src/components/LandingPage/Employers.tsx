import { ArrowRight } from "lucide-react";
import type { OpenAuth } from "./types";

interface EmployersProps {
  openAuth: OpenAuth;
}

const EMPLOYER_ART_SHADOW = (
  <filter id="employer-art-shadow" x="-60%" y="-60%" width="220%" height="220%">
    <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#2a2823" floodOpacity="0.15" />
  </filter>
);

/** AI-drafted job posts: a document filling in, with a sparkle marking it AI-written. */
function AiDraftArt() {
  return (
    <svg viewBox="0 0 96 96" className="w-16 h-16" aria-hidden="true">
      <defs>{EMPLOYER_ART_SHADOW}</defs>
      <g filter="url(#employer-art-shadow)">
        <rect x="18" y="14" width="60" height="68" rx="12" fill="var(--card)" stroke="var(--border)" />
        <rect x="30" y="30" width="30" height="7" rx="3.5" fill="var(--foreground)" opacity="0.85" />
        <rect x="30" y="44" width="36" height="5" rx="2.5" fill="var(--border)" />
        <rect x="30" y="54" width="36" height="5" rx="2.5" fill="var(--border)" />
        <rect x="30" y="64" width="20" height="5" rx="2.5" fill="var(--primary)" opacity="0.7" />
      </g>
      <g filter="url(#employer-art-shadow)">
        <circle cx="70" cy="20" r="14" fill="var(--primary)" />
        <path
          d="M70 13v5M70 22v5M63 20h5M72 20h5"
          stroke="var(--primary-foreground)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/** 1-click promotion: a boost tile with an upward arrow, one click away. */
function PromotionArt() {
  return (
    <svg viewBox="0 0 96 96" className="w-16 h-16" aria-hidden="true">
      <defs>{EMPLOYER_ART_SHADOW}</defs>
      <path
        d="M48 20a30 30 0 0 1 21 8.5M48 20a30 30 0 0 0-21 8.5"
        fill="none"
        stroke="var(--lp-cool)"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <g filter="url(#employer-art-shadow)">
        <rect x="24" y="36" width="48" height="46" rx="12" fill="var(--lp-mauve)" />
        <path
          d="M48 66V48M48 48l-9 9M48 48l9 9"
          stroke="var(--foreground)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g filter="url(#employer-art-shadow)">
        <circle cx="74" cy="66" r="14" fill="var(--primary)" />
        <circle cx="74" cy="66" r="4" fill="var(--primary-foreground)" />
      </g>
    </svg>
  );
}

/** Boosted reach: a listing reaching several candidates at once. */
function ReachArt() {
  const nodes = [
    { x: 24, y: 24 },
    { x: 72, y: 24 },
    { x: 24, y: 72 },
    { x: 72, y: 72 },
  ];
  return (
    <svg viewBox="0 0 96 96" className="w-16 h-16" aria-hidden="true">
      <defs>{EMPLOYER_ART_SHADOW}</defs>
      {nodes.map((n, i) => (
        <line
          key={i}
          x1="48"
          y1="48"
          x2={n.x}
          y2={n.y}
          stroke="var(--border)"
          strokeWidth="2.5"
        />
      ))}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r="9"
          fill={i === 0 ? "var(--forest)" : "var(--lp-cool)"}
          filter="url(#employer-art-shadow)"
        />
      ))}
      <circle cx="48" cy="48" r="16" fill="var(--primary)" filter="url(#employer-art-shadow)" />
      <path
        d="M41 48l5 5 9-10"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const EMPLOYER_FEATURES = [
  { art: AiDraftArt, text: "AI-drafted job posts" },
  { art: PromotionArt, text: "1-click promotion" },
  { art: ReachArt, text: "Boosted reach" },
];

// Deliberately a single subordinate band — lighter than the candidate
// sections, so it complements rather than competes with the main story.
export function Employers({ openAuth }: EmployersProps) {
  return (
    <section id="for-employers" className="py-12 max-w-6xl mx-auto px-4 sm:px-6">
      <div
        className="rounded-lg border p-6 sm:p-8"
        style={{ background: "var(--paper)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="lg:max-w-md">
            <p className="eyebrow-plain mb-3">For Employers</p>
            <h2
              className="font-display text-2xl font-medium tracking-tight mb-1"
              style={{ color: "var(--foreground)" }}
            >
              Hiring? Post jobs and reach candidates
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Set up a company profile, draft listings with AI, and boost them — all in a dedicated
              Employer Studio.
            </p>
          </div>

          <button
            onClick={() => openAuth(undefined, "employer")}
            className="inline-flex items-center justify-center gap-2 font-medium text-sm px-5 py-2.5 rounded-md hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 flex-shrink-0"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              ["--tw-ring-color" as string]: "var(--ring)",
            }}
          >
            Post a Job <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <ul
          className="grid sm:grid-cols-3 gap-6 mt-8 pt-8"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {EMPLOYER_FEATURES.map(({ art: Art, text }) => (
            <li key={text} className="flex flex-col items-center text-center gap-2">
              <Art />
              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
