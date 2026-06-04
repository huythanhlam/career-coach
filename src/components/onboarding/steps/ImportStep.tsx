import { useState, useRef } from "react";
import { Briefcase, FileText, ArrowLeft, Upload, Loader2 } from "lucide-react";
import { extractTextFromFile } from "@/lib/documentUtils";

interface Props {
  onExtract: (input: { type: "linkedin"; text: string; url?: string } | { type: "resume"; text: string }) => void;
  onBack: () => void;
  onSkip: () => void;
}

type Method = "linkedin" | "resume" | null;

export function ImportStep({ onExtract, onBack, onSkip }: Props) {
  const [method, setMethod] = useState<Method>(null);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinText, setLinkedinText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canContinue =
    (method === "linkedin" && linkedinText.trim().length > 50) ||
    (method === "resume" && resumeText.trim().length > 50);

  async function handleFileUpload(file: File) {
    setIsPdfLoading(true);
    try {
      const text = await extractTextFromFile(file);
      setResumeText(text.trim());
    } catch (err) {
      console.error("File extraction failed:", err);
    } finally {
      setIsPdfLoading(false);
    }
  }

  function handleContinue() {
    if (method === "linkedin") {
      onExtract({ type: "linkedin", text: linkedinText, url: linkedinUrl || undefined });
    } else if (method === "resume") {
      onExtract({ type: "resume", text: resumeText });
    }
  }

  return (
    <div className="flex flex-col px-6 py-8 w-full max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-6 w-fit transition-opacity hover:opacity-70"
        style={{ color: "var(--muted-foreground)" }}
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h2
        className="text-2xl font-bold mb-2"
        style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
      >
        Import your career profile
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
        Choose how you'd like to import your information.
      </p>

      {/* Method Selection */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {(["linkedin", "resume"] as const).map((m) => {
          const Icon = m === "linkedin" ? Briefcase : FileText;
          const label = m === "linkedin" ? "LinkedIn Profile" : "Resume / CV";
          const desc = m === "linkedin" ? "Paste your LinkedIn profile text" : "Paste or upload your resume";
          const isSelected = method === m;
          return (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className="flex flex-col gap-2 p-4 rounded-xl text-left transition-all"
              style={{
                border: isSelected ? "2px solid var(--primary)" : "1.5px solid var(--border)",
                background: isSelected ? "rgba(217,119,87,0.06)" : "var(--card)",
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: isSelected ? "rgba(217,119,87,0.14)" : "var(--muted)" }}
              >
                <Icon className="w-4.5 h-4.5" style={{ color: isSelected ? "var(--primary)" : "var(--muted-foreground)" }} />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{label}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* LinkedIn fields */}
      {method === "linkedin" && (
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--foreground)" }}>
              LinkedIn URL <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="url"
              placeholder="https://linkedin.com/in/yourprofile"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="w-full rounded-xl text-sm px-4 outline-none"
              style={{
                height: 44,
                background: "var(--muted)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--foreground)" }}>
              LinkedIn profile text <span style={{ color: "var(--primary)" }}>*</span>
            </label>
            <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>
              Go to your LinkedIn profile → select all text → paste here.
            </p>
            <textarea
              placeholder="Paste your full LinkedIn profile text here (headline, about, experience, education, skills)..."
              value={linkedinText}
              onChange={(e) => setLinkedinText(e.target.value)}
              rows={8}
              className="w-full rounded-xl text-sm px-4 py-3 outline-none resize-none"
              style={{
                background: "var(--muted)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                fontFamily: "inherit",
                lineHeight: 1.6,
              }}
            />
          </div>
        </div>
      )}

      {/* Resume fields */}
      {method === "resume" && (
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--foreground)" }}>
              Upload resume <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>(PDF, DOCX, or TXT — we'll extract the text)</span>
            </label>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isPdfLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
              style={{
                border: "1.5px dashed var(--border)",
                background: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              {isPdfLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Extracting text…</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload PDF, DOCX, or TXT</>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--foreground)" }}>
              Resume text <span style={{ color: "var(--primary)" }}>*</span>
            </label>
            <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>
              PDF text will appear here — or paste your resume directly.
            </p>
            <textarea
              placeholder="Paste your resume text here, or upload a PDF above..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              rows={10}
              className="w-full rounded-xl text-sm px-4 py-3 outline-none resize-none"
              style={{
                background: "var(--muted)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                fontFamily: "inherit",
                lineHeight: 1.6,
              }}
            />
          </div>
        </div>
      )}

      {method && (
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all mb-3"
          style={{
            background: canContinue ? "var(--primary)" : "var(--muted)",
            color: canContinue ? "#fff" : "var(--muted-foreground)",
            boxShadow: canContinue ? "0 8px 24px rgba(217,119,87,0.22)" : "none",
            cursor: canContinue ? "pointer" : "not-allowed",
          }}
        >
          Extract my profile →
        </button>
      )}

      <button
        onClick={onSkip}
        className="text-xs text-center transition-opacity hover:opacity-70 mt-1"
        style={{ color: "var(--muted-foreground)" }}
      >
        Skip and enter the app manually
      </button>
    </div>
  );
}
