import { Compass, Sparkles } from "lucide-react";

interface Props {
  onStart: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onStart, onSkip }: Props) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-10 max-w-md mx-auto">
      <div className="relative mb-8">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(217,119,87,0.12)" }}
        >
          <Compass className="w-9 h-9" style={{ color: "var(--primary)" }} />
        </div>
        <div
          className="absolute -top-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(217,119,87,0.18)" }}
        >
          <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
        </div>
      </div>

      <h1
        className="text-4xl font-bold mb-4 leading-tight"
        style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
      >
        Welcome to Career Coach AI
      </h1>

      <p className="text-base mb-2" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>
        Let's set up your career profile so every tool — Resume Builder, Impact Audit, Profile Lab — already knows your background.
      </p>
      <p className="text-sm mb-10" style={{ color: "var(--muted-foreground)" }}>
        Import from LinkedIn or paste your resume. Takes about 30 seconds.
      </p>

      <button
        onClick={onStart}
        className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 mb-4"
        style={{
          background: "var(--primary)",
          color: "#fff",
          boxShadow: "0 8px 24px rgba(217,119,87,0.28)",
        }}
      >
        Get Started →
      </button>

      <button
        onClick={onSkip}
        className="text-sm transition-colors hover:opacity-80"
        style={{ color: "var(--muted-foreground)" }}
      >
        Skip setup, I'll do it later
      </button>
    </div>
  );
}
