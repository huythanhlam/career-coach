import { useState } from "react";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import type { UserProfile, WorkExperience, Education } from "@/types/userProfile";
import { generateId } from "@/types/userProfile";
import { ComboInput } from "@/components/ui/ComboInput";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { EndDateField } from "@/components/ui/EndDateField";
import {
  JOB_TITLES,
  SP500_COMPANIES,
  UNIVERSITIES,
  DEGREE_TYPES,
  COMMON_MAJORS,
  COMMON_MINORS,
} from "@/lib/profileOptions";

interface Props {
  extracted: Partial<UserProfile>;
  onConfirm: (profile: Partial<UserProfile>) => void;
  onBack: () => void;
  onSkip: () => void;
}

const inputStyle: React.CSSProperties = {
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  height: 42,
  fontSize: 13,
  padding: "0 12px",
  color: "var(--foreground)",
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted-foreground)",
  marginBottom: 5,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-sm font-semibold mb-3 pb-2"
      style={{ color: "var(--foreground)", borderBottom: "1px solid var(--border)" }}
    >
      {children}
    </h3>
  );
}

export function ReviewStep({ extracted, onConfirm, onBack, onSkip }: Props) {
  const [fullName, setFullName] = useState(extracted.fullName ?? "");
  const [preferredName, setPreferredName] = useState(extracted.preferredName ?? "");
  const [email, setEmail] = useState(extracted.email ?? "");
  const [phone, setPhone] = useState(extracted.phone ?? "");
  const [linkedin, setLinkedin] = useState(extracted.linkedin ?? "");
  const [github, setGithub] = useState(extracted.github ?? "");
  const [portfolio, setPortfolio] = useState(extracted.portfolio ?? "");
  const [targetRole, setTargetRole] = useState(extracted.targetRole ?? "");
  const [summary, setSummary] = useState(extracted.summary ?? "");
  const [workHistory, setWorkHistory] = useState<WorkExperience[]>(
    extracted.workHistory?.length
      ? extracted.workHistory
      : [
          {
            id: generateId(),
            company: "",
            role: "",
            startDate: "",
            endDate: "",
            responsibilities: "",
          },
        ],
  );
  const [education, setEducation] = useState<Education[]>(
    extracted.education?.length
      ? extracted.education
      : [
          {
            id: generateId(),
            university: "",
            degree: "",
            graduationYear: "",
            major: "",
            minor: "",
          },
        ],
  );
  const [skills, setSkills] = useState((extracted.skills ?? []).join(", "));

  function updateWork(id: string, field: keyof WorkExperience, value: string | boolean) {
    setWorkHistory((prev) => prev.map((w) => (w.id === id ? { ...w, [field]: value } : w)));
  }
  function addWork() {
    setWorkHistory((prev) => [
      ...prev,
      { id: generateId(), company: "", role: "", startDate: "", endDate: "", responsibilities: "" },
    ]);
  }
  function removeWork(id: string) {
    setWorkHistory((prev) => prev.filter((w) => w.id !== id));
  }

  function updateEdu(id: string, field: keyof Education, value: string) {
    setEducation((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  }
  function addEdu() {
    setEducation((prev) => [
      ...prev,
      { id: generateId(), university: "", degree: "", graduationYear: "", major: "", minor: "" },
    ]);
  }
  function removeEdu(id: string) {
    setEducation((prev) => prev.filter((e) => e.id !== id));
  }

  function handleSave() {
    onConfirm({
      fullName: fullName.trim(),
      preferredName: preferredName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      github: github.trim() || undefined,
      portfolio: portfolio.trim() || undefined,
      targetRole: targetRole.trim() || undefined,
      summary: summary.trim() || undefined,
      workHistory: workHistory.filter((w) => w.company || w.role),
      education: education.filter((e) => e.university || e.degree),
      skills: skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  const displayName = preferredName || fullName.split(" ")[0] || "your profile";

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto">
      {/* Sticky header */}
      <div
        className="flex items-center gap-3 px-6 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
          >
            Here's what we found{displayName !== "your profile" ? `, ${displayName}` : ""}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Review and edit before saving to {displayName}'s profile.
          </p>
        </div>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
        {/* Personal Info */}
        <section>
          <SectionTitle>Personal Info</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                label: "Full Name",
                value: fullName,
                setter: setFullName,
                placeholder: "Jane Smith",
                colSpan: 1,
              },
              {
                label: "Preferred Name",
                value: preferredName,
                setter: setPreferredName,
                placeholder: "Jane",
                colSpan: 1,
              },
              {
                label: "Email",
                value: email,
                setter: setEmail,
                placeholder: "jane@example.com",
                colSpan: 1,
              },
              {
                label: "Phone",
                value: phone,
                setter: setPhone,
                placeholder: "+1 (555) 000-0000",
                colSpan: 1,
              },
              {
                label: "LinkedIn URL",
                value: linkedin,
                setter: setLinkedin,
                placeholder: "https://linkedin.com/in/…",
                colSpan: 2,
              },
              {
                label: "GitHub URL",
                value: github,
                setter: setGithub,
                placeholder: "https://github.com/…",
                colSpan: 1,
              },
              {
                label: "Portfolio URL",
                value: portfolio,
                setter: setPortfolio,
                placeholder: "https://yoursite.com",
                colSpan: 1,
              },
            ].map(({ label, value, setter, placeholder, colSpan }) => (
              <div key={label} className={colSpan === 2 ? "col-span-2" : ""}>
                <label style={labelStyle}>{label}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label style={labelStyle}>Target Role</label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Product Manager"
              style={inputStyle}
            />
          </div>
          {summary && (
            <div className="mt-3">
              <label style={labelStyle}>Professional Summary</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                className="w-full rounded-xl text-xs px-3 py-2.5 outline-none resize-none"
                style={{
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  fontFamily: "inherit",
                  lineHeight: 1.6,
                }}
              />
            </div>
          )}
        </section>

        {/* Work History */}
        <section>
          <SectionTitle>Work History</SectionTitle>
          <div className="flex flex-col gap-3">
            {workHistory.map((w, idx) => (
              <div
                key={w.id}
                className="rounded-xl p-4"
                style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
              >
                <div className="flex justify-between items-center mb-3">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Position {idx + 1}
                  </span>
                  {workHistory.length > 1 && (
                    <button
                      onClick={() => removeWork(w.id)}
                      className="p-1 rounded transition-opacity hover:opacity-70"
                    >
                      <Trash2
                        className="w-3.5 h-3.5"
                        style={{ color: "var(--muted-foreground)" }}
                      />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label style={labelStyle}>Job Title</label>
                    <ComboInput
                      value={w.role}
                      onChange={(v) => updateWork(w.id, "role", v)}
                      options={JOB_TITLES}
                      placeholder="Software Engineer"
                      style={{ ...inputStyle, height: 38 }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Company</label>
                    <ComboInput
                      value={w.company}
                      onChange={(v) => updateWork(w.id, "company", v)}
                      options={SP500_COMPANIES}
                      placeholder="Acme Corp"
                      style={{ ...inputStyle, height: 38 }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Start Date</label>
                    <MonthYearPicker
                      value={w.startDate}
                      onChange={(v) => updateWork(w.id, "startDate", v)}
                      placeholder="Start date"
                      style={{ ...inputStyle, height: 38 }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>End Date</label>
                    <EndDateField
                      id={`review-work-${w.id}`}
                      endDate={w.endDate}
                      current={Boolean(w.current)}
                      onChange={({ endDate, current }) => {
                        updateWork(w.id, "current", current);
                        updateWork(w.id, "endDate", endDate);
                      }}
                      style={{ ...inputStyle, height: 38 }}
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label style={labelStyle}>Responsibilities & Achievements</label>
                  <textarea
                    value={w.responsibilities}
                    onChange={(e) => updateWork(w.id, "responsibilities", e.target.value)}
                    rows={3}
                    placeholder="• Led team of 5 engineers…&#10;• Increased performance by 40%…"
                    className="w-full rounded-xl text-xs px-3 py-2.5 outline-none resize-none"
                    style={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                      fontFamily: "inherit",
                      lineHeight: 1.6,
                    }}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={addWork}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-opacity hover:opacity-70"
              style={{ border: "1.5px dashed var(--border)", color: "var(--muted-foreground)" }}
            >
              <Plus className="w-3.5 h-3.5" /> Add position
            </button>
          </div>
        </section>

        {/* Education */}
        <section>
          <SectionTitle>Education</SectionTitle>
          <div className="flex flex-col gap-3">
            {education.map((e, idx) => (
              <div
                key={e.id}
                className="rounded-xl p-4"
                style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
              >
                <div className="flex justify-between items-center mb-3">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Education {idx + 1}
                  </span>
                  {education.length > 1 && (
                    <button
                      onClick={() => removeEdu(e.id)}
                      className="p-1 rounded transition-opacity hover:opacity-70"
                    >
                      <Trash2
                        className="w-3.5 h-3.5"
                        style={{ color: "var(--muted-foreground)" }}
                      />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label style={labelStyle}>Institution</label>
                    <ComboInput
                      value={e.university}
                      onChange={(v) => updateEdu(e.id, "university", v)}
                      options={UNIVERSITIES}
                      placeholder="MIT"
                      style={{ ...inputStyle, height: 38 }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Degree / Field</label>
                    <ComboInput
                      value={e.degree}
                      onChange={(v) => updateEdu(e.id, "degree", v)}
                      options={DEGREE_TYPES}
                      placeholder="B.S. Computer Science"
                      style={{ ...inputStyle, height: 38 }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Graduation Year</label>
                    <MonthYearPicker
                      value={e.graduationYear}
                      onChange={(v) => updateEdu(e.id, "graduationYear", v)}
                      placeholder="Graduation"
                      style={{ ...inputStyle, height: 38 }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Major</label>
                    <ComboInput
                      value={e.major ?? ""}
                      onChange={(v) => updateEdu(e.id, "major", v)}
                      options={COMMON_MAJORS}
                      placeholder="e.g., Computer Science"
                      style={{ ...inputStyle, height: 38 }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Minor</label>
                    <ComboInput
                      value={e.minor ?? ""}
                      onChange={(v) => updateEdu(e.id, "minor", v)}
                      options={COMMON_MINORS}
                      placeholder="e.g., Statistics"
                      style={{ ...inputStyle, height: 38 }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={addEdu}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-opacity hover:opacity-70"
              style={{ border: "1.5px dashed var(--border)", color: "var(--muted-foreground)" }}
            >
              <Plus className="w-3.5 h-3.5" /> Add education
            </button>
          </div>
        </section>

        {/* Skills */}
        <section className="pb-2">
          <SectionTitle>Skills</SectionTitle>
          <label style={labelStyle}>Core Skills (comma-separated)</label>
          <textarea
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            rows={3}
            placeholder="React, TypeScript, Product Strategy, SQL, Figma…"
            className="w-full rounded-xl text-sm px-3 py-2.5 outline-none resize-none"
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              fontFamily: "inherit",
              lineHeight: 1.6,
            }}
          />
        </section>
      </div>

      {/* Sticky footer */}
      <div
        className="px-6 py-4 flex flex-col gap-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{
            background: "var(--primary)",
            color: "#fff",
            boxShadow: "0 6px 20px rgba(217,119,87,0.24)",
          }}
        >
          Save profile
        </button>
        <button
          onClick={onSkip}
          className="text-xs text-center transition-opacity hover:opacity-70"
          style={{ color: "var(--muted-foreground)" }}
        >
          Edit later — skip for now
        </button>
      </div>
    </div>
  );
}
