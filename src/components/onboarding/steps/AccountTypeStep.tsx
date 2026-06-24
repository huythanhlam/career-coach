import { Briefcase, Building2 } from "lucide-react";
import type { AccountType } from "@/types/userProfile";

interface Props {
  onSelect: (type: AccountType) => void;
}

const OPTIONS: { type: AccountType; icon: React.ElementType; title: string; blurb: string }[] = [
  {
    type: "seeker",
    icon: Briefcase,
    title: "I'm a job seeker",
    blurb: "Build resumes, optimize LinkedIn, research companies, and track applications.",
  },
  {
    type: "employer",
    icon: Building2,
    title: "I'm hiring",
    blurb: "Create a company profile, write job listings with AI, and promote them to candidates.",
  },
];

export function AccountTypeStep({ onSelect }: Props) {
  return (
    <div className="flex flex-col items-center text-center px-5 py-7 sm:px-8 sm:py-10 max-w-md mx-auto">
      <h1
        className="text-3xl font-bold mb-3 leading-tight"
        style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
      >
        How will you use Career Coach AI?
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>
        This tailors the app to you. You can change it later in settings.
      </p>

      <div className="flex flex-col gap-3 w-full">
        {OPTIONS.map(({ type, icon: Icon, title, blurb }) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className="flex items-start gap-4 text-left p-4 rounded-2xl transition-all hover:opacity-95"
            style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(217,119,87,0.12)" }}
            >
              <Icon className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <div className="text-base font-semibold" style={{ color: "var(--foreground)" }}>{title}</div>
              <div className="text-sm mt-1" style={{ color: "var(--muted-foreground)", lineHeight: 1.5 }}>{blurb}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
