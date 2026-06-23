// Recruiter's-Eye Screening Simulator — shared types.
//
// An adversarial "recruiter + ATS parser" pass over a resume against a specific
// job description: the go/no-go verdict a real screener reaches in ~6 seconds,
// plus the knockouts, missing keywords, and prioritized fixes behind it.

export type ScreeningVerdict = "advance" | "borderline" | "reject";

export const VERDICT_LABELS: Record<ScreeningVerdict, string> = {
  advance: "Advance",
  borderline: "Borderline",
  reject: "Reject",
};

/** A single hard requirement from the JD and whether the resume meets it. */
export interface ScreeningKnockout {
  requirement: string;
  met: boolean;
  /** Short note on the resume evidence (or its absence). */
  evidence: string;
}

export type FixPriority = "high" | "medium" | "low";

export interface ScreeningFix {
  priority: FixPriority;
  label: string;
  detail: string;
}

export interface ScreeningResult {
  verdict: ScreeningVerdict;
  /** 0–100 likelihood a screener advances this resume for this role. */
  score: number;
  knockouts: ScreeningKnockout[];
  missingKeywords: string[];
  fixes: ScreeningFix[];
  summary: string;
  /** ISO timestamp set when persisted onto a posting. */
  screenedAt?: string;
}
