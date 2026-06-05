import { ShieldCheck } from "lucide-react";

interface Props {
  onAgree: () => void;
}

export function ConsentStep({ onAgree }: Props) {
  return (
    <div className="flex flex-col items-center text-center px-8 py-10 max-w-md mx-auto">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{ background: "rgba(217,119,87,0.12)" }}
      >
        <ShieldCheck className="w-8 h-8" style={{ color: "var(--primary)" }} />
      </div>

      <h2
        className="text-2xl font-bold mb-3"
        style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
      >
        How your data is used
      </h2>

      <p className="text-sm mb-6 text-left w-full" style={{ color: "var(--muted-foreground)", lineHeight: 1.7 }}>
        Career Coach AI uses large language models to power its features. When you use tools like the
        Resume Builder, Resume Analyzer, or Cover Letter Creator, the following data is sent to
        Google Gemini AI for processing:
      </p>

      <ul className="text-sm text-left w-full mb-6 space-y-2" style={{ color: "var(--foreground)" }}>
        {[
          "Your resume content and work history",
          "Personal contact details you enter (name, email, phone)",
          "Job descriptions you provide",
          "LinkedIn profile text you import",
        ].map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: "var(--primary)", marginTop: 7 }} />
            {item}
          </li>
        ))}
      </ul>

      <div
        className="w-full rounded-xl p-4 mb-6 text-left text-sm"
        style={{ background: "rgba(217,119,87,0.07)", color: "var(--muted-foreground)", lineHeight: 1.6 }}
      >
        We do not sell your data. AI providers process your data under their own privacy policies.
        You can delete your account and all associated data at any time from Settings.{" "}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
          style={{ color: "var(--primary)" }}
        >
          Google Privacy Policy
        </a>
      </div>

      <button
        onClick={onAgree}
        className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
        style={{
          background: "var(--primary)",
          color: "#fff",
          boxShadow: "0 8px 24px rgba(217,119,87,0.28)",
        }}
      >
        I understand and agree
      </button>
    </div>
  );
}
