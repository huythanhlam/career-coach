import React, { useState, useRef } from "react";
import {
  Loader2,
  Sparkles,
  Upload,
  ChevronDown,
  ChevronUp,
  User,
  FileText,
  Paperclip,
} from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { UserProfile } from "@/types/userProfile";
import { TEMPLATES } from "@/components/TemplateGallery";
import { JobDetailsSection, type JobDetailsValue } from "@/components/JobDetailsSection";
import { parseDocumentToText } from "@/services/documentParserService";

export interface CoverLetterFormData {
  jobDescription: string;
  companyName: string;
  jobTitle: string;
  tone: "professional" | "conversational" | "enthusiastic";
  templateId: string;
  achievements: string;
  resumeSource: "profile" | "saved" | "upload";
  savedResumeId?: string;
  resumeText?: string;
  resumeFile?: { data: string; mimeType: string };
  profileSummary?: string;
}

interface CoverLetterFormProps {
  onSubmit: (data: CoverLetterFormData) => void;
  isGenerating: boolean;
}

const fieldStyle: React.CSSProperties = {
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 14,
  color: "var(--foreground)",
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--foreground)",
  marginBottom: 6,
  display: "block",
};

function buildProfileSummary(profile: UserProfile): string {
  const lines: string[] = [];
  if (profile.fullName) lines.push(`NAME: ${profile.fullName}`);
  if (profile.summary) lines.push(`PROFESSIONAL SUMMARY: ${profile.summary}`);
  if (profile.targetRole) lines.push(`TARGET ROLE: ${profile.targetRole}`);
  if (profile.yearsOfExperience) lines.push(`YEARS OF EXPERIENCE: ${profile.yearsOfExperience}`);

  if (profile.workHistory?.length) {
    lines.push("\nWORK HISTORY:");
    profile.workHistory.forEach((w) => {
      lines.push(
        `- ${w.role} at ${w.company} (${w.startDate} – ${w.current ? "Present" : w.endDate})`,
      );
      if (w.responsibilities?.trim()) {
        lines.push(`  Responsibilities: ${w.responsibilities}`);
      }
    });
  }

  if (profile.education?.length) {
    lines.push("\nEDUCATION:");
    profile.education.forEach((e) => {
      lines.push(
        `- ${e.degree}${e.major ? `, ${e.major}` : ""} — ${e.university} (${e.graduationYear})`,
      );
    });
  }

  if (profile.skills?.length) {
    lines.push(`\nSKILLS: ${profile.skills.join(", ")}`);
  }

  return lines.join("\n");
}

