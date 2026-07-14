import { useReveal } from "./useMotion";

// An original abstract composition — three overlapping "tool" cards at rest,
// like a stack of screenshots casually fanned out — standing in for a real
// product photo without needing one. Built from the landing page's own
// palette so it reads as part of the same system, not stock art bolted on.
function AboutArt() {
  return (
    <svg
      viewBox="0 0 460 400"
      className="w-full h-auto"
      role="img"
      aria-label="An illustration of three overlapping career-coaching tool cards — a resume document, a compensation chart, and a checklist — fanned out with a checkmark badge floating above them."
    >
      <defs>
        <filter id="about-art-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#2a2823" floodOpacity="0.16" />
        </filter>
        <filter id="about-art-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="34" />
        </filter>
      </defs>

      {/* Ambient atmosphere, matching the hero's glow */}
      <circle cx="370" cy="70" r="90" fill="var(--primary)" opacity="0.22" filter="url(#about-art-blur)" />
      <circle cx="60" cy="330" r="100" fill="var(--lp-cool)" opacity="0.55" filter="url(#about-art-blur)" />

      {/* Back card — mauve, salary/chart bars */}
      <g filter="url(#about-art-shadow)" transform="rotate(-9 150 150)">
        <rect x="40" y="70" width="210" height="150" rx="18" fill="var(--lp-mauve)" />
        <rect x="66" y="164" width="18" height="36" rx="4" fill="rgba(42,40,35,0.18)" />
        <rect x="94" y="146" width="18" height="54" rx="4" fill="var(--primary)" />
        <rect x="122" y="130" width="18" height="70" rx="4" fill="rgba(42,40,35,0.28)" />
      </g>

      {/* Middle card — cream, resume lines */}
      <g filter="url(#about-art-shadow)" transform="rotate(4 250 190)">
        <rect
          x="150"
          y="110"
          width="200"
          height="150"
          rx="18"
          fill="var(--card)"
          stroke="var(--border)"
        />
        <rect x="176" y="140" width="90" height="12" rx="6" fill="var(--foreground)" opacity="0.85" />
        <rect x="176" y="164" width="130" height="8" rx="4" fill="var(--border)" />
        <rect x="176" y="182" width="110" height="8" rx="4" fill="var(--border)" />
        <rect x="176" y="200" width="120" height="8" rx="4" fill="var(--border)" />
        <rect x="176" y="222" width="60" height="8" rx="4" fill="var(--primary)" opacity="0.7" />
      </g>

      {/* Front card — cool blue-gray, checklist */}
      <g filter="url(#about-art-shadow)" transform="rotate(-3 230 260)">
        <rect
          x="110"
          y="190"
          width="230"
          height="150"
          rx="18"
          fill="var(--lp-cool)"
          stroke="var(--border)"
        />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(136 ${226 + i * 34})`}>
            <rect
              width="18"
              height="18"
              rx="5"
              fill={i < 2 ? "var(--forest)" : "none"}
              stroke={i < 2 ? "none" : "var(--muted-foreground)"}
              strokeWidth="1.5"
            />
            {i < 2 && (
              <path
                d="M4 9.5 L8 13.5 L14 5"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <rect x="30" y="4" width={140 - i * 18} height="10" rx="5" fill="var(--border)" />
          </g>
        ))}
      </g>

      {/* Floating checkmark badge — the "it just works" flourish */}
      <g filter="url(#about-art-shadow)">
        <circle cx="352" cy="150" r="30" fill="var(--primary)" />
        <path
          d="M340 150 L349 159 L365 141"
          fill="none"
          stroke="var(--primary-foreground)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function About() {
  const { ref, isVisible } = useReveal<HTMLDivElement>();

  return (
    <section id="about" className="py-28 max-w-6xl mx-auto px-4 sm:px-6">
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div>
          <p className="eyebrow-plain mb-4">About Us</p>
          <h2 className="font-display text-4xl font-medium tracking-tight mb-6">
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

        <div ref={ref} data-revealed={isVisible ? "" : undefined} className="reveal px-4 sm:px-8">
          <AboutArt />
        </div>
      </div>
    </section>
  );
}
