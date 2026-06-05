import React, { useState } from "react";
import { Loader2, ClipboardCheck, X, Wand2, Lightbulb } from "lucide-react";
import { UNSURE, type CareerSurvey } from "@/types/userProfile";
import { SurveyTextField } from "@/components/SurveyTextField";
import { ComboInput } from "@/components/ui/ComboInput";
import { JOB_TITLES, SP500_COMPANIES } from "@/lib/profileOptions";

interface CurrentStateSurveyProps {
  initial?: CareerSurvey;
  isSaving?: boolean;
  onSave: (survey: CareerSurvey) => void;
  /** Optional. When omitted, the Cancel button is hidden (e.g. always-on inline). */
  onCancel?: () => void;
  /** Show the "Your role today" baseline section. Hidden when the profile
   * already supplies the baseline (current role). Defaults to true. */
  showBaseline?: boolean;
  /** Baseline-only mode: render ONLY the "Your role today" section (the quick
   * "baseline survey"), hiding the full check-in questions. */
  baselineOnly?: boolean;
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--foreground)",
  marginBottom: 8,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 14,
  color: "var(--foreground)",
  width: "100%",
  height: 46,
  padding: "0 14px",
  outline: "none",
  fontFamily: "inherit",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--muted-foreground)",
};

type ScaleKey =
  | "jobSatisfaction" | "growthOpportunity" | "compensationSatisfaction"
  | "workLifeBalance" | "recognition";

const SCALES: { key: ScaleKey; label: string; low: string; high: string }[] = [
  { key: "jobSatisfaction", label: "Overall job satisfaction", low: "Unhappy", high: "Thriving" },
  { key: "growthOpportunity", label: "Room to grow where you are", low: "None", high: "Lots" },
  { key: "compensationSatisfaction", label: "Happy with your compensation", low: "Underpaid", high: "Well paid" },
  { key: "workLifeBalance", label: "Work-life balance", low: "Burning out", high: "Healthy" },
  { key: "recognition", label: "Recognized for your contributions", low: "Overlooked", high: "Valued" },
];

const MOBILITY = ["Staying & growing", "Open to the right move", "Actively looking", UNSURE];
const MANAGER = ["Very supportive", "Somewhat", "Not really", "No manager", UNSURE];

type TextKey = "energizers" | "frustrations" | "recentWins" | "skillsToGrow" | "biggestBlocker";
const TEXTS: { key: TextKey; label: string; placeholder: string }[] = [
  { key: "energizers", label: "What energizes you most in your current role?", placeholder: "e.g. mentoring teammates, solving gnarly architecture problems" },
  { key: "frustrations", label: "What frustrates or drains you most right now?", placeholder: "e.g. unclear priorities, too many meetings, no path to promotion" },
  { key: "recentWins", label: "Your proudest wins in the last 6–12 months?", placeholder: "e.g. led the payments migration, mentored a junior to mid-level" },
  { key: "skillsToGrow", label: "Which skills do you most want to use or grow?", placeholder: "e.g. system design, people management, public speaking" },
  { key: "biggestBlocker", label: "The #1 thing holding you back from your next step?", placeholder: "e.g. lack of visibility, missing a key skill, no open headcount" },
];