export function CoverLetterForm({ onSubmit, isGenerating }: CoverLetterFormProps) {
  const { profile } = useUserProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobDetails, setJobDetails] = useState<JobDetailsValue>({
    jobTitle: "",
    companyName: "",
    jobDescription: "",
  });
  const [tone, setTone] = useState<CoverLetterFormData["tone"]>("professional");
  const [templateId, setTemplateId] = useState("modern-clean");
  const [achievements, setAchievements] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [resumeSource, setResumeSource] = useState<CoverLetterFormData["resumeSource"]>("profile");
  const [savedResumeId, setSavedResumeId] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const savedResumes = profile.savedResumes ?? [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setFileError("");
    if (file && !file.name.match(/\.(pdf|docx)$/i)) {
      setFileError("Please upload a PDF or DOCX file.");
      return;
    }
    setUploadedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDetails.jobDescription.trim()) return;
    if (resumeSource === "upload" && !uploadedFile) {
      setFileError("Please upload a resume file.");
      return;
    }

    setIsProcessing(true);
    try {
      const formData: CoverLetterFormData = {
        jobDescription: jobDetails.jobDescription.trim(),
        companyName: jobDetails.companyName.trim(),
        jobTitle: jobDetails.jobTitle.trim(),
        tone,
        templateId,
        achievements: achievements.trim(),
        resumeSource,
      };

      if (resumeSource === "profile") {
        formData.profileSummary = buildProfileSummary(profile);
      } else if (resumeSource === "saved") {
        const saved = savedResumes.find((r) => r.id === savedResumeId) ?? savedResumes[0];
        if (saved) {
          formData.savedResumeId = saved.id;
          formData.resumeText = saved.text;
        }
      } else if (resumeSource === "upload" && uploadedFile) {
        const text = await parseDocumentToText(uploadedFile);
        formData.resumeText = text;
      }

      onSubmit(formData);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to process file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const sourceOptions: {
    id: CoverLetterFormData["resumeSource"];
    label: string;
    icon: React.ReactNode;
    desc: string;
  }[] = [
    {
      id: "profile",
      icon: <User className="w-4 h-4" />,
      label: "My Profile",
      desc: "Use your saved work history and skills",
    },
    {
      id: "saved",
      icon: <FileText className="w-4 h-4" />,
      label: "Saved Resume",
      desc: "Select from your saved resumes",
    },
    {
      id: "upload",
      icon: <Paperclip className="w-4 h-4" />,
      label: "Upload File",
      desc: "Upload a PDF or DOCX resume",
    },
  ];

  const toneOptions: { value: CoverLetterFormData["tone"]; label: string; desc: string }[] = [
    { value: "professional", label: "Professional", desc: "Formal, measured tone" },
    { value: "conversational", label: "Conversational", desc: "Warm and approachable" },
    { value: "enthusiastic", label: "Enthusiastic", desc: "Energetic and forward-looking" },
  ];

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Job details — shared with the resume tailor flow */}
        <JobDetailsSection value={jobDetails} onChange={setJobDetails} />

        {/* Resume source */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 18,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--muted-foreground)",
            }}
          >
            Your Experience
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 10 }}>
            {sourceOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setResumeSource(opt.id)}
                style={{
                  padding: "14px 16px",
                  border: `2px solid ${resumeSource === opt.id ? "var(--primary)" : "var(--border)"}`,
                  borderRadius: 12,
                  background:
                    resumeSource === opt.id
                      ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                      : "var(--muted)",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <span
                  style={{
                    color: resumeSource === opt.id ? "var(--primary)" : "var(--muted-foreground)",
                  }}
                >
                  {opt.icon}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                  {opt.label}
                </span>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>

          {resumeSource === "saved" && (
            <div>
              {savedResumes.length === 0 ? (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--muted-foreground)",
                    padding: "10px 14px",
                    background: "var(--muted)",
                    borderRadius: 10,
                  }}
                >
                  No saved resumes yet. Use Resume Builder to create one, or choose a different
                  source.
                </div>
              ) : (
                <select
                  value={savedResumeId || savedResumes[0]?.id}
                  onChange={(e) => setSavedResumeId(e.target.value)}
                  style={{ ...fieldStyle, height: 48, padding: "0 14px" }}
                >
                  {savedResumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {resumeSource === "upload" && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  height: 48,
                  padding: "0 20px",
                  background: "var(--muted)",
                  border: "1px dashed var(--border)",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--foreground)",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Upload className="w-4 h-4" style={{ color: "var(--primary)" }} />
                {uploadedFile ? uploadedFile.name : "Choose PDF or DOCX…"}
              </button>
              {fileError && (
                <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>{fileError}</div>
              )}
            </div>
          )}
        </div>

        {/* Tone */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 18,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--muted-foreground)",
            }}
          >
            Tone
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 10 }}>
            {toneOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTone(opt.value)}
                style={{
                  padding: "12px 14px",
                  border: `2px solid ${tone === opt.value ? "var(--primary)" : "var(--border)"}`,
                  borderRadius: 12,
                  background:
                    tone === opt.value
                      ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                      : "var(--muted)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: tone === opt.value ? "var(--primary)" : "var(--foreground)",
                  }}
                >
                  {opt.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Template */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 18,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--muted-foreground)",
            }}
          >
            Template
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 8 }}>
            {TEMPLATES.map((tpl) => {
              const active = templateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateId(tpl.id)}
                  style={{
                    padding: "12px 10px",
                    border: `2px solid ${active ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: 12,
                    background: active
                      ? "color-mix(in srgb, var(--primary) 8%, transparent)"
                      : "var(--muted)",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  {/* Colour swatch */}
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <div
                      style={{
                        width: 6,
                        height: 28,
                        borderRadius: 3,
                        background: tpl.accent,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
                      <div
                        style={{
                          height: 4,
                          borderRadius: 2,
                          background: active ? "var(--primary)" : "var(--border)",
                          width: "80%",
                        }}
                      />
                      <div
                        style={{
                          height: 3,
                          borderRadius: 2,
                          background: "var(--border)",
                          width: "60%",
                        }}
                      />
                      <div
                        style={{
                          height: 3,
                          borderRadius: 2,
                          background: "var(--border)",
                          width: "70%",
                        }}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: active ? "var(--primary)" : "var(--foreground)",
                      lineHeight: 1.3,
                    }}
                  >
                    {tpl.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional fields */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setShowOptional((v) => !v)}
            style={{
              width: "100%",
              padding: "16px 24px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "inherit",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--muted-foreground)",
              }}
            >
              Optional: Achievements to Highlight
            </span>
            {showOptional ? (
              <ChevronUp className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
            ) : (
              <ChevronDown className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
            )}
          </button>
          {showOptional && (
            <div style={{ padding: "0 24px 24px" }}>
              <label style={{ ...labelStyle, color: "var(--muted-foreground)", fontWeight: 400 }}>
                Specific achievements, metrics, or stories you want included (optional)
              </label>
              <textarea
                value={achievements}
                onChange={(e) => setAchievements(e.target.value)}
                placeholder="e.g. Led migration to microservices reducing deployment time by 60%, or Grew ARR from $2M to $8M in 18 months"
                rows={4}
                style={{ ...fieldStyle, padding: "12px 14px", resize: "vertical", lineHeight: 1.6 }}
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={
            isGenerating ||
            isProcessing ||
            !jobDetails.jobDescription.trim() ||
            (resumeSource === "upload" && !uploadedFile)
          }
          style={{
            height: 52,
            width: "100%",
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: 14,
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 600,
            cursor: isGenerating || isProcessing ? "not-allowed" : "pointer",
            opacity: isGenerating || isProcessing ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "opacity 0.15s",
          }}
        >
          {isGenerating || isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />{" "}
              {isProcessing ? "Processing file…" : "Generating…"}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Generate Cover Letter
            </>
          )}
        </button>
      </div>
    </form>
  );
}
