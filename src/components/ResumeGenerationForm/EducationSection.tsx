import React from "react";
import { ComboInput } from "@/components/ui/ComboInput";
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";
import { UNIVERSITIES, DEGREE_TYPES, COMMON_MAJORS, COMMON_MINORS } from "@/lib/profileOptions";
import { Plus, Trash2 } from "lucide-react";
import { ResumeFormState, ResumeFormAction } from "./resumeFormReducer";

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

interface Props {
  state: Pick<ResumeFormState, "education" | "expandedEduIndices">;
  dispatch: React.Dispatch<ResumeFormAction>;
}

export const EducationSection = React.memo(function EducationSection({ state, dispatch }: Props) {
  const { education, expandedEduIndices } = state;

  const handleEduChange = (index: number, field: string, value: string) => {
    const newEdu = [...education];
    newEdu[index] = { ...newEdu[index], [field]: value };
    dispatch({ type: "SET_EDUCATION", payload: newEdu });
  };

  const addEdu = () => {
    const newIdx = education.length;
    dispatch({ type: "SET_EDUCATION", payload: [...education, { university: "", degree: "", graduationYear: "", major: "", minor: "" }] });
    dispatch({ type: "SET_EXPANDED_EDU_INDICES", payload: [...expandedEduIndices, newIdx] });
  };

  const removeEdu = (index: number) => {
    dispatch({ type: "SET_EDUCATION", payload: education.filter((_, i) => i !== index) });
    dispatch({ type: "SET_EXPANDED_EDU_INDICES", payload: expandedEduIndices.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i)) });
  };

  return (
    <div>
      <div style={{ ...sectionHeadStyle, justifyContent: "space-between" }}>
        <span>Education</span>
        <button type="button" onClick={addEdu} style={{ height: 32, padding: "0 12px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 9999, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--foreground)" }}>
          <Plus className="w-3.5 h-3.5" /> Add Education
        </button>
      </div>
      {education.map((edu, idx) => {
        const isExpanded = expandedEduIndices.includes(idx);
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
                  <button type="button" onClick={() => dispatch({ type: "SET_EXPANDED_EDU_INDICES", payload: [...expandedEduIndices, idx] })}
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
                      <button type="button" onClick={() => dispatch({ type: "SET_EXPANDED_EDU_INDICES", payload: expandedEduIndices.filter((i) => i !== idx) })}
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
  );
});
