import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COMMON_ROLES } from "@/config/workflows";
import { Plus, Trash2, Loader2, Sparkles, ArrowLeft, ChevronRight, LayoutTemplate, User, Wand2 } from "lucide-react";
import { suggestWorkExperienceBullets } from "@/services/geminiService";
import { useUserProfile } from "@/context/UserProfileContext";

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
  // Academic / Research
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

export function ResumeGenerationForm({ onSubmit, isGenerating }: { onSubmit: (data: any) => void; isGenerating: boolean }) {
  const { profile } = useUserProfile();
  const [step, setStep] = useState<1 | 2>(1);
  const [template, setTemplate] = useState("Modern & Clean");
  const [targetRoleSelect, setTargetRoleSelect] = useState(profile.targetRole ? "Other" : "");
  const [targetRole, setTargetRole] = useState(profile.targetRole ?? "");

  const [personalInfo, setPersonalInfo] = useState(() => ({
    name: profile.name ?? "",
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
      ? profile.education.map(({ university, degree, year }) => ({ university, degree, year }))
      : [{ university: "", degree: "", year: "" }]
  );

  const [skills, setSkills] = useState(() => (profile.skills ?? []).join(", "));
  const [isGeneratingBullets, setIsGeneratingBullets] = useState<number | null>(null);

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
      const suggestions = await suggestWorkExperienceBullets(work.role, targetRoleSelect === "Other" ? targetRole : targetRoleSelect);
      const newWork = [...workHistory];
      const currentText = newWork[index].responsibilities;
      newWork[index].responsibilities = currentText ? currentText + "\n\n" + suggestions : suggestions;
      setWorkHistory(newWork);
    } catch (err) {
      console.error("Failed to generate bullets:", err);
    } finally {
      setIsGeneratingBullets(null);
    }
  };

  const addWork = () => setWorkHistory([...workHistory, { company: "", role: "", startDate: "", endDate: "", responsibilities: "" }]);
  const removeWork = (index: number) => setWorkHistory(workHistory.filter((_, i) => i !== index));

  const handleEduChange = (index: number, field: string, value: string) => {
    const newEdu = [...education];
    newEdu[index] = { ...newEdu[index], [field]: value };
    setEducation(newEdu);
  };

  const addEdu = () => setEducation([...education, { university: "", degree: "", year: "" }]);
  const removeEdu = (index: number) => setEducation(education.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ template, targetRole: targetRoleSelect === "Other" ? targetRole : targetRoleSelect, personalInfo, workHistory, education, skills });
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

  if (step === 1) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl font-semibold" style={{ color: "var(--foreground)" }}>Choose a template</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>Start with a design, then customize it with your details.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEMPLATES.map(t => (
            <div
              key={t.id}
              onClick={() => setTemplate(t.id)}
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
                <MiniTemplatePreview type={t.id} />
              </div>
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--card)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{t.description}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 24, borderTop: "1px solid var(--border)", marginTop: 32 }}>
          <button
            onClick={() => setStep(2)}
            disabled={!template}
            style={{ height: 44, padding: "0 32px", background: "var(--primary)", border: "none", borderRadius: 9999, fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "#FFF", cursor: template ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 8, opacity: template ? 1 : 0.5 }}
          >
            Customize this template <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto max-w-4xl animate-in slide-in-from-right-4 duration-300" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, overflow: "hidden" }}>
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
            {workHistory.map((work, idx) => (
              <div key={idx} style={entryCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>Position #{idx + 1}</span>
                  {workHistory.length > 1 && (
                    <button type="button" onClick={() => removeWork(idx)} style={{ width: 32, height: 32, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#e05c5c" }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label style={labelStyle}>Job Title / Role <span style={{ color: "#e05c5c" }}>*</span></label>
                    <Input required={idx === 0} value={work.role} onChange={e => handleWorkChange(idx, "role", e.target.value)} style={{ ...fieldStyle, background: "var(--card)" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Company Name</label>
                    <Input value={work.company} onChange={e => handleWorkChange(idx, "company", e.target.value)} style={{ ...fieldStyle, background: "var(--card)" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Start Date</label>
                    <Input placeholder="e.g., Jan 2020" value={work.startDate} onChange={e => handleWorkChange(idx, "startDate", e.target.value)} style={{ ...fieldStyle, background: "var(--card)" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>End Date</label>
                    <Input placeholder="e.g., Present" value={work.endDate} onChange={e => handleWorkChange(idx, "endDate", e.target.value)} style={{ ...fieldStyle, background: "var(--card)" }} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>Responsibilities & Achievements</label>
                      <button
                        type="button"
                        disabled={!work.role || isGeneratingBullets === idx || !(targetRoleSelect !== "Other" ? targetRoleSelect : targetRole)}
                        onClick={() => handleSuggestBullets(idx)}
                        style={{ height: 28, padding: "0 10px", background: "rgba(217,119,87,0.10)", border: "1px solid rgba(217,119,87,0.25)", borderRadius: 8, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: "var(--primary)", opacity: (!work.role || isGeneratingBullets === idx) ? 0.5 : 1 }}
                      >
                        {isGeneratingBullets === idx ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Suggesting…</>
                        ) : (
                          <><Wand2 className="w-3 h-3" /> Auto-suggest bullets</>
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
              </div>
            ))}
          </div>

          {/* Education */}
          <div>
            <div style={{ ...sectionHeadStyle, justifyContent: "space-between" }}>
              <span>Education</span>
              <button type="button" onClick={addEdu} style={{ height: 32, padding: "0 12px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 9999, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--foreground)" }}>
                <Plus className="w-3.5 h-3.5" /> Add Education
              </button>
            </div>
            {education.map((edu, idx) => (
              <div key={idx} style={entryCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>Education #{idx + 1}</span>
                  {education.length > 1 && (
                    <button type="button" onClick={() => removeEdu(idx)} style={{ width: 32, height: 32, borderRadius: "50%", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#e05c5c" }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label style={labelStyle}>Institution <span style={{ color: "#e05c5c" }}>*</span></label>
                    <Input required={idx === 0} value={edu.university} onChange={e => handleEduChange(idx, "university", e.target.value)} style={{ ...fieldStyle, background: "var(--card)" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Degree / Field</label>
                    <Input placeholder="e.g., B.S. CS" value={edu.degree} onChange={e => handleEduChange(idx, "degree", e.target.value)} style={{ ...fieldStyle, background: "var(--card)" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Graduation Year</label>
                    <Input placeholder="e.g., 2022" value={edu.year} onChange={e => handleEduChange(idx, "year", e.target.value)} style={{ ...fieldStyle, background: "var(--card)" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Skills */}
          <div>
            <div style={sectionHeadStyle}>Skills & Additional Info</div>
            <label style={labelStyle}>Core Skills (comma separated)</label>
            <Textarea
              placeholder="React, Node.js, Python, Leadership, Agile, AWS…"
              className="min-h-[100px] resize-y"
              style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "var(--foreground)", width: "100%" }}
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
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
