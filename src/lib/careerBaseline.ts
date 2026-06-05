import type { UserProfile, CareerSurvey, WorkExperience } from "@/types/userProfile";
import { generateId } from "@/types/userProfile";
import { endDateLabel } from "@/lib/workExperience";

/**
 * Synthesize the user's profile into a prompt-ready baseline string. This is the
 * "golden source" the career-planning coach grounds every recommendation in.
 */
export function buildProfileBaseline(profile: UserProfile): string {
  const lines: string[] = [];

  const name = profile.preferredName || profile.fullName;
  if (name) lines.push(`Name: ${name}`);
  if (profile.currentRole) lines.push(`Current Role: ${profile.currentRole}`);
  if (profile.targetRole) lines.push(`Stated Target Role: ${profile.targetRole}`);
  if (profile.yearsOfExperience != null)
    lines.push(`Years of Experience: ${profile.yearsOfExperience}`);
  if (profile.summary?.trim()) lines.push(`Summary: ${profile.summary.trim()}`);

  if (profile.skills?.length) {
    lines.push(`\nSkills: ${profile.skills.join(", ")}`);
  }

  if (profile.workHistory?.length) {
    lines.push("\nWork History:");
    profile.workHistory.forEach((w) => {
      const dates = [w.startDate, endDateLabel(w)]
        .filter(Boolean)
        .join(" – ");
      lines.push(`- ${w.role}${w.company ? ` at ${w.company}` : ""}${dates ? ` (${dates})` : ""}`);
      if (w.responsibilities?.trim()) {
        lines.push(`  Achievements/Responsibilities: ${w.responsibilities.trim()}`);
      }
    });
  }

  if (profile.education?.length) {
    lines.push("\nEducation:");
    profile.education.forEach((e) => {
      const degree = [e.degree, e.major].filter(Boolean).join(", ");
      lines.push(
        `- ${degree || "Studies"}${e.university ? ` at ${e.university}` : ""}${e.graduationYear ? ` (${e.graduationYear})` : ""}`
      );
    });
  }

  return lines.join("\n").trim();
}

const SCALE_LABEL: Record<number, string> = {
  1: "very low", 2: "low", 3: "moderate", 4: "high", 5: "very high",
};

/** Has the user filled in any part of the current-state survey? */
export function isSurveyStarted(survey?: CareerSurvey): boolean {
  if (!survey) return false;
  return Object.entries(survey).some(
    ([k, v]) => k !== "updatedAt" && v != null && String(v).trim() !== ""
  );
}

/** Enough of the survey filled to meaningfully inform a plan. */
export function isSurveyComplete(survey?: CareerSurvey): boolean {
  if (!survey) return false;
  return survey.jobSatisfaction != null && Boolean(survey.mobility);
}

/**
 * Turn the current-state survey into a prompt-ready snapshot. Only includes
 * fields the user actually answered.
 */
export function buildSurveySummary(survey?: CareerSurvey): string {
  if (!survey) return "";
  const lines: string[] = [];
  const scale = (label: string, v?: number | string) => {
    if (v == null) return;
    if (typeof v === "number") lines.push(`${label}: ${v}/5 (${SCALE_LABEL[v] ?? ""})`.trim());
    else lines.push(`${label}: ${v.toLowerCase()}`); // e.g. "unsure"
  };
  const text = (label: string, v?: string) => {
    if (v?.trim()) lines.push(`${label}: ${v.trim()}`);
  };

  text("Current role / title", survey.currentRole);
  text("Company", survey.company);
  text("Years of experience", survey.yearsExperience);
  text("Mobility / intent", survey.mobility);
  text("Manager support", survey.managerSupport);
  scale("Job satisfaction", survey.jobSatisfaction);
  scale("Growth opportunity", survey.growthOpportunity);
  scale("Compensation satisfaction", survey.compensationSatisfaction);
  scale("Work-life balance", survey.workLifeBalance);
  scale("Recognition", survey.recognition);
  text("What energizes them", survey.energizers);
  text("What frustrates/drains them", survey.frustrations);
  text("Recent wins (6–12 months)", survey.recentWins);
  text("Skills they want to use/grow", survey.skillsToGrow);
  text("Biggest blocker to next step", survey.biggestBlocker);

  return lines.join("\n").trim();
}

/* ───────────────────────── Baseline identity ─────────────────────────
 * The minimum "who/where are you today" needed to ground a plan: current
 * role/title, current company, and years of experience. This can come from the
 * full profile OR be captured directly in the survey when the user skips the
 * profile. */

export type IdentityKey = "currentRole" | "company" | "yearsExperience";

export interface BaselineIdentity {
  currentRole: string;
  company: string;
  yearsExperience: string;
}

/** The current (or most-recent) job from the work history — the entry flagged
 * `current`, else the first one. */
function currentJob(profile: UserProfile): WorkExperience | undefined {
  const wh = profile.workHistory ?? [];
  return wh.find((w) => w.current) ?? wh[0];
}

