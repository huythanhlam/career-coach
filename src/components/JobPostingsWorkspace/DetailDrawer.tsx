import React, { useState } from "react";
import { X, Star, Trash2, ExternalLink, Sparkles, FileText, Mail, Briefcase, ArrowRight, Loader2 } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { canScoreProfile } from "@/services/jobRecommendation";
import { generateWorkflowData } from "@/services/geminiService";
import { MODELS } from "@/config/models";
import { generateId } from "@/types/userProfile";
import { JOB_STATUSES, type JobPosting, type JobStatus } from "@/types/jobPosting";
import { JobDescription } from "@/components/JobDescription";
import type { ViewId } from "@/components/Sidebar";
import { STATUS_META, inputStyle, primaryBtn, ghostBtn } from "./styles";
import { SectionHeading, Label, CompanyLogo, FitBreakdown } from "./_shared";

/* ── DetailDrawer ───────────────────────────────────────────────────────── */
export const DetailDrawer = React.memo(function DetailDrawer({
  posting, profile, onClose, onUpdate, onDelete, onNavigate, onSaveCoverLetter, onSaveResume,
}: {
  posting: JobPosting;
  profile: ReturnType<typeof useUserProfile>["profile"];
  onClose: () => void;
  onUpdate: (patch: Partial<JobPosting>) => void;
  onDelete: () => void;
  onNavigate?: (view: ViewId) => void;
  onSaveCoverLetter: (cl: NonNullable<typeof profile.savedCoverLetters>[number]) => void;
  onSaveResume: (r: NonNullable<typeof profile.savedResumes>[number]) => void;
}) {
  const [notes, setNotes] = useState(posting.notes ?? "");
  const [scoring, setScoring] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [coverDraft, setCoverDraft] = useState("");
  const [coverSaved, setCoverSaved] = useState(false);
  const [resumeGenerating, setResumeGenerating] = useState(false);
  const [resumeDraft, setResumeDraft] = useState("");
  const [resumeSaved, setResumeSaved] = useState(false);

  const resumeText = profile.resumeText
    ?? profile.savedResumes?.find((r) => r.text)?.text
    ?? profile.summary ?? "";

  const scoreFit = async () => {
    setScoring(true);
    try {
      const system = "You are an expert recruiter. Score how well a candidate fits a job from 0-100 based only on the evidence. Reply with ONLY the integer.";
      const prompt = `JOB:\n${posting.title} at ${posting.company ?? ""}\n${posting.description ?? ""}\n\nCANDIDATE:\nTarget role: ${profile.targetRole ?? ""}\nSkills: ${(profile.skills ?? []).join(", ")}\nResume/summary:\n${resumeText.slice(0, 4000)}\n\nReturn ONLY an integer 0-100.`;
      const raw = await generateWorkflowData(system, prompt, MODELS.FAST);
      const n = parseInt((raw.match(/\d{1,3}/)?.[0] ?? ""), 10);
      if (!Number.isNaN(n)) onUpdate({ matchScore: Math.min(100, Math.max(0, n)) });
    } finally {
      setScoring(false);
    }
  };

  const generateCover = async () => {
    setGenerating(true); setCoverSaved(false);
    try {
      const system = "You are an expert career writer. Write a concise, specific, one-page cover letter tailored to the job using only the candidate's real background. No placeholders like [Your Name]; use the provided name. Output plain text only.";
      const name = profile.fullName || profile.preferredName || "";
      const prompt = `Write a cover letter for this job.\n\nJOB:\n${posting.title} at ${posting.company ?? ""}\n${posting.description ?? ""}\n\nCANDIDATE:\nName: ${name}\nTarget role: ${profile.targetRole ?? ""}\nSkills: ${(profile.skills ?? []).join(", ")}\nBackground:\n${resumeText.slice(0, 4000)}`;
      setCoverDraft(await generateWorkflowData(system, prompt, MODELS.QUALITY));
    } finally {
      setGenerating(false);
    }
  };

  const saveCover = () => {
    const id = generateId();
    onSaveCoverLetter({
      id,
      name: `${posting.title} — ${posting.company ?? "cover letter"}`,
      storagePath: "",
      text: coverDraft,
      jobTitle: posting.title,
      company: posting.company ?? "",
      createdAt: new Date().toISOString(),
    });
    onUpdate({ appliedCoverLetterId: id });
    setCoverSaved(true);
  };

  const generateResume = async () => {
    setResumeGenerating(true); setResumeSaved(false);
    try {
      const system = "You are an expert resume writer. Tailor the candidate's resume to THIS job using ONLY their real experience — never invent employers, titles, dates, or metrics. Surface the most relevant experience and weave in keywords from the job description. Output a clean, ATS-friendly resume in Markdown. No commentary.";
      const name = profile.fullName || profile.preferredName || "";
      const prompt = `Tailor a resume for this job.\n\nJOB:\n${posting.title} at ${posting.company ?? ""}\n${posting.description ?? ""}\n\nCANDIDATE:\nName: ${name}\nTarget role: ${profile.targetRole ?? ""}\nSkills: ${(profile.skills ?? []).join(", ")}\nExisting resume / background:\n${resumeText.slice(0, 6000)}`;
      setResumeDraft(await generateWorkflowData(system, prompt, MODELS.QUALITY));
    } finally {
      setResumeGenerating(false);
    }
  };

  const saveResume = () => {
    const id = generateId();
    onSaveResume({
      id,
      name: `${posting.title} — ${posting.company ?? "resume"}`,
      storagePath: "",
      text: resumeDraft,
      createdAt: new Date().toISOString(),
    });
    onUpdate({ appliedResumeId: id });
    setResumeSaved(true);
  };

  const savedResumes = profile.savedResumes ?? [];
  const savedCovers = profile.savedCoverLetters ?? [];
  const meta = STATUS_META[posting.status];

  return (
    <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-200"
      style={{ background: "rgba(31,27,22,0.4)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="animate-in slide-in-from-right duration-300 h-full overflow-y-auto no-scrollbar"
        style={{ background: "var(--card)", width: "100%", maxWidth: 560, boxShadow: "-20px 0 60px rgba(0,0,0,0.18)" }}
        onClick={(e) => e.stopPropagation()}>

        <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--card)", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
              <CompanyLogo company={posting.company} url={posting.url} size={44} />
              <div style={{ minWidth: 0 }}>
                <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em", margin: 0 }}>{posting.title}</h2>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
                  {[posting.company, posting.location].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => onUpdate({ favorite: !posting.favorite })} title="Favorite"
                style={{ width: 34, height: 34, borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: posting.favorite ? "var(--primary)" : "var(--muted-foreground)" }}>
                <Star className="w-4 h-4" fill={posting.favorite ? "var(--primary)" : "none"} />
              </button>
              <button onClick={onDelete} title="Delete"
                style={{ width: 34, height: 34, borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}>
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={onClose}
                style={{ width: 34, height: 34, borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{ background: meta.bg, color: meta.fg, border: `1px solid ${meta.border}`, padding: "5px 12px", borderRadius: 9999, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.16em" }}>{meta.label}</span>
            {posting.matchScore != null && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>AI fit score: <strong style={{ color: "var(--foreground)" }}>{posting.matchScore}%</strong></span>}
            {posting.url && (
              <a href={posting.url} target="_blank" rel="noreferrer" style={{ ...primaryBtn, height: 34, textDecoration: "none", marginLeft: "auto" }}>
                Open posting <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24 }}>
          {canScoreProfile(profile) ? (
            <FitBreakdown posting={posting} profile={profile} />
          ) : (
            <button onClick={() => onNavigate?.("profile_settings")}
              style={{ ...ghostBtn, height: "auto", padding: "14px 16px", justifyContent: "flex-start", textAlign: "left", gap: 12, width: "100%" }}>
              <Sparkles className="w-4 h-4" style={{ color: "var(--primary)", flexShrink: 0 }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>See how well this fits you</span>
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted-foreground)", lineHeight: 1.5 }}>Complete your profile to get a personalized fit score and breakdown.</span>
              </span>
              <ArrowRight className="w-4 h-4" style={{ color: "var(--muted-foreground)", marginLeft: "auto", flexShrink: 0 }} />
            </button>
          )}

          <section>
            <SectionHeading icon={Sparkles} title="Tailor & apply" sub="Customize for this job — we never auto-apply" />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <button style={ghostBtn} onClick={scoreFit} disabled={scoring}>
                {scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Score my fit
              </button>

              <div>
                <Label icon={FileText} text="Resume" />
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={posting.appliedResumeId ?? ""}
                    onChange={(e) => onUpdate({ appliedResumeId: e.target.value || undefined })}>
                    <option value="">Attach a resume…</option>
                    {savedResumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button style={{ ...ghostBtn, flexShrink: 0 }} onClick={() => onNavigate?.("resume_generation")}>
                    Builder <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button style={{ ...ghostBtn, width: "100%", justifyContent: "center" }} onClick={generateResume} disabled={resumeGenerating}>
                  {resumeGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Generate a tailored resume
                </button>
                {resumeDraft && (
                  <div style={{ marginTop: 8 }}>
                    <textarea value={resumeDraft} onChange={(e) => { setResumeDraft(e.target.value); setResumeSaved(false); }}
                      style={{ ...inputStyle, height: 220, padding: 14, resize: "vertical" as const, lineHeight: 1.5, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }} />
                    <button style={{ ...primaryBtn, marginTop: 8 }} onClick={saveResume} disabled={resumeSaved}>
                      {resumeSaved ? "Saved & attached" : "Save resume"}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <Label icon={Mail} text="Cover letter" />
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={posting.appliedCoverLetterId ?? ""}
                    onChange={(e) => onUpdate({ appliedCoverLetterId: e.target.value || undefined })}>
                    <option value="">Attach a cover letter…</option>
                    {savedCovers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button style={{ ...ghostBtn, flexShrink: 0 }} onClick={() => onNavigate?.("cover_letter")}>
                    Builder <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button style={{ ...ghostBtn, width: "100%", justifyContent: "center" }} onClick={generateCover} disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Generate a tailored draft
                </button>
                {coverDraft && (
                  <div style={{ marginTop: 8 }}>
                    <textarea value={coverDraft} onChange={(e) => { setCoverDraft(e.target.value); setCoverSaved(false); }}
                      style={{ ...inputStyle, height: 200, padding: 14, resize: "vertical" as const, lineHeight: 1.5 }} />
                    <button style={{ ...primaryBtn, marginTop: 8 }} onClick={saveCover} disabled={coverSaved}>
                      {coverSaved ? "Saved to your cover letters" : "Save cover letter"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section>
            <SectionHeading icon={Briefcase} title="Application" sub="Status, dates & notes" />
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={posting.status}
                onChange={(e) => {
                  const s = e.target.value as JobStatus;
                  onUpdate({ status: s, appliedAt: s === "applied" && !posting.appliedAt ? new Date().toISOString() : posting.appliedAt });
                }}>
                {JOB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
            <textarea placeholder="Notes — recruiter name, referral, next steps…" value={notes}
              onChange={(e) => setNotes(e.target.value)} onBlur={() => onUpdate({ notes })}
              style={{ ...inputStyle, height: 100, padding: 14, resize: "vertical" as const, lineHeight: 1.5 }} />
          </section>

          {(posting.description || posting.url) && (
            <section>
              <SectionHeading icon={FileText} title="Job description" />
              <div style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, maxHeight: 420, overflowY: "auto" }}>
                <JobDescription
                  description={posting.description}
                  url={posting.url}
                  onLoaded={(text) => onUpdate({ description: text })}
                />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
});