export function CurrentStateSurvey({ initial, isSaving, onSave, onCancel, showBaseline = true, baselineOnly = false }: CurrentStateSurveyProps) {
  const [survey, setSurvey] = useState<CareerSurvey>(initial ?? {});

  const setScale = (key: ScaleKey, value: number) =>
    setSurvey((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
  const setField = <K extends keyof CareerSurvey>(key: K, value: CareerSurvey[K]) =>
    setSurvey((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    onSave({ ...survey, updatedAt: new Date().toISOString() });
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Current state survey">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Your role today — baseline identity (hidden when the profile already has it) */}
        {(showBaseline || baselineOnly) && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderLeft: "3px solid var(--primary)", borderRadius: 18, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={sectionTitle}>Your role today</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.5 }}>
              {baselineOnly
                ? "Just the essentials so the coach knows your starting point. We'll save these to your profile."
                : "This is the starting point your plan is built from. We'll offer to save it to your profile."}
            </div>
          </div>
          <div>
            <label htmlFor="survey-currentRole" style={labelStyle}>
              Current role / title
              {!survey.currentRole?.trim() && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "var(--primary)" }}>Needed for your plan</span>
              )}
            </label>
            <ComboInput
              id="survey-currentRole"
              value={survey.currentRole ?? ""}
              onChange={(v) => setField("currentRole", v)}
              options={JOB_TITLES}
              placeholder="e.g. Senior Backend Engineer"
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label htmlFor="survey-company" style={labelStyle}>Company</label>
              <ComboInput
                id="survey-company"
                value={survey.company ?? ""}
                onChange={(v) => setField("company", v)}
                options={SP500_COMPANIES}
                placeholder="e.g. Acme Corp"
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="survey-yearsExperience" style={labelStyle}>Years of experience</label>
              <input
                id="survey-yearsExperience"
                type="text"
                inputMode="numeric"
                value={survey.yearsExperience ?? ""}
                onChange={(e) => setField("yearsExperience", e.target.value)}
                placeholder="e.g. 6"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
        )}

        {!baselineOnly && (<>
        {/* How it's going — scales */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={sectionTitle}>How it's going</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>Rate each from 1 (low) to 5 (high).</div>
          </div>
          {SCALES.map((s) => (
            <div key={s.key}>
              <label style={labelStyle}>{s.label}</label>
              <div role="radiogroup" aria-label={s.label} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", width: 64, textAlign: "right" }}>{s.low}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = survey[s.key] === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`${n}`}
                        onClick={() => setScale(s.key, n)}
                        style={{
                          width: 40, height: 40, borderRadius: 10,
                          border: `2px solid ${active ? "var(--primary)" : "var(--border)"}`,
                          background: active ? "var(--primary)" : "var(--muted)",
                          color: active ? "#fff" : "var(--foreground)",
                          fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
                          transition: "all 0.12s",
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", width: 64 }}>{s.high}</span>
                {(() => {
                  const unsure = survey[s.key] === UNSURE;
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={unsure}
                      aria-label="Unsure"
                      onClick={() => setField(s.key, unsure ? undefined : UNSURE)}
                      style={{
                        height: 40, padding: "0 14px", borderRadius: 10,
                        border: `2px solid ${unsure ? "var(--muted-foreground)" : "var(--border)"}`,
                        background: unsure ? "color-mix(in srgb, var(--muted-foreground) 18%, transparent)" : "var(--muted)",
                        color: "var(--foreground)", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
                        transition: "all 0.12s",
                      }}
                    >
                      Unsure
                    </button>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>

        {/* Your situation — selects */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={sectionTitle}>Your situation</div>
          <div>
            <label style={labelStyle}>Where's your head at?</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MOBILITY.map((m) => {
                const active = survey.mobility === m;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setField("mobility", active ? undefined : m)}
                    style={{
                      padding: "9px 14px", borderRadius: 9999,
                      border: `2px solid ${active ? "var(--primary)" : "var(--border)"}`,
                      background: active ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--muted)",
                      color: active ? "var(--primary)" : "var(--foreground)",
                      fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={labelStyle}>How supportive is your manager of your growth?</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MANAGER.map((m) => {
                const active = survey.managerSupport === m;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setField("managerSupport", active ? undefined : m)}
                    style={{
                      padding: "9px 14px", borderRadius: 9999,
                      border: `2px solid ${active ? "var(--primary)" : "var(--border)"}`,
                      background: active ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--muted)",
                      color: active ? "var(--primary)" : "var(--foreground)",
                      fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* In your words — text */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div style={sectionTitle}>In your words</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>
              Type or dictate with the mic, then polish with AI:
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
          {TEXTS.map((t) => (
            <SurveyTextField
              key={t.key}
              id={`survey-${t.key}`}
              label={t.label}
              value={survey[t.key] ?? ""}
              placeholder={t.placeholder}
              onChange={(v) => setField(t.key, v)}
            />
          ))}
        </div>
        </>)}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{ height: 48, padding: "0 18px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "var(--foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving}
            style={{
              flex: 1, height: 48, background: "var(--primary)", color: "#fff", border: "none",
              borderRadius: 14, fontFamily: "inherit", fontSize: 14, fontWeight: 600,
              cursor: isSaving ? "not-allowed" : "pointer", opacity: isSaving ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><ClipboardCheck className="w-4 h-4" /> {baselineOnly ? "Save baseline" : "Save current-state survey"}</>}
          </button>
        </div>
      </div>
    </form>
  );
}