/** Current role: the explicit top-level field, else the current job's title.
 * Filling out work history (the natural way to "update your profile") is enough
 * to establish a role, so it counts as a baseline. */
function currentRoleOf(profile: UserProfile): string {
  return profile.currentRole?.trim() || currentJob(profile)?.role?.trim() || "";
}

/** Derive the baseline identity already stored in the profile. */
export function getProfileIdentity(profile: UserProfile): BaselineIdentity {
  return {
    currentRole: currentRoleOf(profile),
    company: currentJob(profile)?.company?.trim() ?? "",
    yearsExperience:
      profile.yearsOfExperience != null ? String(profile.yearsOfExperience) : "",
  };
}

/** The profile alone establishes who/where the user is today — via the explicit
 * current-role field OR a role captured in work history. */
export function hasProfileBaseline(profile: UserProfile): boolean {
  return Boolean(currentRoleOf(profile));
}

/** Profile OR survey provides at least a current role — enough to plan against. */
export function hasBaselineIdentity(
  profile: UserProfile,
  survey?: CareerSurvey
): boolean {
  return hasProfileBaseline(profile) || Boolean(survey?.currentRole?.trim());
}

export interface IdentitySyncField {
  key: IdentityKey;
  label: string;
  surveyValue: string;
  profileValue: string;
  /** new = profile empty (auto-push); conflict = differs (ask); same = no-op. */
  status: "new" | "conflict" | "same";
}

const IDENTITY_LABELS: Record<IdentityKey, string> = {
  currentRole: "Current role / title",
  company: "Company",
  yearsExperience: "Years of experience",
};

/**
 * Compare the survey's baseline answers to the profile, for fields the user
 * actually filled in. Drives the "save to profile / overwrite?" flow.
 */
export function diffIdentityForSync(
  profile: UserProfile,
  survey?: CareerSurvey
): IdentitySyncField[] {
  if (!survey) return [];
  const id = getProfileIdentity(profile);
  const surveyVals: Record<IdentityKey, string> = {
    currentRole: survey.currentRole?.trim() ?? "",
    company: survey.company?.trim() ?? "",
    yearsExperience: survey.yearsExperience?.trim() ?? "",
  };

  return (Object.keys(surveyVals) as IdentityKey[])
    .map((key) => {
      const surveyValue = surveyVals[key];
      const profileValue = id[key];
      const status: IdentitySyncField["status"] = !profileValue
        ? "new"
        : profileValue.toLowerCase() === surveyValue.toLowerCase()
          ? "same"
          : "conflict";
      return { key, label: IDENTITY_LABELS[key], surveyValue, profileValue, status };
    })
    .filter((f) => f.surveyValue); // only fields the user answered
}

/** Upsert the current company onto the work history (immutably). */
function upsertCurrentCompany(
  profile: UserProfile,
  company: string,
  role: string
): WorkExperience[] {
  const wh = (profile.workHistory ?? []).map((w) => ({ ...w }));
  const idx = wh.findIndex((w) => w.current);
  const target = idx >= 0 ? idx : wh.length ? 0 : -1;
  if (target >= 0) {
    wh[target].company = company;
    if (!wh[target].role?.trim() && role) wh[target].role = role;
    return wh;
  }
  return [
    {
      id: generateId(),
      company,
      role: role || "",
      startDate: "",
      endDate: "",
      responsibilities: "",
      current: true,
    },
    ...wh,
  ];
}

/**
 * Build a profile patch from the survey's baseline answers, applying only the
 * given keys. `company` is written into the current work-history entry.
 */
export function buildIdentityPatch(
  profile: UserProfile,
  survey: CareerSurvey,
  keys: Iterable<IdentityKey>
): Partial<UserProfile> {
  const set = new Set(keys);
  const patch: Partial<UserProfile> = {};

  if (set.has("currentRole") && survey.currentRole?.trim()) {
    patch.currentRole = survey.currentRole.trim();
  }
  if (set.has("yearsExperience") && survey.yearsExperience?.trim()) {
    const n = parseFloat(survey.yearsExperience);
    if (!Number.isNaN(n)) patch.yearsOfExperience = n;
  }
  if (set.has("company") && survey.company?.trim()) {
    patch.workHistory = upsertCurrentCompany(
      profile,
      survey.company.trim(),
      (patch.currentRole ?? survey.currentRole ?? "").trim()
    );
  }
  return patch;
}

/**
 * True when the profile is too sparse to produce a well-grounded plan — drives
 * the soft "complete your profile" prompt (never blocks generation).
 */
export function isProfileThin(profile: UserProfile): boolean {
  const hasRole = Boolean(profile.currentRole?.trim());
  const hasSkills = (profile.skills?.length ?? 0) >= 3;
  const hasHistory = (profile.workHistory?.length ?? 0) >= 1;
  // Considered thin unless at least two of the three baseline signals are present.
  const signals = [hasRole, hasSkills, hasHistory].filter(Boolean).length;
  return signals < 2;
}
