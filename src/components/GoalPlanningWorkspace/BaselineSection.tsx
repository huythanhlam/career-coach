import React from "react";
import {
  Compass, ClipboardList, User as UserIcon, UserCog,
} from "lucide-react";
import { CurrentStateSurvey } from "@/components/CurrentStateSurvey";
import type { CareerSurvey } from "@/types/userProfile";
import type { ViewId } from "@/components/Sidebar";

interface BaselineSectionProps {
  hasBaseline: boolean;
  profileHasBaseline: boolean;
  baseline: string;
  baselineSurveyOpen: boolean;
  savingSurvey: boolean;
  initialSurvey: CareerSurvey;
  onOpenSurvey: () => void;
  onCloseSurvey: () => void;
  onSaveSurvey: (survey: CareerSurvey) => void;
  onNavigate?: (view: ViewId) => void;
}

export function BaselineSection({
  hasBaseline,
  baseline,
  baselineSurveyOpen,
  savingSurvey,
  initialSurvey,
  onOpenSurvey,
  onCloseSurvey,
  onSaveSurvey,
  onNavigate,
}: BaselineSectionProps) {
  return (
    <>
      {/* Baseline card */}
      {!hasBaseline && baselineSurveyOpen ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Compass className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Baseline survey</span>
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Just your starting point — takes a moment.</span>
          </div>
          <CurrentStateSurvey
            initial={initialSurvey}
            isSaving={savingSurvey}
            onSave={onSaveSurvey}
            onCancel={onCloseSurvey}
            baselineOnly
          />
        </div>
      ) : (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "0 8px 30px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <UserIcon className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Your baseline</span>
            {hasBaseline && onNavigate && (
              <button
                onClick={() => onNavigate("profile_settings")}
                style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Edit profile
              </button>
            )}
          </div>

          {hasBaseline ? (
            <div style={{ padding: "16px 22px" }}>
              <pre style={{ margin: 0, fontFamily: "inherit", fontSize: 13, lineHeight: 1.6, color: "var(--muted-foreground)", whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>
                {baseline}
              </pre>
            </div>
          ) : (
            <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <Compass className="w-5 h-5 shrink-0" style={{ color: "var(--marigold)" }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 3 }}>
                    Tell us where you're starting from
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
                    The coach needs your <strong>current role</strong> (and ideally your company) to build a plan grounded in your real situation. Choose one:
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingLeft: 32 }}>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate("profile_settings")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    <UserCog className="w-4 h-4" /> Update my profile
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: "rgba(255,255,255,0.22)", borderRadius: 9999, padding: "2px 7px" }}>Recommended</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenSurvey}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  <ClipboardList className="w-4 h-4" /> Take the baseline survey
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current-state survey */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ClipboardList className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Current-state survey</span>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)" }}>All optional</span>
        </div>

        <div style={{ padding: "14px 18px", borderRadius: 14, background: "color-mix(in srgb, var(--primary) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 18%, transparent)" }}>
          <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.6 }}>
            These answers are woven directly into your <strong>Career Goal Planning Sheet</strong>:
          </div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.65 }}>
            <li>Your satisfaction and what drains you shape the <strong>Current Situation Snapshot</strong>.</li>
            <li>What energizes you and the skills you want to grow steer which <strong>goals get prioritized</strong>.</li>
            <li>Your recent wins become <strong>evidence</strong> the plan builds on.</li>
            <li>Your biggest blocker becomes something the plan <strong>explicitly tackles</strong>.</li>
          </ul>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
            The more you share, the more personal and specific your plan — but it's optional, and your answers save when you hit <strong>Save</strong>.
          </div>
        </div>

        <CurrentStateSurvey
          initial={initialSurvey}
          isSaving={savingSurvey}
          onSave={onSaveSurvey}
          showBaseline={false}
        />
      </div>
    </>
  );
}
