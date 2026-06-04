import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ComboInput } from "@/components/ui/ComboInput";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { JOB_TITLES, SP500_COMPANIES, UNIVERSITIES, DEGREE_TYPES, COMMON_MAJORS, COMMON_MINORS, SKILLS_BY_CATEGORY } from "@/lib/profileOptions";
import { COMMON_ROLES } from "@/config/workflows";
import { Plus, Trash2, Loader2, Sparkles, ArrowLeft, LayoutTemplate, User, Wand2, X, Upload, ChevronDown, ChevronUp, CheckCircle2, Info, Bookmark, FileText, Scissors } from "lucide-react";
import { SkillsPicker } from "@/components/ui/SkillsPicker";
import { suggestWorkExperienceBullets, parseProfileFromImport } from "@/services/geminiService";
import { useUserProfile } from "@/context/UserProfileContext";
import { parseDocumentToText } from "@/services/documentParserService";
import { buildResumeDocumentFromText, ResumeImportError } from "@/services/resumeImportService";

const DRAFT_KEY = "resume_builder_draft";

const fieldStyle: React.CSSProperties = {
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  height: 48,
  fontSize: 14,
  padding: "0 14px",
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

// Item 8: derive skill suggestions from job title keywords
function getSkillsForRoles(roles: string[]): string[] {
  const roleText = roles.filter(Boolean).join(" ").toLowerCase();
  if (!roleText) return [];
  const categoryMap: Record<string, string[]> = {
    "Frontend Development": ["frontend", "front-end", "ui engineer", "react", "vue", "angular", "web developer"],
    "Backend Development": ["backend", "back-end", "server", "api", "node", "java", "python", "golang", "rails", "software engineer"],
    "Data & Analytics": ["data", "analyst", "analytics", "scientist", "machine learning", "ai engineer"],
    "Cloud & DevOps": ["devops", "cloud", "infrastructure", "sre", "platform engineer", "site reliability"],
    "Mobile Development": ["mobile", "ios", "android", "react native", "flutter"],
    "Product & Strategy": ["product manager", "product owner", "strategy"],
    "Design": ["designer", "ux", "figma"],
    "Business & Operations": ["operations", "business analyst", "biz ops"],
    "Finance & Accounting": ["finance", "financial", "accounting", "controller"],
    "Sales": ["sales", "account executive", "business development", "sdr", "bdr"],
  };
  const suggested = new Set<string>();
  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some((kw) => roleText.includes(kw))) {
      const catSkills: string[] = (SKILLS_BY_CATEGORY as Record<string, string[]>)[category] ?? [];
      catSkills.slice(0, 6).forEach((s) => suggested.add(s));
    }
  }
  return Array.from(suggested).slice(0, 12);
}

