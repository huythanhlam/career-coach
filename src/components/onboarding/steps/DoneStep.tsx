import { CheckCircle2 } from "lucide-react";
import type { AccountType } from "@/types/userProfile";

interface Props {
  name: string;
  onStart: () => void;
  accountType?: AccountType;
}

const SEEKER_CALLOUTS = [
  { icon: "📄", label: "Resume Builder", desc: "Pre-filled with your work history, education & skills" },
  { icon: "🔍", label: "Resume Analyzer", desc: "Uses your resume text as the starting point" },
  { icon: "💼", label: "LinkedIn Optimization", desc: "Scores your LinkedIn PDF export and suggests improvements" },
];

const EMPLOYER_CALLOUTS = [
  { icon: "🏢", label: "Company Profile", desc: "Draft your About, mission, culture & benefits with AI" },
  { icon: "📝", label: "Job Listings", desc: "Generate a full job description from a short brief" },
  { icon: "🚀", label: "Promote & Boost", desc: "Create promo content and feature your roles to candidates" },
];

export function DoneStep({ name, onStart, accountType = "seeker" }: Props) {
  const firstName = name?.split(" ")[0] || "there";
  const isEmployer = accountType === "employer";
  const callouts = isEmployer ? EMPLOYER_CALLOUTS : SEEKER_CALLOUTS;
  return (
    <div className="flex flex-col items-center text-center px-8 py-10 max-w-md mx-auto">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{ background: "rgba(47,107,79,0.12)" }}
      >
        <CheckCircle2 className="w-8 h-8" style={{ color: "var(--forest)" }} />
      </div>

      <h2
        className="text-3xl font-bold mb-3"
        style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
      >
        You're all set, {firstName}!
      </h2>
      <p className="text-sm mb-8" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>
        {isEmployer
          ? "Your employer account is ready. Head to the Employer Studio to post your first role."
          : "Your career profile is saved. Every tool now knows your background."}
      </p>

      <ul className="flex flex-col gap-2.5 w-full mb-8 text-left">
        {callouts.map(({ icon, label, desc }) => (
          <li
            key={label}
            className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{ background: "var(--muted)" }}
          >
            <span className="text-base mt-0.5">{icon}</span>
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{label}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{desc}</div>
            </div>
          </li>
        ))}
      </ul>

      <button
        onClick={onStart}
        className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
        style={{
          background: "var(--primary)",
          color: "#fff",
          boxShadow: "0 8px 24px rgba(217,119,87,0.28)",
        }}
      >
        Start exploring →
      </button>
    </div>
  );
}
