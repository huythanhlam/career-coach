import React from "react";
import { SkillsPicker } from "@/components/ui/SkillsPicker";
import { Plus, X } from "lucide-react";
import { SKILLS_BY_CATEGORY } from "@/lib/profileOptions";
import { ResumeFormState, ResumeFormAction } from "./resumeFormReducer";

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

export function getSkillsForRoles(roles: string[]): string[] {
  const roleText = roles.filter(Boolean).join(" ").toLowerCase();
  if (!roleText) return [];
  const categoryMap: Record<string, string[]> = {
    "Frontend Development": [
      "frontend",
      "front-end",
      "ui engineer",
      "react",
      "vue",
      "angular",
      "web developer",
    ],
    "Backend Development": [
      "backend",
      "back-end",
      "server",
      "api",
      "node",
      "java",
      "python",
      "golang",
      "rails",
      "software engineer",
    ],
    "Data & Analytics": [
      "data",
      "analyst",
      "analytics",
      "scientist",
      "machine learning",
      "ai engineer",
    ],
    "Cloud & DevOps": [
      "devops",
      "cloud",
      "infrastructure",
      "sre",
      "platform engineer",
      "site reliability",
    ],
    "Mobile Development": ["mobile", "ios", "android", "react native", "flutter"],
    "Product & Strategy": ["product manager", "product owner", "strategy"],
    Design: ["designer", "ux", "figma"],
    "Business & Operations": ["operations", "business analyst", "biz ops"],
    "Finance & Accounting": ["finance", "financial", "accounting", "controller"],
    Sales: ["sales", "account executive", "business development", "sdr", "bdr"],
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

interface Props {
  state: Pick<ResumeFormState, "skills" | "newSkill" | "suggestedSkills" | "targetRole">;
  dispatch: React.Dispatch<ResumeFormAction>;
}

export const SkillsSection = React.memo(function SkillsSection({ state, dispatch }: Props) {
  const { skills, newSkill, suggestedSkills } = state;

  return (
    <div>
      <div style={{ ...sectionHeadStyle, justifyContent: "space-between" }}>
        <span>Skills & Additional Info</span>
        <span
          className="text-xs font-normal"
          style={{ color: skills.length > 10 ? "#e05c5c" : "var(--muted-foreground)" }}
        >
          {skills.length}/10 recommended
        </span>
      </div>
      {skills.length > 10 && (
        <div
          className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl text-xs"
          style={{
            background: "rgba(224,92,92,0.08)",
            border: "1px solid rgba(224,92,92,0.25)",
            color: "#e05c5c",
          }}
        >
          Tip: Keep it to 10 or fewer skills on a resume — a focused list is more impactful than a
          long one.
        </div>
      )}
      {suggestedSkills.filter((s) => !skills.includes(s)).length > 0 && (
        <div className="mb-3">
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Suggested from your roles
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestedSkills
              .filter((s) => !skills.includes(s))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => dispatch({ type: "SET_SKILLS", payload: [...skills, s] })}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
                  style={{
                    background: "var(--muted)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <Plus className="w-3 h-3" /> {s}
                </button>
              ))}
          </div>
        </div>
      )}
      <label style={labelStyle}>Core Skills</label>
      <SkillsPicker
        selected={skills}
        onChange={(s) => dispatch({ type: "SET_SKILLS", payload: s })}
      />
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
              style={{
                background: "rgba(217,119,87,0.10)",
                border: "1px solid rgba(217,119,87,0.25)",
                color: "var(--primary)",
              }}
            >
              {s}
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "SET_SKILLS", payload: skills.filter((x) => x !== s) })
                }
                style={{
                  lineHeight: 1,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--primary)",
                  padding: 0,
                }}
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
          onChange={(e) => dispatch({ type: "SET_NEW_SKILL", payload: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const s = newSkill.trim();
              if (s && !skills.includes(s)) {
                dispatch({ type: "SET_SKILLS", payload: [...skills, s] });
                dispatch({ type: "SET_NEW_SKILL", payload: "" });
              }
            }
          }}
          placeholder="Add a custom skill…"
          className="flex-1 text-xs px-3 py-2 rounded-xl outline-none"
          style={{
            background: "var(--muted)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            fontFamily: "inherit",
          }}
        />
        <button
          type="button"
          onClick={() => {
            const s = newSkill.trim();
            if (s && !skills.includes(s)) {
              dispatch({ type: "SET_SKILLS", payload: [...skills, s] });
              dispatch({ type: "SET_NEW_SKILL", payload: "" });
            }
          }}
          className="px-3 py-2 rounded-xl text-xs font-semibold"
          style={{
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});
