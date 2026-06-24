import { Compass, Sparkles, Building2 } from "lucide-react";
import type { AccountType } from "@/types/userProfile";

interface Props {
  onStart: () => void;
  onSkip: () => void;
  accountType?: AccountType;
}

export function WelcomeStep({ onStart, onSkip, accountType = "seeker" }: Props) {
  const isEmployer = accountType === "employer";
  return (
    <div className="flex flex-col items-center text-center px-5 py-7 sm:px-8 sm:py-10 max-w-md mx-auto">
      <div className="relative mb-8">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(217,119,87,0.12)" }}
        >
          {isEmployer
            ? <Building2 className="w-9 h-9" style={{ color: "var(--primary)" }} />
            : <Compass className="w-9 h-9" style={{ color: "var(--primary)" }} />}
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
        {isEmployer ? "Welcome to the Employer Studio" : "Welcome to Career Coach AI"}
      </h1>

      {isEmployer ? (
        <p className="text-base mb-10" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          Set up your company profile and post job listings — with AI to draft descriptions,
          generate promo content, and boost your roles to reach candidates.
        </p>
      ) : (
        <>
          <p className="text-base mb-2" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>
            Let's set up your career profile so every tool — Resume Builder, Resume Analyzer, LinkedIn Optimization — already knows your background.
          </p>
          <p className="text-sm mb-10" style={{ color: "var(--muted-foreground)" }}>
            Import from LinkedIn or paste your resume. Takes about 30 seconds.
          </p>
        </>
      )}

      <button
        onClick={onStart}
        className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 mb-4"
        style={{
          background: "var(--primary)",
          color: "#fff",
          boxShadow: "0 8px 24px rgba(217,119,87,0.28)",
        }}
      >
        {isEmployer ? "Enter the Studio →" : "Get Started →"}
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
