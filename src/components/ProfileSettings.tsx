import { useState } from "react";
import {
  Plus,
  Trash2,
  Save,
  Pencil,
  Check,
  X,
  Linkedin,
  Github,
  Globe,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles,
  Bell,
  Building2,
} from "lucide-react";
import { ComboInput } from "@/components/ui/ComboInput";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { EndDateField } from "@/components/ui/EndDateField";
import { endDateLabel } from "@/lib/workExperience";
import { SkillsPicker } from "@/components/ui/SkillsPicker";
import { CoachMemoryPanel } from "@/components/CoachMemoryPanel";
import {
  JOB_TITLES,
  SP500_COMPANIES,
  UNIVERSITIES,
  DEGREE_TYPES,
  COMMON_MAJORS,
  COMMON_MINORS,
} from "@/lib/profileOptions";
import type { WorkExperience, Education } from "@/types/userProfile";
import { generateId } from "@/types/userProfile";
import { useUserProfile } from "@/context/UserProfileContext";
import { ModeSwitch } from "@/components/ModeSwitch";
import { MODE_META } from "@/lib/accountMode";
import type { TargetRole, TargetCompany } from "@/types/jobPosting";
import { detectAtsFromUrl } from "@/services/jobScanService";
import { deriveTargetRoles } from "@/lib/targetRoleDerivation";

/* ── gradient cover ──────────────────────────────────────────── */
const COVER_GRADIENT = "linear-gradient(135deg, #D97757 0%, #E8B948 40%, #2F6B4F 100%)";

