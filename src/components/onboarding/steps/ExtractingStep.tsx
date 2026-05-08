import { Loader2 } from "lucide-react";

interface Props {
  importType: "linkedin" | "resume";
  error?: string;
  onRetry: () => void;
  onSkip: () => void;
}

export function ExtractingStep({ importType, error, onRetry, onSkip }: Props) {
  if (error) {
    return (
      <div className="flex flex-col items-center text-center px-8 py-12 max-w-md mx-auto gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
          style={{ background: "rgba(217,119,87,0.1)" }}
        >
          ⚠️
        </div>
        <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Couldn't extract profile
        </h3>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {error}
        </p>
        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          Try again
        </button>
        <button
          onClick={onSkip}
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--muted-foreground)" }}
        >
          Skip and set up manually
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center px-8 py-16 max-w-md mx-auto">
      <Loader2
        className="w-12 h-12 animate-spin mb-6"
        style={{ color: "var(--primary)" }}
      />
      <h3
        className="text-xl font-bold mb-3"
        style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
      >
        {importType === "linkedin" ? "Reading your LinkedIn profile…" : "Parsing your resume…"}
      </h3>
      <p className="text-sm" style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}>
        Gemini is extracting your work history, skills, and education. This usually takes 5–15 seconds.
      </p>
    </div>
  );
}
