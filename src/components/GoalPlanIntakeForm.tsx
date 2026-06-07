import React, { useState } from "react";
import {
  Sparkles, GraduationCap, TrendingUp, Repeat, Briefcase, DollarSign,
  Users, Award, Share2, Scale, Globe, Plus, Check, Wand2, Lightbulb,
} from "lucide-react";
import { SurveyTextField } from "@/components/SurveyTextField";

/** A single career goal the user selected, plus their specifics for the year. */
export interface SelectedGoal {
  goalType: string;
  detail: string;
}

export interface GoalPlanIntakeData {
  goals: SelectedGoal[];
  timeframe: string;
  notes: string;
}

interface GoalPlanIntakeFormProps {
  onSubmit: (data: GoalPlanIntakeData) => void;
  isGenerating: boolean;
  /** Whether a baseline identity (current role) exists in profile or survey.
   * The baseline card above handles capturing it; here it only gates submit. */
  baselineReady?: boolean;
  /** Pre-fill the form (e.g. editing the responses behind an existing plan). */
  initial?: GoalPlanIntakeData;
  /** Override the submit button label (e.g. "Regenerate plan"). */
  submitLabel?: string;
  /** When provided, render a Cancel button (edit-responses mode). */
  onCancel?: () => void;
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

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--muted-foreground)",
};

const OTHER = "Other";

interface GoalType {
  value: string;
  label: string;
  icon: React.ReactNode;
  desc: string;
  placeholder: string;
}

/** Common career goals people set for the year — surfaced as suggestions. */
const GOAL_TYPES: GoalType[] = [
  { value: "Learn a new skill", label: "Learn a new skill", icon: <GraduationCap className="w-4 h-4" />, desc: "Build a new capability or specialization", placeholder: "e.g. Get hands-on with system design and ship one design doc per quarter" },
  { value: "Get a promotion", label: "Get a promotion", icon: <TrendingUp className="w-4 h-4" />, desc: "Level up in your current track", placeholder: "e.g. Reach Senior by demonstrating cross-team impact and leading a project" },
  { value: "Change roles", label: "Change roles", icon: <Repeat className="w-4 h-4" />, desc: "Move into a different role or function", placeholder: "e.g. Move from Backend Engineer toward Engineering Management" },
  { value: "Find a new job", label: "Find a new job", icon: <Briefcase className="w-4 h-4" />, desc: "Switch companies or land a new offer", placeholder: "e.g. Land a senior role at a product-led company by Q3" },
  { value: "Increase my compensation", label: "Increase compensation", icon: <DollarSign className="w-4 h-4" />, desc: "Negotiate a raise or higher total comp", placeholder: "e.g. Push total comp toward market rate; prepare for a raise conversation" },
  { value: "Move into leadership", label: "Move into leadership", icon: <Users className="w-4 h-4" />, desc: "Grow into management or tech lead", placeholder: "e.g. Mentor two engineers and own a workstream end-to-end" },
  { value: "Earn a certification", label: "Earn a certification", icon: <Award className="w-4 h-4" />, desc: "Get a credential that boosts your profile", placeholder: "e.g. Pass AWS Solutions Architect; study 4 hrs/week" },
  { value: "Grow my network", label: "Grow my network", icon: <Share2 className="w-4 h-4" />, desc: "Build relationships and visibility", placeholder: "e.g. Attend one event a month and publish two posts on my work" },
  { value: "Improve work-life balance", label: "Work-life balance", icon: <Scale className="w-4 h-4" />, desc: "Sustainable pace without stalling growth", placeholder: "e.g. Set boundaries while still hitting a growth milestone" },
  { value: "Transition to a new industry", label: "Switch industry", icon: <Globe className="w-4 h-4" />, desc: "Pivot to a new domain or sector", placeholder: "e.g. Move from fintech into health tech" },
  { value: OTHER, label: "Something else", icon: <Plus className="w-4 h-4" />, desc: "Define your own goal", placeholder: "Describe the goal and what you want to do this year…" },
];

const TIMEFRAMES = ["3 months", "6 months", "1 year", "2 years", "3+ years"];

