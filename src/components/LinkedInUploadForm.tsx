/**
 * LinkedInUploadForm — entry screen for the LinkedIn Optimization workflow.
 *
 * Mirrors the resume upload flow: the user uploads their LinkedIn "Save to PDF"
 * export (the most complete input) and optionally provides their profile URL —
 * used to attempt a live screenshot preview — and a target role.
 */
import { useState } from "react";
import { Linkedin, Sparkles, UploadCloud, Loader2, Image as ImageIcon } from "lucide-react";
import { isSupportedFile } from "@/services/documentParserService";

export interface LinkedInUploadSubmit {
  file: File;
  url: string;
  targetRole: string;
  screenshotFile: File | null;
}

interface Props {
  initialUrl?: string;
  initialTargetRole?: string;
  isSubmitting?: boolean;
  onSubmit: (data: LinkedInUploadSubmit) => void;
}

const fieldStyle: React.CSSProperties = {
  width: "100%", height: 52, background: "var(--muted)", border: "1px solid var(--border)",
  borderRadius: 14, padding: "0 16px", fontFamily: "inherit", fontSize: 14,
  color: "var(--foreground)", outline: "none",
};

export function LinkedInUploadForm({ initialUrl = "", initialTargetRole = "", isSubmitting = false, onSubmit }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState(initialUrl);
  const [targetRole, setTargetRole] = useState(initialTargetRole);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (f: File | null) => {
    setError(null);
    if (f && !isSupportedFile(f)) {
      setError("Unsupported file. Please upload a PDF file (LinkedIn's export format).");
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError("Please upload your LinkedIn PDF export first."); return; }
    onSubmit({ file, url: url.trim(), targetRole: targetRole.trim(), screenshotFile });
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Linkedin className="w-5 h-5" style={{ color: "var(--primary)" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>Analyze your LinkedIn profile</div>
          </div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.5 }}>
            On LinkedIn, open your profile → <strong>More</strong> → <strong>Save to PDF</strong>, then upload that file below.
            We'll score it and suggest concrete improvements.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* File upload */}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
              LinkedIn PDF export
            </label>
            <label
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 8, padding: "28px 16px", borderRadius: 14, cursor: "pointer", textAlign: "center",
                background: "var(--muted)", border: `1.5px dashed ${file ? "var(--primary)" : "var(--border)"}`,
              }}
            >
              <UploadCloud className="w-6 h-6" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                {file ? file.name : "Click to upload"}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>PDF only · up to 20 MB</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {/* LinkedIn URL */}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
              LinkedIn URL
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted-foreground)", marginLeft: 6 }}>(optional — for the visual preview)</span>
            </label>
            <input
              type="url"
              placeholder="https://linkedin.com/in/yourprofile"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={fieldStyle}
            />
          </div>

          {/* Profile screenshot (for the real visual: headshot, cover, layout) */}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
              Profile screenshot
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted-foreground)", marginLeft: 6 }}>(optional — best visual preview)</span>
            </label>
            <label
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 14, cursor: "pointer",
                background: "var(--muted)", border: `1.5px dashed ${screenshotFile ? "var(--primary)" : "var(--border)"}`,
              }}
            >
              <ImageIcon className="w-5 h-5" style={{ color: "var(--primary)", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: screenshotFile ? "var(--foreground)" : "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {screenshotFile ? screenshotFile.name : "Upload a full-page screenshot of your profile (taken while logged in)"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
            </label>
            <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.5 }}>
              LinkedIn hides logged-out profiles, so an automated capture often can't see your headshot, cover photo, or summary. Uploading your own screenshot shows the real design.
            </p>
          </div>

          {/* Target role */}
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
              Target role
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted-foreground)", marginLeft: 6 }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Senior Software Engineer"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              style={fieldStyle}
            />
          </div>

          {error && <div style={{ fontSize: 13, color: "var(--destructive)" }}>{error}</div>}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              height: 52, background: "var(--primary)", color: "#FFF",
              border: "1px solid var(--primary)", borderRadius: 14,
              fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: isSubmitting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: "0 4px 14px rgba(217,119,87,0.25)", opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
              : <><Sparkles className="w-4 h-4" /> Analyze profile</>}
          </button>
        </form>
      </div>
    </div>
  );
}