/* ── skill pill ──────────────────────────────────────────────── */
function SkillPill({ skill, onRemove }: { skill: string; onRemove: () => void }) {
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

/* ── timeline card ───────────────────────────────────────────── */
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
              {meta && (
                <>
                  {" "}
                  · <span>{meta}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg"
              style={{ background: "var(--muted)" }}
            >
              <Pencil className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg"
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

/* ── field styles ────────────────────────────────────────────── */
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
  const { profile, updateProfile } = useUserProfile();

  const [targetRole, setTargetRole] = useState(profile.targetRole ?? "");
  const [location, setLocation] = useState(profile.currentRole ?? "");
  const [summary, setSummary] = useState(profile.summary ?? "");
  const [linkedin, setLinkedin] = useState(profile.linkedin ?? "");
  const [github, setGithub] = useState(profile.github ?? "");
  const [portfolio, setPortfolio] = useState(profile.portfolio ?? "");
  const [skillsList, setSkillsList] = useState<string[]>(profile.skills ?? []);
  const [newSkill, setNewSkill] = useState("");
  const [saved, setSaved] = useState(false);

  /* job alerts state — target roles drive the weekly suggested-postings scan,
     so seed from the resume-derived target role / work history when no
     structured roles exist yet (same derivation used on every profile save) */
  const [alertRoles, setAlertRoles] = useState<TargetRole[]>(
    profile.targetRoles?.length ? profile.targetRoles : deriveTargetRoles(profile),
  );
  const [newAlertRole, setNewAlertRole] = useState("");
  const [followedCompanies, setFollowedCompanies] = useState<TargetCompany[]>(
    profile.targetCompanies ?? [],
  );
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyUrl, setNewCompanyUrl] = useState("");
  const [companyError, setCompanyError] = useState("");

  /* experience state */
  const [workHistory, setWorkHistory] = useState<WorkExperience[]>(
    profile.workHistory?.length ? profile.workHistory : [],
  );
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const [workDraft, setWorkDraft] = useState<WorkExperience | null>(null);
  const [addingWork, setAddingWork] = useState(false);
  const [newWork, setNewWork] = useState<WorkExperience>({
    id: "",
    company: "",
    role: "",
    startDate: "",
    endDate: "",
    responsibilities: "",
  });

  /* education state */
  const [education, setEducation] = useState<Education[]>(
    profile.education?.length ? profile.education : [],
  );
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [eduDraft, setEduDraft] = useState<Education | null>(null);
  const [addingEdu, setAddingEdu] = useState(false);
  const [newEdu, setNewEdu] = useState<Education>({
    id: "",
    university: "",
    degree: "",
    graduationYear: "",
    major: "",
    minor: "",
  });

  /* derived */
  const fullName = profile.fullName || profile.preferredName || "";
  const initials =
    fullName
      .trim()
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";

  function handleSave() {
    updateProfile({
      linkedin: linkedin.trim() || undefined,
      github: github.trim() || undefined,
      portfolio: portfolio.trim() || undefined,
      targetRole: targetRole.trim() || undefined,
      currentRole: location.trim() || undefined,
      summary: summary.trim() || undefined,
      workHistory: workHistory.filter((w) => w.company || w.role),
      education: education.filter((e) => e.university || e.degree),
      skills: skillsList.filter(Boolean),
      targetRoles: alertRoles,
      targetCompanies: followedCompanies,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function addSkill() {
    const s = newSkill.trim();
    if (s && !skillsList.includes(s)) {
      setSkillsList((p) => [...p, s]);
      setNewSkill("");
    }
  }

  function addAlertRole() {
    const title = newAlertRole.trim();
    if (!title || alertRoles.some((r) => r.title.toLowerCase() === title.toLowerCase())) return;
    setAlertRoles((p) => [...p, { id: generateId(), title }]);
    setNewAlertRole("");
  }

  function addFollowedCompany() {
    const name = newCompanyName.trim();
    const url = newCompanyUrl.trim();
    if (!name || !url) {
      setCompanyError("Enter the company name and its careers-page URL.");
      return;
    }
    const detected = detectAtsFromUrl(url);
    if (!detected) {
      setCompanyError(
        "Couldn't recognize that careers page — paste a Greenhouse, Lever, Ashby, Workable, or SmartRecruiters board URL.",
      );
      return;
    }
    if (
      followedCompanies.some((c) => c.ats === detected.ats && c.boardToken === detected.boardToken)
    ) {
      setCompanyError("You're already following this company's board.");
      return;
    }
    setFollowedCompanies((p) => [...p, { id: generateId(), name, ...detected }]);
    setNewCompanyName("");
    setNewCompanyUrl("");
    setCompanyError("");
  }

  /* work helpers */
  function commitWork() {
    if (!workDraft) return;
    setWorkHistory((p) => p.map((w) => (w.id === workDraft.id ? workDraft : w)));
    setEditingWorkId(null);
    setWorkDraft(null);
  }
  function commitNewWork() {
    if (!newWork.role && !newWork.company) return;
    setWorkHistory((p) => [...p, { ...newWork, id: generateId() }]);
    setAddingWork(false);
    setNewWork({ id: "", company: "", role: "", startDate: "", endDate: "", responsibilities: "" });
  }

  /* education helpers */
  function commitEdu() {
    if (!eduDraft) return;
    setEducation((p) => p.map((e) => (e.id === eduDraft.id ? eduDraft : e)));
    setEditingEduId(null);
    setEduDraft(null);
  }
  function commitNewEdu() {
    if (!newEdu.university && !newEdu.degree) return;
    setEducation((p) => [...p, { ...newEdu, id: generateId() }]);
    setAddingEdu(false);
    setNewEdu({ id: "", university: "", degree: "", graduationYear: "", major: "", minor: "" });
  }

  function workFields(
    data: WorkExperience,
    onChange: (f: keyof WorkExperience, v: string | boolean) => void,
  ) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label style={lStyle}>Job Title</label>
          <ComboInput
            style={iStyle}
            value={data.role}
            onChange={(v) => onChange("role", v)}
            options={JOB_TITLES}
            placeholder="Product Manager"
          />
        </div>
        <div>
          <label style={lStyle}>Company</label>
          <ComboInput
            style={iStyle}
            value={data.company}
            onChange={(v) => onChange("company", v)}
            options={SP500_COMPANIES}
            placeholder="Acme Corp"
          />
        </div>
        <div>
          <label style={lStyle}>Start Date</label>
          <MonthYearPicker
            value={data.startDate}
            onChange={(v) => onChange("startDate", v)}
            style={iStyle}
          />
        </div>
        <div>
          <label style={lStyle}>End Date</label>
          <EndDateField
            id={`work-${data.id || "new"}`}
            endDate={data.endDate}
            current={Boolean(data.current)}
            onChange={({ endDate, current }) => {
              onChange("current", current);
              onChange("endDate", endDate);
            }}
            style={iStyle}
          />
        </div>
        <div className="col-span-2">
          <label style={lStyle}>Highlights</label>
          <textarea
            value={data.responsibilities}
            placeholder="Key achievements and responsibilities…"
            rows={3}
            onChange={(e) => onChange("responsibilities", e.target.value)}
            style={{ ...iStyle, height: "auto", padding: "8px 12px", resize: "none" }}
          />
        </div>
      </div>
    );
  }

  function eduFields(data: Education, onChange: (f: keyof Education, v: string) => void) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="col-span-2">
          <label style={lStyle}>Institution</label>
          <ComboInput
            style={iStyle}
            value={data.university}
            onChange={(v) => onChange("university", v)}
            options={UNIVERSITIES}
            placeholder="MIT"
          />
        </div>
        <div>
          <label style={lStyle}>Degree</label>
          <ComboInput
            style={iStyle}
            value={data.degree}
            onChange={(v) => onChange("degree", v)}
            options={DEGREE_TYPES}
            placeholder="B.S. Computer Science"
          />
        </div>
        <div>
          <label style={lStyle}>Graduation Year</label>
          <MonthYearPicker
            value={data.graduationYear}
            onChange={(v) => onChange("graduationYear", v)}
            style={iStyle}
          />
        </div>
        <div>
          <label style={lStyle}>Major</label>
          <ComboInput
            style={iStyle}
            value={data.major ?? ""}
            onChange={(v) => onChange("major", v)}
            options={COMMON_MAJORS}
            placeholder="e.g., Computer Science"
          />
        </div>
        <div>
          <label style={lStyle}>Minor</label>
          <ComboInput
            style={iStyle}
            value={data.minor ?? ""}
            onChange={(v) => onChange("minor", v)}
            options={COMMON_MINORS}
            placeholder="e.g., Statistics"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: "var(--background)" }}
    >
      {/* ── Cover + Avatar ──────────────────────────────────── */}
      <div className="relative flex-shrink-0">
        <div className="w-full" style={{ height: 180, background: COVER_GRADIENT }} />
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
        className="px-4 sm:px-8 pt-14 pb-5 flex-shrink-0"
        style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex-1 min-w-0">
          <div
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
          >
            {fullName || <span style={{ color: "var(--muted-foreground)" }}>Your Name</span>}
          </div>

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

          <div className="flex items-center gap-1.5 mt-2">
            <MapPin
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{ color: "var(--muted-foreground)" }}
            />
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

        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Write a short professional summary — who you are, what you're pursuing, what makes you unique…"
          rows={3}
          className="w-full text-sm bg-transparent outline-none resize-none mt-4"
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

        {/* Portfolio links */}
        <div className="flex flex-wrap gap-3 mt-4">
          {[
            {
              icon: <Linkedin className="w-3.5 h-3.5" />,
              value: linkedin,
              setter: setLinkedin,
              placeholder: "linkedin.com/in/…",
            },
            {
              icon: <Github className="w-3.5 h-3.5" />,
              value: github,
              setter: setGithub,
              placeholder: "github.com/…",
            },
            {
              icon: <Globe className="w-3.5 h-3.5" />,
              value: portfolio,
              setter: setPortfolio,
              placeholder: "yoursite.com",
            },
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
                style={{ color: "var(--foreground)", minWidth: 80, maxWidth: 180, border: "none" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Body columns ────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 min-h-0">
        {/* Left — Skills */}
        <div
          className="col-span-1 p-6 flex flex-col gap-6 border-b lg:border-b-0 lg:border-r"
          style={{ borderColor: "var(--border)" }}
        >
          {/* Account mode — switch between the job-seeker and employer experiences */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: "var(--muted-foreground)" }}
              >
                Account mode
              </h3>
            </div>
            <ModeSwitch size="md" />
            <p
              className="text-xs mt-2 leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              You're in{" "}
              <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                {MODE_META[profile.accountType === "employer" ? "employer" : "seeker"].modeLabel}
              </span>
              . Switch anytime — the sidebar and tools update to match.
            </p>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: "var(--muted-foreground)" }}
              >
                Skills
              </h3>
              <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
            </div>
            <div className="mb-3">
              <SkillsPicker selected={skillsList} onChange={setSkillsList} />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {skillsList.map((s) => (
                <SkillPill
                  key={s}
                  skill={s}
                  onRemove={() => setSkillsList((p) => p.filter((x) => x !== s))}
                />
              ))}
              {skillsList.length === 0 && (
                <p className="text-xs italic" style={{ color: "var(--muted-foreground)" }}>
                  No skills yet — browse above or type below.
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
                style={{
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={addSkill}
                className="px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>

          {/* Job alerts — feeds the weekly suggested-postings refresh */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: "var(--muted-foreground)" }}
              >
                Job alerts
              </h3>
              <Bell className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
            </div>
            <p
              className="text-xs mb-3 leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              Every Monday we scan job boards for these roles and drop new matches into your
              Suggested lane.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {alertRoles.map((r) => (
                <SkillPill
                  key={r.id}
                  skill={r.title}
                  onRemove={() => setAlertRoles((p) => p.filter((x) => x.id !== r.id))}
                />
              ))}
              {alertRoles.length === 0 && (
                <p className="text-xs italic" style={{ color: "var(--muted-foreground)" }}>
                  No alert roles yet — add one below.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <ComboInput
                style={{ ...iStyle, height: "auto", fontSize: 12, padding: "8px 12px" }}
                value={newAlertRole}
                onChange={setNewAlertRole}
                options={JOB_TITLES}
                placeholder="Add a role to watch…"
              />
              <button
                onClick={addAlertRole}
                className="px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 mt-5 mb-2">
              <Building2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
              <span
                className="text-[11px] font-bold tracking-widest uppercase"
                style={{ color: "var(--muted-foreground)" }}
              >
                Followed companies
              </span>
            </div>
            <p
              className="text-xs mb-3 leading-relaxed"
              style={{ color: "var(--muted-foreground)" }}
            >
              Follow a company's careers page (Greenhouse, Lever, Ashby, Workable, or
              SmartRecruiters) and we'll scan its board directly.
            </p>
            <div className="flex flex-col gap-2 mb-3">
              {followedCompanies.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs group"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
                >
                  <span className="font-semibold truncate" style={{ color: "var(--foreground)" }}>
                    {c.name}
                  </span>
                  <span
                    className="uppercase tracking-wide text-[10px] flex-shrink-0"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {c.ats}
                  </span>
                  <button
                    onClick={() => setFollowedCompanies((p) => p.filter((x) => x.id !== c.id))}
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <ComboInput
                style={{ ...iStyle, height: "auto", fontSize: 12, padding: "8px 12px" }}
                value={newCompanyName}
                onChange={(v) => {
                  setNewCompanyName(v);
                  setCompanyError("");
                }}
                options={SP500_COMPANIES}
                placeholder="Company name"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCompanyUrl}
                  onChange={(e) => {
                    setNewCompanyUrl(e.target.value);
                    setCompanyError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && addFollowedCompany()}
                  placeholder="Careers page URL"
                  className="flex-1 text-xs px-3 py-2 rounded-xl outline-none"
                  style={{
                    background: "var(--muted)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={addFollowedCompany}
                  className="px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: "var(--primary)", color: "#fff" }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {companyError && (
                <p className="text-xs" style={{ color: "var(--primary)" }}>
                  {companyError}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Right — Experience + Education */}
        <div className="col-span-2 p-6 flex flex-col gap-8 overflow-y-auto">
          {/* Experience */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: "var(--muted-foreground)" }}
              >
                Experience
              </h3>
              <button
                onClick={() => {
                  setAddingWork(true);
                  setNewWork({
                    id: "",
                    company: "",
                    role: "",
                    startDate: "",
                    endDate: "",
                    responsibilities: "",
                  });
                }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
                style={{
                  background: "rgba(217,119,87,0.1)",
                  color: "var(--primary)",
                  border: "1px solid rgba(217,119,87,0.2)",
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {addingWork && (
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "var(--card)", border: "1.5px solid var(--primary)" }}
                >
                  {workFields(newWork, (f, v) => setNewWork((p) => ({ ...p, [f]: v })))}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={commitNewWork}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: "var(--primary)", color: "#fff" }}
                    >
                      <Check className="w-3.5 h-3.5" /> Add position
                    </button>
                    <button
                      onClick={() => setAddingWork(false)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium"
                      style={{
                        border: "1px solid var(--border)",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              )}
              {workHistory.length === 0 && !addingWork && (
                <p className="text-xs italic py-2" style={{ color: "var(--muted-foreground)" }}>
                  No experience added yet.
                </p>
              )}
              {workHistory.map((w) => (
                <TimelineCard
                  key={w.id}
                  icon={<Briefcase className="w-4 h-4" style={{ color: "var(--primary)" }} />}
                  title={[w.role, w.company].filter(Boolean).join(" · ")}
                  subtitle={w.company}
                  meta={[w.startDate, endDateLabel(w)].filter(Boolean).join(" – ")}
                  description={w.responsibilities}
                  onEdit={() => {
                    setEditingWorkId(w.id);
                    setWorkDraft({ ...w });
                  }}
                  onDelete={() => setWorkHistory((p) => p.filter((x) => x.id !== w.id))}
                  editing={editingWorkId === w.id}
                  onCommit={commitWork}
                  onCancel={() => {
                    setEditingWorkId(null);
                    setWorkDraft(null);
                  }}
                  fields={
                    workDraft
                      ? workFields(workDraft, (f, v) =>
                          setWorkDraft((p) => (p ? { ...p, [f]: v } : p)),
                        )
                      : null
                  }
                />
              ))}
            </div>
          </section>

          {/* Education */}
          <section className="pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-xs font-bold tracking-widest uppercase"
                style={{ color: "var(--muted-foreground)" }}
              >
                Education
              </h3>
              <button
                onClick={() => {
                  setAddingEdu(true);
                  setNewEdu({
                    id: "",
                    university: "",
                    degree: "",
                    graduationYear: "",
                    major: "",
                    minor: "",
                  });
                }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
                style={{
                  background: "rgba(217,119,87,0.1)",
                  color: "var(--primary)",
                  border: "1px solid rgba(217,119,87,0.2)",
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {addingEdu && (
                <div
                  className="rounded-2xl p-4"
                  style={{ background: "var(--card)", border: "1.5px solid var(--primary)" }}
                >
                  {eduFields(newEdu, (f, v) => setNewEdu((p) => ({ ...p, [f]: v })))}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={commitNewEdu}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: "var(--primary)", color: "#fff" }}
                    >
                      <Check className="w-3.5 h-3.5" /> Add education
                    </button>
                    <button
                      onClick={() => setAddingEdu(false)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium"
                      style={{
                        border: "1px solid var(--border)",
                        color: "var(--muted-foreground)",
                      }}
                    >
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
                  meta={e.graduationYear}
                  onEdit={() => {
                    setEditingEduId(e.id);
                    setEduDraft({ ...e });
                  }}
                  onDelete={() => setEducation((p) => p.filter((x) => x.id !== e.id))}
                  editing={editingEduId === e.id}
                  onCommit={commitEdu}
                  onCancel={() => {
                    setEditingEduId(null);
                    setEduDraft(null);
                  }}
                  fields={
                    eduDraft
                      ? eduFields(eduDraft, (f, v) =>
                          setEduDraft((p) => (p ? { ...p, [f]: v } : p)),
                        )
                      : null
                  }
                />
              ))}
            </div>
          </section>

          {/* Coach memory (F1) — what the coach has learned about you */}
          <CoachMemoryPanel />
        </div>
      </div>
    </div>
  );
}
