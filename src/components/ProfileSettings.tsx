import { useState } from "react";
import {
  Plus, Trash2, Save, RotateCcw, Pencil, Check, X,
  Linkedin, Github, Globe, Mail, Phone, MapPin, Briefcase,
  GraduationCap, Sparkles, ExternalLink, LogOut,
} from "lucide-react";
import type { WorkExperience, Education } from "@/types/userProfile";
import { generateId } from "@/types/userProfile";
import { useUserProfile } from "@/context/UserProfileContext";
import { useAuth } from "@/context/AuthContext";

/* ── tiny inline-edit hook ───────────────────────────────────── */
function useInlineEdit(initial: string, onSave: (v: string) => void) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const start = () => { setDraft(initial); setEditing(true); };
  const commit = () => { onSave(draft); setEditing(false); };
  const cancel = () => setEditing(false);
  return { editing, draft, setDraft, start, commit, cancel };
}

/* ── gradient cover patterns ─────────────────────────────────── */
const COVER_GRADIENT =
  "linear-gradient(135deg, #D97757 0%, #E8B948 40%, #2F6B4F 100%)";

/* ── skill pill ──────────────────────────────────────────────── */
function SkillPill({
  skill,
  onRemove,
}: {
  skill: string;
  onRemove: () => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium group"
      style={{
        background: "rgba(217,119,87,0.10)",
        color: "var(--primary)",
        border: "1px solid rgba(217,119,87,0.2)",
      }}
    >
      {skill}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--primary)" }}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

/* ── experience / education card ─────────────────────────────── */
function TimelineCard({
  icon,
  title,
  subtitle,
  meta,
  description,
  onEdit,
  onDelete,
  editing,
  fields,
  onCommit,
  onCancel,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  meta: string;
  description?: string;
  onEdit: () => void;
  onDelete: () => void;
  editing: boolean;
  fields: React.ReactNode;
  onCommit: () => void;
  onCancel: () => void;
}) {
  if (editing) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--card)", border: "1.5px solid var(--primary)" }}
      >
        {fields}
        <div className="flex gap-2 mt-3">
          <button
            onClick={onCommit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <Check className="w-3.5 h-3.5" /> Save
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium"
            style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex gap-4 p-4 rounded-2xl group transition-all hover:shadow-sm"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: "var(--muted)" }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {title || <span style={{ color: "var(--muted-foreground)" }}>Untitled</span>}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {subtitle}
              {meta && <> · <span>{meta}</span></>}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: "var(--muted)" }}
            >
              <Pencil className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: "var(--muted)" }}
            >
              <Trash2 className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        </div>
        {description && (
          <p
            className="text-xs mt-2 leading-relaxed line-clamp-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── inline text field ───────────────────────────────────────── */
const iStyle: React.CSSProperties = {
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  height: 38,
  fontSize: 13,
  padding: "0 12px",
  color: "var(--foreground)",
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};
const lStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--muted-foreground)",
  marginBottom: 4,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

/* ── main component ──────────────────────────────────────────── */
export function ProfileSettings() {
  const { profile, updateProfile, resetProfile } = useUserProfile();
  const { signOut } = useAuth();

  const [name, setName] = useState(profile.name ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [linkedin, setLinkedin] = useState(profile.linkedin ?? "");
  const [github, setGithub] = useState(profile.github ?? "");
  const [portfolio, setPortfolio] = useState(profile.portfolio ?? "");
  const [targetRole, setTargetRole] = useState(profile.targetRole ?? "");
  const [location, setLocation] = useState(profile.currentRole ?? "");
  const [summary, setSummary] = useState(profile.summary ?? "");
  const [workHistory, setWorkHistory] = useState<WorkExperience[]>(
    profile.workHistory?.length ? profile.workHistory : []
  );
  const [education, setEducation] = useState<Education[]>(
    profile.education?.length ? profile.education : []
  );
  const [skillsList, setSkillsList] = useState<string[]>(profile.skills ?? []);
  const [newSkill, setNewSkill] = useState("");
  const [saved, setSaved] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [editingContact, setEditingContact] = useState(false);

  /* experience editing state */
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [workDraft, setWorkDraft] = useState<WorkExperience | null>(null);
  const [addingWork, setAddingWork] = useState(false);
  const [newWork, setNewWork] = useState<WorkExperience>({
    id: "", company: "", role: "", startDate: "", endDate: "", responsibilities: "",
  });

  /* education editing state */
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [eduDraft, setEduDraft] = useState<Education | null>(null);
  const [addingEdu, setAddingEdu] = useState(false);
  const [newEdu, setNewEdu] = useState<Education>({
    id: "", university: "", degree: "", year: "",
  });

  /* derived */
  const initials = name
    .split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const displayRole = targetRole || "Add your target role";
  const displaySummary = summary || "Add a professional summary about your background and goals…";

  /* save */
  function handleSave() {
    updateProfile({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      github: github.trim() || undefined,
      portfolio: portfolio.trim() || undefined,
      targetRole: targetRole.trim() || undefined,
      currentRole: location.trim() || undefined,
      summary: summary.trim() || undefined,
      workHistory: workHistory.filter((w) => w.company || w.role),
      education: education.filter((e) => e.university || e.degree),
      skills: skillsList.filter(Boolean),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  /* skills */
  function addSkill() {
    const s = newSkill.trim();
    if (s && !skillsList.includes(s)) {
      setSkillsList((prev) => [...prev, s]);
      setNewSkill("");
    }
  }
  function removeSkill(s: string) {
    setSkillsList((prev) => prev.filter((x) => x !== s));
  }

  /* work */
  function startEditWork(w: WorkExperience) {
    setEditingWorkId(w.id);
    setWorkDraft({ ...w });
  }
  function commitWork() {
    if (!workDraft) return;
    setWorkHistory((prev) => prev.map((w) => (w.id === workDraft.id ? workDraft : w)));
    setEditingWorkId(null);
    setWorkDraft(null);
  }
  function cancelWork() { setEditingWorkId(null); setWorkDraft(null); }
  function deleteWork(id: string) { setWorkHistory((prev) => prev.filter((w) => w.id !== id)); }
  function commitNewWork() {
    if (!newWork.role && !newWork.company) return;
    setWorkHistory((prev) => [...prev, { ...newWork, id: generateId() }]);
    setAddingWork(false);
    setNewWork({ id: "", company: "", role: "", startDate: "", endDate: "", responsibilities: "" });
  }

  /* education */
  function startEditEdu(e: Education) { setEditingEduId(e.id); setEduDraft({ ...e }); }
  function commitEdu() {
    if (!eduDraft) return;
    setEducation((prev) => prev.map((e) => (e.id === eduDraft.id ? eduDraft : e)));
    setEditingEduId(null);
    setEduDraft(null);
  }
  function cancelEdu() { setEditingEduId(null); setEduDraft(null); }
  function deleteEdu(id: string) { setEducation((prev) => prev.filter((e) => e.id !== id)); }
  function commitNewEdu() {
    if (!newEdu.university && !newEdu.degree) return;
    setEducation((prev) => [...prev, { ...newEdu, id: generateId() }]);
    setAddingEdu(false);
    setNewEdu({ id: "", university: "", degree: "", year: "" });
  }

  function workFields(
    data: WorkExperience,
    onChange: (f: keyof WorkExperience, v: string) => void
  ) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div><label style={lStyle}>Job Title</label>
          <input style={iStyle} value={data.role} placeholder="Product Manager" onChange={(e) => onChange("role", e.target.value)} /></div>
        <div><label style={lStyle}>Company</label>
          <input style={iStyle} value={data.company} placeholder="Acme Corp" onChange={(e) => onChange("company", e.target.value)} /></div>
        <div><label style={lStyle}>Start Date</label>
          <input style={iStyle} value={data.startDate} placeholder="Jan 2020" onChange={(e) => onChange("startDate", e.target.value)} /></div>
        <div><label style={lStyle}>End Date</label>
          <input style={iStyle} value={data.endDate} placeholder="Present" onChange={(e) => onChange("endDate", e.target.value)} /></div>
        <div className="col-span-2"><label style={lStyle}>Highlights</label>
          <textarea
            value={data.responsibilities}
            placeholder="Key achievements and responsibilities…"
            rows={3}
            onChange={(e) => onChange("responsibilities", e.target.value)}
            style={{ ...iStyle, height: "auto", padding: "8px 12px", resize: "none" }}
          /></div>
      </div>
    );
  }

  function eduFields(
    data: Education,
    onChange: (f: keyof Education, v: string) => void
  ) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><label style={lStyle}>Institution</label>
          <input style={iStyle} value={data.university} placeholder="MIT" onChange={(e) => onChange("university", e.target.value)} /></div>
        <div><label style={lStyle}>Degree</label>
          <input style={iStyle} value={data.degree} placeholder="B.S. Computer Science" onChange={(e) => onChange("degree", e.target.value)} /></div>
        <div><label style={lStyle}>Year</label>
          <input style={iStyle} value={data.year} placeholder="2022" onChange={(e) => onChange("year", e.target.value)} /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "var(--background)" }}>
      {/* ── Cover + Avatar ──────────────────────────────────── */}
      <div className="relative flex-shrink-0">
        {/* Cover */}
        <div
          className="w-full"
          style={{ height: 180, background: COVER_GRADIENT }}
        />

        {/* Avatar */}
        <div className="absolute left-8" style={{ bottom: -44 }}>
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold border-4 shadow-lg"
            style={{
              background: "var(--primary)",
              color: "#fff",
              borderColor: "var(--background)",
              fontFamily: "var(--font-display)",
            }}
          >
            {initials}
          </div>
        </div>

        {/* Save button top-right */}
        <div className="absolute top-4 right-6">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 shadow-lg"
            style={{
              background: saved ? "var(--forest)" : "rgba(255,255,255,0.92)",
              color: saved ? "#fff" : "var(--foreground)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Save className="w-4 h-4" />
            {saved ? "Saved!" : "Save Profile"}
          </button>
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────── */}
      <div
        className="px-8 pt-14 pb-5 flex-shrink-0"
        style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Name */}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="text-2xl font-bold bg-transparent outline-none w-full"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--foreground)",
                border: "none",
                borderBottom: "2px solid transparent",
                paddingBottom: 2,
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderBottomColor = "var(--primary)")}
              onBlur={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
            />
            {/* Target role */}
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Target role, e.g. Senior Product Manager"
              className="text-sm bg-transparent outline-none w-full mt-1"
              style={{
                color: "var(--primary)",
                fontWeight: 600,
                border: "none",
                borderBottom: "2px solid transparent",
                paddingBottom: 2,
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderBottomColor = "var(--primary)")}
              onBlur={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
            />
            {/* Location / current role */}
            <div className="flex items-center gap-1.5 mt-2">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Current role or location"
                className="text-xs bg-transparent outline-none flex-1"
                style={{ color: "var(--muted-foreground)", border: "none" }}
              />
            </div>
          </div>
        </div>

        {/* About / bio */}
        <div className="mt-4">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Write a short professional summary — who you are, what you're pursuing, what makes you unique…"
            rows={3}
            className="w-full text-sm bg-transparent outline-none resize-none"
            style={{
              color: summary ? "var(--foreground)" : "var(--muted-foreground)",
              fontFamily: "inherit",
              lineHeight: 1.7,
              border: "none",
              borderBottom: "2px solid transparent",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderBottomColor = "var(--border)")}
            onBlur={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
          />
        </div>

        {/* Contact links row */}
        <div className="flex flex-wrap gap-3 mt-4">
          {[
            { icon: <Mail className="w-3.5 h-3.5" />, value: email, setter: setEmail, placeholder: "email@example.com" },
            { icon: <Phone className="w-3.5 h-3.5" />, value: phone, setter: setPhone, placeholder: "+1 (555) 000-0000" },
            { icon: <Linkedin className="w-3.5 h-3.5" />, value: linkedin, setter: setLinkedin, placeholder: "linkedin.com/in/…" },
            { icon: <Github className="w-3.5 h-3.5" />, value: github, setter: setGithub, placeholder: "github.com/…" },
            { icon: <Globe className="w-3.5 h-3.5" />, value: portfolio, setter: setPortfolio, placeholder: "yoursite.com" },
          ].map(({ icon, value, setter, placeholder }, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
            >
              <span style={{ color: "var(--muted-foreground)" }}>{icon}</span>
              <input
                type="text"
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                className="bg-transparent outline-none text-xs"
                style={{ color: "var(--foreground)", minWidth: 80, maxWidth: 160, border: "none" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Body columns ────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-3 gap-0 min-h-0">

        {/* Left sidebar — skills */}
        <div
          className="col-span-1 p-6 flex flex-col gap-6"
          style={{ borderRight: "1px solid var(--border)" }}
        >
          {/* Skills */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>
                Skills
              </h3>
              <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {skillsList.map((s) => (
                <SkillPill key={s} skill={s} onRemove={() => removeSkill(s)} />
              ))}
              {skillsList.length === 0 && (
                <p className="text-xs italic" style={{ color: "var(--muted-foreground)" }}>
                  No skills yet — add some below.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSkill()}
                placeholder="Add a skill…"
                className="flex-1 text-xs px-3 py-2 rounded-xl outline-none"
                style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "inherit" }}
              />
              <button
                onClick={addSkill}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>

          {/* Reset + Sign out */}
          <section className="mt-auto pt-4 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              onClick={() => confirm("Reset your profile and re-run onboarding?") && resetProfile()}
              className="flex items-center gap-2 text-xs transition-opacity hover:opacity-70 w-full"
              style={{ color: "var(--muted-foreground)" }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset &amp; re-run onboarding
            </button>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 text-xs transition-opacity hover:opacity-70 w-full"
              style={{ color: "var(--muted-foreground)" }}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </section>
        </div>

        {/* Right main — experience + education */}
        <div className="col-span-2 p-6 flex flex-col gap-8 overflow-y-auto">

          {/* Experience */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>
                Experience
              </h3>
              <button
                onClick={() => { setAddingWork(true); setNewWork({ id: "", company: "", role: "", startDate: "", endDate: "", responsibilities: "" }); }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "rgba(217,119,87,0.1)", color: "var(--primary)", border: "1px solid rgba(217,119,87,0.2)" }}
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Add new work inline */}
              {addingWork && (
                <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1.5px solid var(--primary)" }}>
                  {workFields(newWork, (f, v) => setNewWork((p) => ({ ...p, [f]: v })))}
                  <div className="flex gap-2 mt-3">
                    <button onClick={commitNewWork} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: "var(--primary)", color: "#fff" }}>
                      <Check className="w-3.5 h-3.5" /> Add position
                    </button>
                    <button onClick={() => setAddingWork(false)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {workHistory.length === 0 && !addingWork && (
                <p className="text-xs italic py-2" style={{ color: "var(--muted-foreground)" }}>
                  No experience added yet. Hit "Add" to get started.
                </p>
              )}

              {workHistory.map((w) => (
                <TimelineCard
                  key={w.id}
                  icon={<Briefcase className="w-4 h-4" style={{ color: "var(--primary)" }} />}
                  title={[w.role, w.company].filter(Boolean).join(" · ")}
                  subtitle={w.company}
                  meta={[w.startDate, w.endDate].filter(Boolean).join(" – ")}
                  description={w.responsibilities}
                  onEdit={() => startEditWork(w)}
                  onDelete={() => deleteWork(w.id)}
                  editing={editingWorkId === w.id}
                  onCommit={commitWork}
                  onCancel={cancelWork}
                  fields={workDraft ? workFields(workDraft, (f, v) => setWorkDraft((p) => p ? { ...p, [f]: v } : p)) : null}
                />
              ))}
            </div>
          </section>

          {/* Education */}
          <section className="pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--muted-foreground)" }}>
                Education
              </h3>
              <button
                onClick={() => { setAddingEdu(true); setNewEdu({ id: "", university: "", degree: "", year: "" }); }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "rgba(217,119,87,0.1)", color: "var(--primary)", border: "1px solid rgba(217,119,87,0.2)" }}
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {addingEdu && (
                <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1.5px solid var(--primary)" }}>
                  {eduFields(newEdu, (f, v) => setNewEdu((p) => ({ ...p, [f]: v })))}
                  <div className="flex gap-2 mt-3">
                    <button onClick={commitNewEdu} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: "var(--primary)", color: "#fff" }}>
                      <Check className="w-3.5 h-3.5" /> Add education
                    </button>
                    <button onClick={() => setAddingEdu(false)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {education.length === 0 && !addingEdu && (
                <p className="text-xs italic py-2" style={{ color: "var(--muted-foreground)" }}>
                  No education added yet.
                </p>
              )}

              {education.map((e) => (
                <TimelineCard
                  key={e.id}
                  icon={<GraduationCap className="w-4 h-4" style={{ color: "var(--forest)" }} />}
                  title={e.degree || e.university}
                  subtitle={e.university}
                  meta={e.year}
                  onEdit={() => startEditEdu(e)}
                  onDelete={() => deleteEdu(e.id)}
                  editing={editingEduId === e.id}
                  onCommit={commitEdu}
                  onCancel={cancelEdu}
                  fields={eduDraft ? eduFields(eduDraft, (f, v) => setEduDraft((p) => p ? { ...p, [f]: v } : p)) : null}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
