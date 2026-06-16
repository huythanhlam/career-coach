import React from "react";
import { Input } from "@/components/ui/input";
import { User } from "lucide-react";
import { ResumeFormState, ResumeFormAction } from "./resumeFormReducer";
import { COMMON_ROLES } from "@/config/workflows";

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

interface Props {
  state: Pick<ResumeFormState, "personalInfo" | "targetRole" | "targetRoleSelect" | "template">;
  dispatch: React.Dispatch<ResumeFormAction>;
}

export const PersonalInfoSection = React.memo(function PersonalInfoSection({ state, dispatch }: Props) {
  const { personalInfo, targetRole, targetRoleSelect, template } = state;
  return (
    <>
      {/* Template + Target Role */}
      <div style={{ padding: 20, background: "rgba(217,119,87,0.05)", border: "1px solid rgba(217,119,87,0.15)", borderRadius: 16 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label style={labelStyle}>Selected Template</label>
            <div style={{ ...fieldStyle, display: "flex", alignItems: "center", gap: 10, cursor: "default" }}>
              <span style={{ color: "var(--primary)", flexShrink: 0 }}>⬜</span>
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
                dispatch({ type: "SET_TARGET_ROLE_SELECT", payload: val });
                if (val !== "Other") dispatch({ type: "SET_TARGET_ROLE", payload: val });
                else dispatch({ type: "SET_TARGET_ROLE", payload: "" });
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
                onChange={(e) => dispatch({ type: "SET_TARGET_ROLE", payload: e.target.value })}
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
                onChange={e => dispatch({ type: "SET_PERSONAL_INFO", payload: { [key]: e.target.value } })}
                style={fieldStyle}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
});