function MiniTemplatePreview({ type }: { type: string }) {
  if (type === "Modern & Clean") {
    return (
      <div className="w-full h-full bg-white shadow-sm p-2.5 flex flex-col gap-2 rounded-sm overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="flex justify-between items-center pb-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex flex-col gap-1 w-2/3">
            <div className="h-2.5 w-3/4 rounded-sm" style={{ background: "var(--foreground)" }}></div>
            <div className="h-1.5 w-1/2 rounded-sm" style={{ background: "var(--muted-foreground)", opacity: 0.5 }}></div>
          </div>
          <div className="flex gap-1.5 flex-col items-end">
            <div className="h-1 w-12 rounded-px" style={{ background: "var(--border)" }}></div>
            <div className="h-1 w-16 rounded-px" style={{ background: "var(--border)" }}></div>
          </div>
        </div>
        <div className="flex gap-2.5 h-full pt-1">
          <div className="w-1/3 flex flex-col gap-2 pr-2" style={{ borderRight: "1px solid var(--border)" }}>
            <div className="h-1.5 w-full rounded-sm" style={{ background: "rgba(217,119,87,0.18)" }}></div>
            <div className="space-y-1">
              <div className="h-1 w-full rounded-px" style={{ background: "var(--border)" }}></div>
              <div className="h-1 w-5/6 rounded-px" style={{ background: "var(--border)" }}></div>
            </div>
            <div className="h-1.5 w-full rounded-sm mt-1" style={{ background: "rgba(217,119,87,0.18)" }}></div>
            <div className="space-y-1">
              <div className="h-1 w-full rounded-px" style={{ background: "var(--border)" }}></div>
              <div className="h-1 w-full rounded-px" style={{ background: "var(--border)" }}></div>
            </div>
          </div>
          <div className="w-2/3 flex flex-col gap-2">
            <div className="h-1.5 w-1/3 rounded-sm" style={{ background: "var(--border)" }}></div>
            <div className="space-y-1 pb-1">
              <div className="flex justify-between">
                <div className="h-1.5 w-1/2 rounded-px" style={{ background: "var(--foreground)", opacity: 0.7 }}></div>
                <div className="h-1 w-1/5 rounded-px" style={{ background: "var(--border)" }}></div>
              </div>
              <div className="h-1 w-full rounded-px" style={{ background: "var(--border)" }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (type === "Tech Focused") {
    return (
      <div className="w-full h-full bg-[#0d1117] border border-zinc-800 p-2.5 flex flex-col gap-1.5 rounded-sm overflow-hidden font-mono">
        <div className="flex gap-1 mb-1 border-b border-zinc-800 pb-2 items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          <div className="ml-2 h-1 w-16 bg-zinc-700 rounded-px"></div>
        </div>
        <div className="h-2.5 w-1/2 bg-blue-400/80 rounded-sm mt-1"></div>
        <div className="h-1 w-1/3 bg-emerald-400/80 rounded-sm mb-1"></div>
        <div className="flex gap-1 flex-wrap mb-1">
          <div className="h-1.5 w-8 bg-zinc-800 rounded-sm"></div>
          <div className="h-1.5 w-12 bg-zinc-800 rounded-sm"></div>
          <div className="h-1.5 w-10 bg-zinc-800 rounded-sm"></div>
        </div>
        <div className="space-y-1 mt-1">
          <div className="flex gap-2 items-center"><div className="w-0.5 h-3 bg-blue-500 rounded-full"></div><div className="h-1.5 w-1/3 bg-zinc-300 rounded-sm"></div></div>
          <div className="h-1 w-full bg-zinc-600 rounded-px ml-2.5"></div>
          <div className="h-1 w-5/6 bg-zinc-600 rounded-px ml-2.5"></div>
        </div>
      </div>
    );
  }
  if (type === "Executive") {
    return (
      <div className="w-full h-full bg-white border border-zinc-300 p-3 flex flex-col items-center gap-1.5 rounded-sm overflow-hidden">
        <div className="h-3 w-1/2 bg-slate-900 rounded-sm mb-0.5"></div>
        <div className="flex gap-3 mb-0.5">
          <div className="h-1 w-8 bg-slate-400 rounded-px"></div>
          <div className="h-1 w-8 bg-slate-400 rounded-px"></div>
        </div>
        <div className="w-full h-[2px] bg-slate-900 mt-1 mb-1"></div>
        <div className="w-full text-left flex flex-col gap-2">
          <div>
            <div className="h-1.5 w-1/4 bg-slate-800 rounded-sm mb-1"></div>
            <div className="flex justify-between w-full mb-0.5">
              <div className="h-1 w-1/3 bg-slate-700 rounded-px"></div>
              <div className="h-1 w-1/5 bg-slate-400 rounded-px"></div>
            </div>
            <div className="space-y-1 w-full">
              <div className="h-1 w-full bg-slate-200 rounded-px"></div>
              <div className="h-1 w-3/4 bg-slate-200 rounded-px"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (type === "Creative / Portfolio") {
    return (
      <div className="w-full h-full bg-[#fdfbf7] p-2 flex flex-col gap-2 rounded-sm overflow-hidden" style={{ border: "1px solid rgba(217,119,87,0.25)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full shrink-0 shadow-sm" style={{ background: "linear-gradient(135deg, #E8B948, #D97757)" }}></div>
          <div className="flex flex-col gap-1 w-full">
            <div className="h-2 w-2/3 rounded-sm" style={{ background: "var(--foreground)" }}></div>
            <div className="h-1.5 w-1/3 rounded-sm" style={{ background: "rgba(217,119,87,0.6)" }}></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="h-10 rounded-sm p-1 flex items-end" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
            <div className="h-1 w-1/2 rounded-px" style={{ background: "var(--border)" }}></div>
          </div>
          <div className="h-10 rounded-sm p-1 flex items-end" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
            <div className="h-1 w-2/3 rounded-px" style={{ background: "var(--border)" }}></div>
          </div>
        </div>
      </div>
    );
  }
  if (type === "Photography / Visual") {
    return (
      <div className="w-full h-full bg-zinc-950 p-2 flex flex-col gap-2 rounded-sm overflow-hidden border border-zinc-800">
        <div className="flex justify-center w-full mb-1">
          <div className="h-2 w-1/3 bg-zinc-100 rounded-sm"></div>
        </div>
        <div className="columns-2 gap-1.5 space-y-1.5">
          <div className="w-full h-8 bg-zinc-800 rounded-sm opacity-80 border border-zinc-700"></div>
          <div className="w-full h-12 bg-zinc-800 rounded-sm opacity-80 border border-zinc-700"></div>
          <div className="w-full h-10 bg-zinc-800 rounded-sm opacity-80 border border-zinc-700"></div>
          <div className="w-full h-6 bg-zinc-800 rounded-sm opacity-80 border border-zinc-700"></div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full h-full bg-white p-2.5 flex flex-col gap-1.5 rounded-sm overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="h-2.5 w-2/5 mb-1.5 rounded-sm" style={{ background: "var(--foreground)" }}></div>
      {[["3/4", "full", "5/6"], ["2/3", "full"], ["4/5", "11/12"]].map((lines, i) => (
        <div key={i} className="flex gap-2.5 mb-1.5">
          <div className="w-0.5 h-full ml-1 rounded-full" style={{ background: "var(--border)" }}></div>
          <div className="flex flex-col gap-1.5 w-full -ml-1">
            <div className={`h-1.5 w-${lines[0]} rounded-px`} style={{ background: "var(--muted-foreground)", opacity: 0.5 }}></div>
            {lines.slice(1).map((w, j) => (
              <div key={j} className={`h-1 w-${w} rounded-px`} style={{ background: "var(--border)" }}></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const TEMPLATES = [
  { id: "Modern & Clean", name: "Modern & Clean", description: "Minimalist and professional layout." },
  { id: "Tech Focused", name: "Tech Focused", description: "Highlight skills and projects for IT roles." },
  { id: "Executive", name: "Executive", description: "Traditional, authoritative structure." },
  { id: "Creative / Portfolio", name: "Creative / Portfolio", description: "Vibrant visual identity for design roles." },
  { id: "Photography / Visual", name: "Photography / Visual", description: "Grid layout for prioritizing image portfolios." },
  { id: "Academic / Research", name: "Academic / Research", description: "Detailed format for publications and studies." }
];

export function ResumeGenerationForm({ onSubmit, isGenerating, onAnalyze, onTailor, onImportToEditor }: { onSubmit: (data: any) => void; isGenerating: boolean; onAnalyze?: (resumeText: string, file: File) => void; onTailor?: (resumeText: string, resumeName: string) => void; onImportToEditor?: (markdown: string) => void }) {
  const { profile, loading } = useUserProfile();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [step0ResumeUploaded, setStep0ResumeUploaded] = useState<{ text: string; fileName: string; file: File } | null>(null);
  // Which post-upload action is currently running its clean import (drives per-card spinner).
  const [processingChoice, setProcessingChoice] = useState<"analyze" | "tailor" | "editor" | null>(null);
  const formRootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let el = formRootRef.current?.parentElement ?? null;
    while (el) {
      if (el.scrollHeight > el.clientHeight) { el.scrollTop = 0; break; }
      el = el.parentElement;
    }
  }, [step]);
  const [startMethod, setStartMethod] = useState<"scratch" | "linkedin" | "resume" | null>(null);
  const [uploadedResumeText, setUploadedResumeText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [step0Uploading, setStep0Uploading] = useState<"linkedin" | "resume" | null>(null);
  const [step0Error, setStep0Error] = useState<string | null>(null);
  const step0LinkedinRef = useRef<HTMLInputElement>(null);
  const step0ResumeRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState("Modern & Clean");
  const [targetRoleSelect, setTargetRoleSelect] = useState(profile.targetRole ? "Other" : "");
  const [targetRole, setTargetRole] = useState(profile.targetRole ?? "");

  const [personalInfo, setPersonalInfo] = useState(() => ({
    name: profile.fullName ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    linkedin: profile.linkedin ?? "",
    github: profile.github ?? "",
    portfolio: profile.portfolio ?? "",
  }));

  const [workHistory, setWorkHistory] = useState(() =>
    profile.workHistory?.length
      ? profile.workHistory.map(({ company, role, startDate, endDate, responsibilities }) => ({
          company, role, startDate, endDate, responsibilities,
        }))
      : [{ company: "", role: "", startDate: "", endDate: "", responsibilities: "" }]
  );

  const [education, setEducation] = useState(() =>
    profile.education?.length
      ? profile.education.map(({ university, degree, graduationYear, major, minor }) => ({
          university, degree, graduationYear, major: major ?? "", minor: minor ?? "",
        }))
      : [{ university: "", degree: "", graduationYear: "", major: "", minor: "" }]
  );

  const [skills, setSkills] = useState<string[]>(() => profile.skills ?? []);
  const [newSkill, setNewSkill] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  // Item 1: profile pre-fill banner
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(false);
  const [profileWasUsed, setProfileWasUsed] = useState(false);

  // Item 2: track per-entry auto-generated state
  const [autoGeneratedEntries, setAutoGeneratedEntries] = useState<Set<number>>(new Set());
  const [autoGeneratingEntries, setAutoGeneratingEntries] = useState<Set<number>>(new Set());
  const [isGeneratingBullets, setIsGeneratingBullets] = useState<number | null>(null);

  // Item 5: LinkedIn/resume import
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importType, setImportType] = useState<"linkedin" | "resume">("linkedin");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const linkedinFileRef = useRef<HTMLInputElement>(null);
  const resumeFileRef = useRef<HTMLInputElement>(null);

  // Item 7: collapsible entries
  const [expandedWorkIndices, setExpandedWorkIndices] = useState<Set<number>>(() => new Set([0]));
  const [expandedEduIndices, setExpandedEduIndices] = useState<Set<number>>(() => new Set([0]));

  // Item 8: suggested skills from roles
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);

  // Item 10: localStorage draft restore
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileLoadedRef = useRef(false);

  // Check for draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setHasDraft(true);
    } catch {}
  }, []);

  // Once profile finishes loading, back-fill empty fields
  useEffect(() => {
    if (loading || profileLoadedRef.current) return;
    profileLoadedRef.current = true;

    const hasProfileData = !!(profile.workHistory?.length || profile.fullName || profile.email);

    if (!personalInfo.name && !personalInfo.email) {
      setPersonalInfo({
        name: profile.fullName ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        linkedin: profile.linkedin ?? "",
        github: profile.github ?? "",
        portfolio: profile.portfolio ?? "",
      });
    }

    if (workHistory.length === 1 && !workHistory[0].company && !workHistory[0].role && profile.workHistory?.length) {
      const mapped = profile.workHistory.map(({ company, role, startDate, endDate, responsibilities }) => ({
        company, role, startDate, endDate, responsibilities,
      }));
      setWorkHistory(mapped);
      // Expand all loaded entries
      setExpandedWorkIndices(new Set(mapped.map((_, i) => i)));
    }

    if (education.length === 1 && !education[0].university && profile.education?.length) {
      const mapped = profile.education.map(({ university, degree, graduationYear, major, minor }) => ({
        university, degree, graduationYear, major: major ?? "", minor: minor ?? "",
      }));
      setEducation(mapped);
      setExpandedEduIndices(new Set(mapped.map((_, i) => i)));
    }

    if (skills.length === 0 && profile.skills?.length) {
      setSkills(profile.skills);
    }

    if (!targetRole && profile.targetRole) {
      setTargetRoleSelect("Other");
      setTargetRole(profile.targetRole);
    }

    if (hasProfileData) setProfileWasUsed(true);
  }, [loading]);

  // Item 2: auto-suggest bullets after profile loads for entries with role but no responsibilities
  useEffect(() => {
    if (loading) return;
    const effectiveRole = targetRoleSelect === "Other" ? targetRole : targetRoleSelect;
    if (!effectiveRole) return;

    workHistory.forEach((work, idx) => {
      if (work.role && !work.responsibilities && !autoGeneratedEntries.has(idx) && !autoGeneratingEntries.has(idx)) {
        setAutoGeneratingEntries((prev) => new Set([...prev, idx]));
        suggestWorkExperienceBullets(work.role, work.company)
          .then((suggestions) => {
            setWorkHistory((prev) => {
              const updated = [...prev];
              if (!updated[idx].responsibilities) {
                updated[idx] = { ...updated[idx], responsibilities: suggestions };
              }
              return updated;
            });
            setAutoGeneratedEntries((prev) => new Set([...prev, idx]));
          })
          .catch(() => {})
          .finally(() => {
            setAutoGeneratingEntries((prev) => {
              const next = new Set(prev);
              next.delete(idx);
              return next;
            });
          });
      }
    });
  }, [loading, targetRole, targetRoleSelect]);

  // Item 8: update suggested skills when work history changes
  useEffect(() => {
    const roles = workHistory.map((w) => w.role);
    setSuggestedSkills(getSkillsForRoles(roles));
  }, [workHistory]);

  // Item 10: debounced save draft to localStorage — PII-free (name/email/work history reload from Supabase on re-entry)
  useEffect(() => {
    if (!profileLoadedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const draft = { targetRole, targetRoleSelect, jobDescription, template };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {}
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [targetRole, targetRoleSelect, jobDescription, template]);

  const restoreDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.targetRole) setTargetRole(d.targetRole);
      if (d.targetRoleSelect) setTargetRoleSelect(d.targetRoleSelect);
      if (d.jobDescription) setJobDescription(d.jobDescription);
      if (d.template) setTemplate(d.template);
    } catch {}
    setHasDraft(false);
    setDraftBannerDismissed(true);
  }, []);

  const handleWorkChange = (index: number, field: string, value: string) => {
    const newWork = [...workHistory];
    newWork[index] = { ...newWork[index], [field]: value };
    setWorkHistory(newWork);
  };

  const handleSuggestBullets = async (index: number) => {
    const work = workHistory[index];
    if (!work.role) return;
    setIsGeneratingBullets(index);
    try {
      const effectiveRole = targetRoleSelect === "Other" ? targetRole : targetRoleSelect;
      const suggestions = await suggestWorkExperienceBullets(work.role, work.company);
      const newWork = [...workHistory];
      const currentText = newWork[index].responsibilities;
      newWork[index].responsibilities = currentText ? currentText + "\n\n" + suggestions : suggestions;
      setWorkHistory(newWork);
      setAutoGeneratedEntries((prev) => { const n = new Set(prev); n.delete(index); return n; });
    } catch (err) {
      console.error("Failed to generate bullets:", err);
    } finally {
      setIsGeneratingBullets(null);
    }
  };

  const addWork = () => {
    const newIdx = workHistory.length;
    setWorkHistory([...workHistory, { company: "", role: "", startDate: "", endDate: "", responsibilities: "" }]);
    setExpandedWorkIndices((prev) => new Set([...prev, newIdx]));
  };

  const removeWork = (index: number) => {
    setWorkHistory(workHistory.filter((_, i) => i !== index));
    setExpandedWorkIndices((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => { if (i < index) next.add(i); else if (i > index) next.add(i - 1); });
      return next;
    });
  };

  const handleEduChange = (index: number, field: string, value: string) => {
    const newEdu = [...education];
    newEdu[index] = { ...newEdu[index], [field]: value };
    setEducation(newEdu);
  };

  const addEdu = () => {
    const newIdx = education.length;
    setEducation([...education, { university: "", degree: "", graduationYear: "", major: "", minor: "" }]);
    setExpandedEduIndices((prev) => new Set([...prev, newIdx]));
  };

  const removeEdu = (index: number) => {
    setEducation(education.filter((_, i) => i !== index));
    setExpandedEduIndices((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => { if (i < index) next.add(i); else if (i > index) next.add(i - 1); });
      return next;
    });
  };

  // Item 5: PDF/TXT file upload handler (used for both LinkedIn PDF and resume)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "linkedin" | "resume") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setIsImporting(true);
    const ref = type === "linkedin" ? linkedinFileRef : resumeFileRef;
    try {
      const text = await parseDocumentToText(file);
      if (text.trim().length < 100) {
        setImportError("Could not extract enough text. Try pasting the text manually.");
        setIsImporting(false);
        if (ref.current) ref.current.value = "";
        return;
      }
      await runImport(text, type);
    } catch (err) {
      console.error("File extraction error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(`Failed to read file: ${msg}. Try pasting the text manually.`);
      setIsImporting(false);
    } finally {
      if (ref.current) ref.current.value = "";
    }
  };

  // Shared import core
  const runImport = async (text: string, type: "linkedin" | "resume") => {
    setIsImporting(true);
    try {
      const parsed = await parseProfileFromImport({ type, text });
      const str = (v: unknown) => (v == null ? "" : String(v));
      if (parsed.fullName) setPersonalInfo((p) => ({ ...p, name: str(parsed.fullName) || p.name, email: str(parsed.email) || p.email, phone: str(parsed.phone) || p.phone, linkedin: str(parsed.linkedin) || p.linkedin, github: str(parsed.github) || p.github, portfolio: str(parsed.portfolio) || p.portfolio }));
      if (parsed.workHistory?.length) {
        const mapped = parsed.workHistory.map((w) => ({ company: str(w.company), role: str(w.role), startDate: str(w.startDate), endDate: str(w.endDate), responsibilities: str(w.responsibilities) }));
        setWorkHistory(mapped);
        setExpandedWorkIndices(new Set(mapped.map((_, i) => i)));
      }
      if (parsed.education?.length) {
        const mapped = parsed.education.map((e) => ({ university: str(e.university), degree: str(e.degree), graduationYear: str(e.graduationYear), major: str(e.major), minor: str(e.minor) }));
        setEducation(mapped);
        setExpandedEduIndices(new Set(mapped.map((_, i) => i)));
      }
      if (parsed.skills?.length) setSkills(parsed.skills);
      if (parsed.targetRole) { setTargetRoleSelect("Other"); setTargetRole(parsed.targetRole); }
      setShowImport(false);
      setImportText("");
    } catch (err) {
      console.error("Import failed:", err);
      setImportError("Failed to parse the content. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  // Step 0: file upload handler for the start-method picker
  const handleStep0Upload = async (e: React.ChangeEvent<HTMLInputElement>, type: "linkedin" | "resume") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep0Error(null);
    setStep0Uploading(type);
    const ref = type === "linkedin" ? step0LinkedinRef : step0ResumeRef;
    try {
      const text = await parseDocumentToText(file);
      if (text.trim().length < 100) {
        setStep0Error("Could not extract enough text from this file.");
        return;
      }
      if (type === "resume") {
        setStep0ResumeUploaded({ text, fileName: file.name, file });
        // Stay on step 0 — let user choose Analyze / Tailor / Open in editor
        return;
      }
      // LinkedIn: run the same clean import and open the result in the editor.
      const { markdown } = await buildResumeDocumentFromText(text, undefined, "linkedin");
      onImportToEditor?.(markdown);
    } catch (err) {
      setStep0Error(
        err instanceof ResumeImportError
          ? err.message
          : "Failed to read file. Please try again."
      );
    } finally {
      setStep0Uploading(null);
      if (ref.current) ref.current.value = "";
    }
  };

  // Item 5: import handler (text paste fallback)
  const handleImport = async () => {
    if (!importText.trim()) return;
    await runImport(importText.trim(), importType);
  };

  // Shared "clean import": extract → AI parse → clean templated markdown, then route
  // the result to the chosen destination. Used by every post-upload action so analyze,
  // tailor, and open-in-editor all operate on the same clean template (not raw text).
  const handleResumeChoice = async (choice: "analyze" | "tailor" | "editor") => {
    if (!step0ResumeUploaded || processingChoice) return;
    setStep0Error(null);
    setProcessingChoice(choice);
    try {
      const { markdown } = await buildResumeDocumentFromText(step0ResumeUploaded.text);
      if (choice === "analyze") onAnalyze?.(markdown, step0ResumeUploaded.file);
      else if (choice === "tailor") onTailor?.(markdown, step0ResumeUploaded.fileName.replace(/\.[^.]+$/, ""));
      else onImportToEditor?.(markdown);
      setStep0ResumeUploaded(null);
    } catch (err) {
      setStep0Error(
        err instanceof ResumeImportError
          ? err.message
          : "Couldn't import this resume. Please try again."
      );
    } finally {
      setProcessingChoice(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    onSubmit({ template, targetRole: targetRoleSelect === "Other" ? targetRole : targetRoleSelect, personalInfo, workHistory, education, skills: skills.join(", "), jobDescription, uploadedResumeText });
  };

  const sectionHeadStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--foreground)",
    paddingBottom: 12,
    marginBottom: 16,
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const entryCardStyle: React.CSSProperties = {
    padding: 20,
    border: "1px solid var(--border)",
    borderRadius: 16,
    background: "var(--muted)",
    marginBottom: 16,
  };

  if (step === 0) {
    const cardBase: React.CSSProperties = { borderRadius: 20, border: "2px solid var(--border)", background: "var(--card)", overflow: "hidden", display: "flex", flexDirection: "column", transition: "border-color 0.15s, box-shadow 0.15s", cursor: "pointer" };
    const cardActive: React.CSSProperties = { borderColor: "var(--primary)", boxShadow: "0 0 0 3px rgba(217,119,87,0.12)" };
    return (
      <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl font-semibold" style={{ color: "var(--foreground)" }}>How would you like to start?</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>Choose a starting point — you can edit everything afterward.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Start fresh */}
          <div style={{ ...cardBase, ...(startMethod === "scratch" ? cardActive : {}) }} onClick={() => { setStartMethod("scratch"); setStep(1); }}>
            <div style={{ padding: "32px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flex: 1 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(217,119,87,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus className="w-6 h-6" style={{ color: "var(--primary)" }} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", textAlign: "center" }}>Start fresh</div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.5 }}>Build from scratch using your profile details.</div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", background: "var(--muted)", textAlign: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>Choose template →</span>
            </div>
          </div>

          {/* Import LinkedIn PDF */}
          <div style={{ ...cardBase, ...(startMethod === "linkedin" ? cardActive : {}) }}
            onClick={() => step0LinkedinRef.current?.click()}>
            <div style={{ padding: "32px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flex: 1 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(10,102,194,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {step0Uploading === "linkedin" ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#0a66c2" }} /> : <Upload className="w-6 h-6" style={{ color: "#0a66c2" }} />}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", textAlign: "center" }}>Import LinkedIn PDF or DOCX</div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.5 }}>Go to LinkedIn → profile → <strong>More → Save to PDF</strong>, then upload here.</div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", background: "var(--muted)", textAlign: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0a66c2" }}>{step0Uploading === "linkedin" ? "Importing…" : "Upload PDF / DOCX →"}</span>
            </div>
            <input ref={step0LinkedinRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: "none" }} onChange={(e) => handleStep0Upload(e, "linkedin")} />
          </div>

          {/* Import existing resume */}
          <div style={{ ...cardBase, ...(startMethod === "resume" ? cardActive : {}) }}
            onClick={() => { setStep0Error(null); step0ResumeRef.current?.click(); }}>
            <div style={{ padding: "32px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flex: 1 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(47,107,79,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {step0Uploading === "resume" ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--forest)" }} /> : <FileText className="w-6 h-6" style={{ color: "var(--forest)" }} />}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", textAlign: "center" }}>Upload a resume</div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.5 }}>Upload your current resume to analyze, improve, or tailor it to a job description.</div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", background: "var(--muted)", textAlign: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--forest)" }}>{step0Uploading === "resume" ? "Extracting…" : "Upload PDF / DOCX →"}</span>
            </div>
            <input ref={step0ResumeRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" style={{ display: "none" }} onChange={(e) => handleStep0Upload(e, "resume")} />
          </div>
        </div>

        {step0ResumeUploaded && (
          <div className="mt-6 animate-in fade-in duration-300" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "24px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--forest)" }} />
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>{step0ResumeUploaded.fileName}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 18 }}>What would you like to do with this resume?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Analyze */}
              {onAnalyze && (
                <button
                  type="button"
                  disabled={!!processingChoice}
                  onClick={() => handleResumeChoice("analyze")}
                  style={{ borderRadius: 16, border: "2px solid var(--border)", background: "var(--card)", cursor: processingChoice ? "wait" : "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: "18px 20px", transition: "border-color 0.15s, box-shadow 0.15s", textAlign: "left", opacity: processingChoice && processingChoice !== "analyze" ? 0.5 : 1 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(217,119,87,0.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(217,119,87,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {processingChoice === "analyze" ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} /> : <Info className="w-5 h-5" style={{ color: "var(--primary)" }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>{processingChoice === "analyze" ? "Importing…" : "Analyze my resume"}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>Get an AI score and improvement tips.</div>
                  </div>
                </button>
              )}

              {/* Tailor to a job */}
              {onTailor && (
                <button
                  type="button"
                  disabled={!!processingChoice}
                  onClick={() => handleResumeChoice("tailor")}
                  style={{ borderRadius: 16, border: "2px solid var(--border)", background: "var(--card)", cursor: processingChoice ? "wait" : "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: "18px 20px", transition: "border-color 0.15s, box-shadow 0.15s", textAlign: "left", opacity: processingChoice && processingChoice !== "tailor" ? 0.5 : 1 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--highlight)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,185,72,0.18)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(232,185,72,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {processingChoice === "tailor" ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--highlight)" }} /> : <Scissors className="w-5 h-5" style={{ color: "var(--highlight)" }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>{processingChoice === "tailor" ? "Importing…" : "Tailor to a job"}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>Match it to a specific job description.</div>
                  </div>
                </button>
              )}

              {/* Open directly in the editor (deterministic — preserves your content) */}
              {onImportToEditor && (
                <button
                  type="button"
                  disabled={!!processingChoice}
                  onClick={() => handleResumeChoice("editor")}
                  style={{ borderRadius: 16, border: "2px solid var(--border)", background: "var(--card)", cursor: processingChoice ? "wait" : "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: "18px 20px", transition: "border-color 0.15s, box-shadow 0.15s", textAlign: "left", opacity: processingChoice && processingChoice !== "editor" ? 0.5 : 1 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(217,119,87,0.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(217,119,87,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {processingChoice === "editor" ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} /> : <LayoutTemplate className="w-5 h-5" style={{ color: "var(--primary)" }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>{processingChoice === "editor" ? "Importing…" : "Open in editor"}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>Drop it into a clean template, ready to edit.</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        {step0Error && (
          <div className="flex items-center gap-2 mt-5" style={{ padding: "10px 16px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 10 }}>
            <X className="w-4 h-4 shrink-0" style={{ color: "#dc2626" }} />
            <span style={{ fontSize: 13, color: "#dc2626" }}>{step0Error}</span>
          </div>
        )}
      </div>
    );
  }

  if (step === 1) {
    const matchCard = uploadedResumeText ? [{
      id: "Match uploaded style",
      name: "Match my resume",
      description: `Mirror the layout and style of "${uploadedFileName || "your uploaded PDF"}".`,
    }] : [];
    const allTemplates = [...matchCard, ...TEMPLATES];
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <button onClick={() => setStep(0)} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--muted)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}>
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="font-display text-3xl font-semibold" style={{ color: "var(--foreground)" }}>Choose a template</h2>
          </div>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>Click a template to continue.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {allTemplates.map(t => (
            <div
              key={t.id}
              onClick={() => { setTemplate(t.id); setStep(2); }}
              style={{
                cursor: "pointer",
                borderRadius: 16,
                overflow: "hidden",
                border: template === t.id ? "2px solid var(--primary)" : "2px solid var(--border)",
                boxShadow: template === t.id ? "0 0 0 3px rgba(217,119,87,0.12)" : "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
                background: "var(--card)",
              }}
            >
              <div style={{ aspectRatio: "1/1.2", background: "var(--muted)", padding: 20, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                {t.id === "Match uploaded style" ? (
                  <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <FileText className="w-10 h-10" style={{ color: "var(--primary)", opacity: 0.7 }} />
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>Mirror uploaded PDF layout</span>
                  </div>
                ) : (
                  <MiniTemplatePreview type={t.id} />
                )}
              </div>
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--card)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{t.description}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    );
  }

  return (
    <div ref={formRootRef} className="w-full mx-auto max-w-4xl animate-in slide-in-from-right-4 duration-300" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, overflow: "hidden" }}>
      {/* Card header */}
      <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid var(--border)", position: "relative", textAlign: "center" }}>
        <button
          onClick={() => setStep(1)}
          style={{ position: "absolute", left: 20, top: 24, width: 36, height: 36, borderRadius: "50%", background: "var(--muted)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="font-display text-2xl font-semibold mt-1" style={{ color: "var(--foreground)" }}>Fill in your details</h2>
        <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 4 }}>We'll use this to draft your resume</p>
      </div>

      <div style={{ padding: "28px 32px" }}>

        {/* Item 10: Draft restore banner */}
        {hasDraft && !draftBannerDismissed && (
          <div className="flex items-center justify-between gap-3 mb-5 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(47,107,79,0.08)", border: "1px solid rgba(47,107,79,0.25)", color: "var(--forest)" }}>
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 shrink-0" />
              <span>You have an unsaved draft — resume where you left off?</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={restoreDraft} style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 8, background: "rgba(47,107,79,0.15)", border: "none", cursor: "pointer", color: "var(--forest)", fontFamily: "inherit" }}>Resume draft</button>
              <button type="button" onClick={() => { setDraftBannerDismissed(true); setHasDraft(false); try { localStorage.removeItem(DRAFT_KEY); } catch {} }} style={{ fontSize: 12, fontWeight: 600, padding: "4px 8px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontFamily: "inherit" }}>Dismiss</button>
            </div>
          </div>
        )}

        {/* Item 1: Profile pre-fill banner */}
        {profileWasUsed && !profileBannerDismissed && (
          <div className="flex items-center justify-between gap-3 mb-5 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(217,119,87,0.07)", border: "1px solid rgba(217,119,87,0.20)", color: "var(--primary)" }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>We pre-filled this form from your profile. Review and adjust anything before generating.</span>
            </div>
            <button type="button" onClick={() => setProfileBannerDismissed(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: 0, flexShrink: 0 }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {!profileWasUsed && !loading && (
          <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(232,185,72,0.08)", border: "1px solid rgba(232,185,72,0.20)", color: "var(--highlight)" }}>
            <Info className="w-4 h-4 shrink-0" />
            <span>Your profile is empty — fill in the fields below, or <a href="/profile" style={{ fontWeight: 700, textDecoration: "underline", color: "inherit" }}>complete your profile first</a> to auto-fill everything.</span>
          </div>
        )}

        {/* Item 5: Import section */}
        <div className="mb-6" style={{ border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => { setShowImport((v) => !v); setImportError(null); }}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold"
            style={{ background: "var(--muted)", border: "none", cursor: "pointer", color: "var(--foreground)", fontFamily: "inherit" }}
          >
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4" style={{ color: "var(--primary)" }} />
              Import from LinkedIn or Resume
            </span>
            {showImport ? <ChevronUp className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />}
          </button>
          {showImport && (
            <div style={{ padding: 20, borderTop: "1px solid var(--border)", background: "var(--card)" }}>
              {/* Tab switcher */}
              <div className="flex gap-2 mb-4">
                {(["linkedin", "resume"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => { setImportType(t); setImportError(null); }}
                    style={{ padding: "5px 14px", borderRadius: 9999, fontSize: 12, fontWeight: 600, border: "1px solid", fontFamily: "inherit", cursor: "pointer", background: importType === t ? "var(--primary)" : "transparent", borderColor: importType === t ? "var(--primary)" : "var(--border)", color: importType === t ? "#fff" : "var(--muted-foreground)" }}>
                    {t === "linkedin" ? "LinkedIn" : "Resume"}
                  </button>
                ))}
              </div>

              {importType === "linkedin" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    On LinkedIn, go to your profile → <strong>More → Save to PDF</strong>. Upload that file here and we'll extract your work history, education, and skills automatically.
                  </p>
                  <input
                    ref={linkedinFileRef}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    style={{ display: "none" }}
                    onChange={(e) => handleFileUpload(e, "linkedin")}
                  />
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => linkedinFileRef.current?.click()}
                    style={{ width: "100%", padding: "28px 0", border: "2px dashed var(--border)", borderRadius: 12, background: "var(--muted)", cursor: isImporting ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontFamily: "inherit" }}
                  >
                    {isImporting ? (
                      <><Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} /><span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Extracting from PDF…</span></>
                    ) : (
                      <><Upload className="w-6 h-6" style={{ color: "var(--primary)" }} /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Upload LinkedIn PDF or DOCX</span><span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>LinkedIn profile saved as PDF or Word doc</span></>
                    )}
                  </button>
                  <details>
                    <summary style={{ fontSize: 12, color: "var(--muted-foreground)", cursor: "pointer", userSelect: "none" }}>
                      Paste profile text instead
                    </summary>
                    <div style={{ marginTop: 10 }}>
                      <Textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="Paste your LinkedIn About + Experience text here…"
                        className="min-h-[100px] resize-y mb-2"
                        style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "var(--foreground)", width: "100%" }}
                      />
                      <button
                        type="button"
                        disabled={!importText.trim() || isImporting}
                        onClick={handleImport}
                        style={{ height: 38, padding: "0 18px", background: isImporting || !importText.trim() ? "var(--muted-foreground)" : "var(--primary)", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", cursor: isImporting || !importText.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
                      >
                        {isImporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting…</> : <><Upload className="w-3.5 h-3.5" /> Extract & Fill Form</>}
                      </button>
                    </div>
                  </details>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    Upload your resume (PDF, DOCX, or TXT) and we'll extract your experience, education, and skills automatically.
                  </p>
                  <input
                    ref={resumeFileRef}
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    style={{ display: "none" }}
                    onChange={(e) => handleFileUpload(e, "resume")}
                  />
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => resumeFileRef.current?.click()}
                    style={{ width: "100%", padding: "28px 0", border: "2px dashed var(--border)", borderRadius: 12, background: "var(--muted)", cursor: isImporting ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontFamily: "inherit" }}
                  >
                    {isImporting ? (
                      <><Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} /><span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Extracting…</span></>
                    ) : (
                      <><Upload className="w-6 h-6" style={{ color: "var(--primary)" }} /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Click to upload resume</span><span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>PDF or TXT</span></>
                    )}
                  </button>
                  <details>
                    <summary style={{ fontSize: 12, color: "var(--muted-foreground)", cursor: "pointer", userSelect: "none" }}>
                      Paste resume text instead
                    </summary>
                    <div style={{ marginTop: 10 }}>
                      <Textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="Paste your plain-text resume here…"
                        className="min-h-[100px] resize-y mb-2"
                        style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "var(--foreground)", width: "100%" }}
                      />
                      <button
                        type="button"
                        disabled={!importText.trim() || isImporting}
                        onClick={handleImport}
                        style={{ height: 38, padding: "0 18px", background: isImporting || !importText.trim() ? "var(--muted-foreground)" : "var(--primary)", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", cursor: isImporting || !importText.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
                      >
                        {isImporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting…</> : <><Upload className="w-3.5 h-3.5" /> Extract & Fill Form</>}
                      </button>
                    </div>
                  </details>
                </div>
              )}

              {/* Error message */}
              {importError && (
                <div className="flex items-start gap-2 mt-3" style={{ padding: "10px 14px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 10 }}>
                  <X className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
                  <span style={{ fontSize: 12, color: "#dc2626" }}>{importError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Guidance tip */}
        <div style={{ marginBottom: 32, padding: 20, background: "rgba(232,185,72,0.08)", border: "1px solid rgba(232,185,72,0.25)", borderRadius: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--highlight)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles className="w-3.5 h-3.5" /> How to get the best results
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-foreground)", marginBottom: 6 }}>What happens next?</div>
              <p style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.6 }}>
                After you submit, we'll open a <strong>Resume Workspace</strong>. You'll see your AI-generated resume and a live chat to refine it until it's perfect.
              </p>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-foreground)", marginBottom: 6 }}>Pro Tips</div>
              <ul style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.7, paddingLeft: 16, listStyle: "disc" }}>
                <li><strong>Be specific</strong> — more detail = better AI output.</li>
                <li><strong>Blank is OK</strong> — AI generates bullets from job title.</li>
                <li><strong>Include skills</strong> — ensures the template highlights your stack.</li>
              </ul>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 36 }}>

          {/* Template + Target Role */}
          <div style={{ padding: 20, background: "rgba(217,119,87,0.05)", border: "1px solid rgba(217,119,87,0.15)", borderRadius: 16 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label style={labelStyle}>Selected Template</label>
                <div style={{ ...fieldStyle, display: "flex", alignItems: "center", gap: 10, cursor: "default" }}>
                  <LayoutTemplate className="w-4 h-4" style={{ color: "var(--primary)", flexShrink: 0 }} />
                  {template}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Target Role <span style={{ color: "#e05c5c" }}>*</span></label>
                <select
                  required
                  style={{ ...fieldStyle }}
                  value={targetRoleSelect}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTargetRoleSelect(val);
                    if (val !== "Other") setTargetRole(val); else setTargetRole("");
                  }}
                >
                  <option value="" disabled>Select an option…</option>
                  {COMMON_ROLES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {targetRoleSelect === "Other" && (
                  <Input
                    required
                    placeholder="Please specify your target role…"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    style={{ ...fieldStyle, marginTop: 8 }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div>
            <div style={sectionHeadStyle}><User className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /> Personal Information</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Full Name", key: "name", required: true },
                { label: "Email", key: "email", required: true, type: "email" },
                { label: "Phone", key: "phone" },
                { label: "LinkedIn URL", key: "linkedin" },
                { label: "GitHub URL", key: "github" },
                { label: "Portfolio / Website", key: "portfolio" },
              ].map(({ label, key, required, type }) => (
                <div key={key}>
                  <label style={labelStyle}>{label} {required && <span style={{ color: "#e05c5c" }}>*</span>}</label>
                  <Input
                    type={type || "text"}
                    required={required}
                    value={(personalInfo as any)[key]}
                    onChange={e => setPersonalInfo({ ...personalInfo, [key]: e.target.value })}
                    style={fieldStyle}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Work History */}
          <div>
            <div style={{ ...sectionHeadStyle, justifyContent: "space-between" }}>
              <span>Work History</span>
              <button type="button" onClick={addWork} style={{ height: 32, padding: "0 12px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 9999, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--foreground)" }}>
                <Plus className="w-3.5 h-3.5" /> Add Job
              </button>
            </div>
            {workHistory.map((work, idx) => {
              const isExpanded = expandedWorkIndices.has(idx);
              const isComplete = !!(work.role && work.company);
              return (
                <div key={idx} style={entryCardStyle}>
                  {/* Item 7: collapsed summary row */}
                  {isComplete && !isExpanded ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{work.role} {work.company ? `@ ${work.company}` : ""}</div>
                        {(work.startDate || work.endDate) && (
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{work.startDate || "?"} – {work.endDate || "Present"}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {workHistory.length > 1 && (
                          <button type="button" onClick={() => removeWork(idx)} style={{ width: 28, height: 28, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#e05c5c" }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button type="button" onClick={() => setExpandedWorkIndices((prev) => new Set([...prev, idx]))}
                          style={{ height: 28, padding: "0 10px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}>
                          Edit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>Position #{idx + 1}</span>
                        <div className="flex items-center gap-2">
                          {isComplete && (
                            <button type="button" onClick={() => setExpandedWorkIndices((prev) => { const n = new Set(prev); n.delete(idx); return n; })}
                              style={{ height: 28, padding: "0 10px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "var(--muted-foreground)" }}>
                              Collapse
                            </button>
                          )}
                          {workHistory.length > 1 && (
                            <button type="button" onClick={() => removeWork(idx)} style={{ width: 32, height: 32, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#e05c5c" }}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label style={labelStyle}>Job Title / Role <span style={{ color: "#e05c5c" }}>*</span></label>
                          <ComboInput value={work.role} onChange={v => handleWorkChange(idx, "role", v)} options={JOB_TITLES} placeholder="e.g., Software Engineer" style={{ ...fieldStyle, background: "var(--card)" }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Company Name</label>
                          <ComboInput value={work.company} onChange={v => handleWorkChange(idx, "company", v)} options={SP500_COMPANIES} placeholder="e.g., Acme Corp" style={{ ...fieldStyle, background: "var(--card)" }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Start Date</label>
                          <MonthYearPicker value={work.startDate} onChange={v => handleWorkChange(idx, "startDate", v)} placeholder="Start date" style={{ ...fieldStyle, background: "var(--card)", height: 48, padding: "0 14px" }} />
                        </div>
                        <div>
                          <label style={labelStyle}>End Date</label>
                          <MonthYearPicker value={work.endDate} onChange={v => handleWorkChange(idx, "endDate", v)} placeholder="End date" allowPresent style={{ ...fieldStyle, background: "var(--card)", height: 48, padding: "0 14px" }} />
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <div className="flex items-center gap-2">
                              <label style={{ ...labelStyle, marginBottom: 0 }}>Responsibilities & Achievements</label>
                              {/* Item 2: AI-generated badge */}
                              {autoGeneratedEntries.has(idx) && !autoGeneratingEntries.has(idx) && (
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 9999, background: "rgba(47,107,79,0.10)", color: "var(--forest)", border: "1px solid rgba(47,107,79,0.20)" }}>
                                  AI-generated — edit freely
                                </span>
                              )}
                              {autoGeneratingEntries.has(idx) && (
                                <span style={{ fontSize: 10, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 4 }}>
                                  <Loader2 className="w-3 h-3 animate-spin" /> Auto-filling…
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={!work.role || isGeneratingBullets === idx || !(targetRoleSelect !== "Other" ? targetRoleSelect : targetRole)}
                              onClick={() => handleSuggestBullets(idx)}
                              style={{ height: 28, padding: "0 10px", background: "rgba(217,119,87,0.10)", border: "1px solid rgba(217,119,87,0.25)", borderRadius: 8, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "var(--primary)", opacity: (!work.role || isGeneratingBullets === idx) ? 0.5 : 1 }}
                            >
                              {isGeneratingBullets === idx ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Suggesting…</>
                              ) : (
                                <><Wand2 className="w-3 h-3" /> Refresh bullets</>
                              )}
                            </button>
                          </div>
                          <Textarea
                            placeholder="Describe your impact, scale, and technical stack used…"
                            className="min-h-[120px] resize-y"
                            style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "var(--foreground)", width: "100%" }}
                            value={work.responsibilities}
                            onChange={e => handleWorkChange(idx, "responsibilities", e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Education */}
          <div>
            <div style={{ ...sectionHeadStyle, justifyContent: "space-between" }}>
              <span>Education</span>
              <button type="button" onClick={addEdu} style={{ height: 32, padding: "0 12px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 9999, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--foreground)" }}>
                <Plus className="w-3.5 h-3.5" /> Add Education
              </button>
            </div>
            {education.map((edu, idx) => {
              const isExpanded = expandedEduIndices.has(idx);
              const isComplete = !!(edu.university && edu.degree);
              return (
                <div key={idx} style={entryCardStyle}>
                  {isComplete && !isExpanded ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{edu.degree} — {edu.university}</div>
                        {(edu.major || edu.graduationYear) && (
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                            {[edu.major, edu.graduationYear].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {education.length > 1 && (
                          <button type="button" onClick={() => removeEdu(idx)} style={{ width: 28, height: 28, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#e05c5c" }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button type="button" onClick={() => setExpandedEduIndices((prev) => new Set([...prev, idx]))}
                          style={{ height: 28, padding: "0 10px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}>
                          Edit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>Education #{idx + 1}</span>
                        <div className="flex items-center gap-2">
                          {isComplete && (
                            <button type="button" onClick={() => setExpandedEduIndices((prev) => { const n = new Set(prev); n.delete(idx); return n; })}
                              style={{ height: 28, padding: "0 10px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "var(--muted-foreground)" }}>
                              Collapse
                            </button>
                          )}
                          {education.length > 1 && (
                            <button type="button" onClick={() => removeEdu(idx)} style={{ width: 32, height: 32, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#e05c5c" }}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label style={labelStyle}>Institution <span style={{ color: "#e05c5c" }}>*</span></label>
                          <ComboInput value={edu.university} onChange={v => handleEduChange(idx, "university", v)} options={UNIVERSITIES} placeholder="e.g., MIT" style={{ ...fieldStyle, background: "var(--card)" }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Degree / Field</label>
                          <ComboInput value={edu.degree} onChange={v => handleEduChange(idx, "degree", v)} options={DEGREE_TYPES} placeholder="e.g., B.S. Computer Science" style={{ ...fieldStyle, background: "var(--card)" }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Graduation Year</label>
                          <MonthYearPicker value={edu.graduationYear} onChange={v => handleEduChange(idx, "graduationYear", v)} placeholder="Graduation" style={{ ...fieldStyle, background: "var(--card)", height: 48, padding: "0 14px" }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Major</label>
                          <ComboInput value={(edu as any).major ?? ""} onChange={v => handleEduChange(idx, "major", v)} options={COMMON_MAJORS} placeholder="e.g., Computer Science" style={{ ...fieldStyle, background: "var(--card)" }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Minor</label>
                          <ComboInput value={(edu as any).minor ?? ""} onChange={v => handleEduChange(idx, "minor", v)} options={COMMON_MINORS} placeholder="e.g., Statistics" style={{ ...fieldStyle, background: "var(--card)" }} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Skills */}
          <div>
            <div style={{ ...sectionHeadStyle, justifyContent: "space-between" }}>
              <span>Skills & Additional Info</span>
              <span className="text-xs font-normal" style={{ color: skills.length > 10 ? "#e05c5c" : "var(--muted-foreground)" }}>
                {skills.length}/10 recommended
              </span>
            </div>
            {skills.length > 10 && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(224,92,92,0.08)", border: "1px solid rgba(224,92,92,0.25)", color: "#e05c5c" }}>
                Tip: Keep it to 10 or fewer skills on a resume — a focused list is more impactful than a long one.
              </div>
            )}
            {/* Item 8: Suggested skills from job titles */}
            {suggestedSkills.filter((s) => !skills.includes(s)).length > 0 && (
              <div className="mb-3">
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Suggested from your roles
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedSkills.filter((s) => !skills.includes(s)).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSkills([...skills, s])}
                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
                      style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "inherit", cursor: "pointer" }}
                    >
                      <Plus className="w-3 h-3" /> {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label style={labelStyle}>Core Skills</label>
            <SkillsPicker selected={skills} onChange={setSkills} />
            {skills.length === 0 && (
              <p className="text-xs italic mt-2" style={{ color: "var(--muted-foreground)" }}>
                No skills yet — browse above or type a custom skill below.
              </p>
            )}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
                    style={{ background: "rgba(217,119,87,0.10)", border: "1px solid rgba(217,119,87,0.25)", color: "var(--primary)" }}
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => setSkills(skills.filter((x) => x !== s))}
                      style={{ lineHeight: 1, background: "none", border: "none", cursor: "pointer", color: "var(--primary)", padding: 0 }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const s = newSkill.trim();
                    if (s && !skills.includes(s)) { setSkills([...skills, s]); setNewSkill(""); }
                  }
                }}
                placeholder="Add a custom skill…"
                className="flex-1 text-xs px-3 py-2 rounded-xl outline-none"
                style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "inherit" }}
              />
              <button
                type="button"
                onClick={() => {
                  const s = newSkill.trim();
                  if (s && !skills.includes(s)) { setSkills([...skills, s]); setNewSkill(""); }
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Item 3: Target Job Description */}
          <div>
            <div style={sectionHeadStyle}>
              <span>Target Job Description</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", marginLeft: 4 }}>(optional)</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.5 }}>
              Paste the job description you're applying for. We'll tailor your resume's keywords and bullets to match it.
            </p>
            <Textarea
              placeholder="Paste the job description here…"
              className="min-h-[120px] resize-y"
              style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "var(--foreground)", width: "100%" }}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          <div style={{ paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <button
              type="submit"
              disabled={isGenerating}
              style={{ width: "100%", height: 52, background: isGenerating ? "var(--muted-foreground)" : "var(--foreground)", border: "none", borderRadius: 14, fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: "var(--background)", cursor: isGenerating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.2s" }}
            >
              {isGenerating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Drafting your resume…</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Generate Resume Workspace</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