export function GoalPlanIntakeForm({
  onSubmit, isGenerating, baselineReady = true, initial, submitLabel, onCancel,
}: GoalPlanIntakeFormProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {};
    (initial?.goals ?? []).forEach((g) => { s[g.goalType] = true; });
    return s;
  });
  const [details, setDetails] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    (initial?.goals ?? []).forEach((g) => { d[g.goalType] = g.detail; });
    return d;
  });
  const [timeframe, setTimeframe] = useState(initial?.timeframe ?? "1 year");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const toggle = (value: string) =>
    setSelected((prev) => ({ ...prev, [value]: !prev[value] }));

  const setDetail = (value: string, text: string) =>
    setDetails((prev) => ({ ...prev, [value]: text }));

  // Selected goals, preserved in the curated display order.
  const selectedGoals = GOAL_TYPES.filter((g) => selected[g.value]);

  // "Other" needs a description to be meaningful; named goals don't.
  const otherSelectedButEmpty = selectedGoals.some(
    (g) => g.value === OTHER && !(details[OTHER]?.trim())
  );
  const canSubmit = baselineReady && selectedGoals.length > 0 && !otherSelectedButEmpty;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isGenerating) return;
    onSubmit({
      goals: selectedGoals.map((g) => ({
        goalType: g.value,
        detail: (details[g.value] ?? "").trim(),
      })),
      timeframe,
      notes: notes.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Goal selection — multi-select */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={sectionTitle}>What do you want this year?</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>
              Pick all that apply — the coach will build one plan that ties them together.
            </div>
          </div>
          <div role="group" aria-label="Career goals" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {GOAL_TYPES.map((opt) => {
              const active = Boolean(selected[opt.value]);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  aria-pressed={active}
                  style={{
                    position: "relative",
                    padding: "14px 16px",
                    border: `2px solid ${active ? "var(--primary)" : "var(--border)"}`,
                    borderRadius: 12,
                    background: active ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--muted)",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  {active && (
                    <span aria-hidden style={{ position: "absolute", top: 12, right: 12, width: 18, height: 18, borderRadius: 9999, background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                  )}
                  <span style={{ color: active ? "var(--primary)" : "var(--muted-foreground)" }}>{opt.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{opt.label}</span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4 }}>{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Per-goal specifics */}
        {selectedGoals.length > 0 && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={sectionTitle}>What do you want to do this year?</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>
                Add specifics for each goal so the plan is concrete and measurable. Type or dictate with the mic, then polish with AI:
              </div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                  <Wand2 className="w-3.5 h-3.5" style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
                  <span><strong style={{ color: "var(--foreground)", fontWeight: 600 }}>Refine</strong> — polishes how it's written: grammar, clarity, concision, tone, and stronger wording — without changing your meaning or adding ideas.</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                  <Lightbulb className="w-3.5 h-3.5" style={{ color: "var(--marigold)", flexShrink: 0, marginTop: 2 }} />
                  <span><strong style={{ color: "var(--foreground)", fontWeight: 600 }}>Suggest</strong> — reviews your answer and proposes a fuller version to help complete your thought.</span>
                </div>
              </div>
            </div>

            {selectedGoals.map((g) => {
              const required = g.value === OTHER;
              const fieldId = `goal-detail-${g.value.replace(/\s+/g, "-").toLowerCase()}`;
              return (
                <SurveyTextField
                  key={g.value}
                  id={fieldId}
                  labelNode={
                    <>
                      <span style={{ color: "var(--primary)" }}>{g.label}</span>
                      {required
                        ? <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}> — describe your goal</span>
                        : <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}> — what specifically? (optional)</span>}
                    </>
                  }
                  label={required
                    ? "Describe your career goal for this year"
                    : `${g.label} — what specifically do you want to do this year?`}
                  value={details[g.value] ?? ""}
                  placeholder={g.placeholder}
                  onChange={(v) => setDetail(g.value, v)}
                  showUnsure={false}
                />
              );
            })}

            <div>
              <label htmlFor="goal-timeframe" style={labelStyle}>Target timeframe</label>
              <select
                id="goal-timeframe"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                style={{ ...fieldStyle, height: 48, padding: "0 14px", cursor: "pointer" }}
              >
                {TIMEFRAMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <SurveyTextField
              id="goal-notes"
              labelNode={
                <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>
                  Anything else the coach should know? (optional)
                </span>
              }
              label="Anything else the coach should know about my career goals?"
              value={notes}
              placeholder="e.g. constraints on time, location, or a specific company/team you're aiming for"
              onChange={setNotes}
              showUnsure={false}
            />
          </div>
        )}

        {/* Submit */}
        <div style={{ display: "flex", gap: 10 }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{ height: 52, padding: "0 20px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: "var(--foreground)", cursor: "pointer" }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit || isGenerating}
            style={{
              height: 52, flex: 1,
              background: "var(--primary)", color: "#fff", border: "none",
              borderRadius: 14, fontFamily: "inherit", fontSize: 15, fontWeight: 600,
              cursor: !canSubmit || isGenerating ? "not-allowed" : "pointer",
              opacity: !canSubmit || isGenerating ? 0.6 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "opacity 0.15s",
            }}
          >
            <Sparkles className="w-4 h-4" />
            {submitLabel
              ? submitLabel
              : selectedGoals.length > 1 ? `Generate my plan (${selectedGoals.length} goals)` : "Generate my plan"}
          </button>
        </div>
        {!baselineReady && (
          <div style={{ marginTop: -12, fontSize: 12, color: "var(--muted-foreground)", textAlign: "center" }}>
            Set your starting point in the baseline card above to enable plan generation.
          </div>
        )}
      </div>
    </form>
  );
}
