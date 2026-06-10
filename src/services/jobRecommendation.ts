import type { UserProfile } from "@/types/userProfile";
import { expandRoleTokens } from "@/lib/roleSynonyms";

// Profile-based job recommendation — a fast, deterministic, zero-cost relevance
// engine. It scores how well a posting fits the user's profile (skills, years of
// experience, target role, and work history) so the unified list can surface the
// most relevant jobs first and badge the strongest matches as "Recommended".
//
// This runs locally on every posting (no API call), so the board can rank dozens
// of results instantly. The AI "Score my fit" in the detail drawer stays as an
// optional, higher-fidelity second opinion.

/** One scored dimension of the fit, with a plain-English explanation. */
export interface FitFactor {
  key: "skills" | "role" | "experience" | "history";
  label: string;
  /** This factor's own match, 0–100. */
  score: number;
  /** How much this factor contributes to the overall score (percentage points). */
  weight: number;
  /** Why this factor scored the way it did — what helped or what's missing. */
  detail: string;
}

export interface FitResult {
  /** 0–100 relevance score (a percentage). */
  score: number;
  /** Short, positive headline reasons (max 3) — used in the compact list row. */
  reasons: string[];
  /** Full per-factor breakdown explaining the score — used in the detail drawer. */
  factors: FitFactor[];
}

/** The minimal posting shape the scorer reads — works for saved postings and raw search results alike. */
export type ScorableJob = {
  title: string;
  company?: string | null;
  description?: string | null;
};

/** Postings scoring at/above this are highlighted as "Recommended". */
export const RECOMMENDED_THRESHOLD = 60;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "of", "a", "an", "to", "in", "on", "at", "or",
  "is", "are", "be", "as", "by", "our", "you", "your", "we", "will", "this",
  "that", "from", "have", "has", "all", "new", "team", "work", "role", "job",
  "jr", "sr", "i", "ii", "iii", "iv",
]);

function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((t) => t.replace(/^[.]+|[.]+$/g, ""))
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

/** Significant role words shared between two titles, ignoring seniority noise. */
const SENIORITY = new Set(["senior", "junior", "lead", "principal", "staff", "intern", "entry", "mid"]);

function roleTokens(text: string): string[] {
  return tokenize(text).filter((t) => !SENIORITY.has(t));
}

function jobText(job: ScorableJob): string {
  return [job.title, job.company ?? "", job.description ?? ""].join("\n");
}

/** Parse the minimum years of experience a posting asks for, if stated. */
function requiredYears(description: string): number | null {
  const m = (description || "").toLowerCase().match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? null : n;
}

function seniorityLevel(title: string): "junior" | "senior" | "neutral" {
  const t = title.toLowerCase();
  if (/\b(intern|junior|entry|graduate|associate|trainee)\b/.test(t)) return "junior";
  if (/\b(senior|sr\.?|lead|principal|staff|head|director|vp|chief)\b/.test(t)) return "senior";
  return "neutral";
}

/**
 * Score a posting against the user's profile. Combines skill overlap, role-title
 * alignment, experience fit, and work-history relevance into a single 0–100 score.
 */
export function scoreJobFit(job: ScorableJob, profile: UserProfile): FitResult {
  const reasons: string[] = [];
  const text = jobText(job);
  const textTokens = tokenSet(text);

  // ── Skills (weight 42) ────────────────────────────────────────────────────
  const skills = (profile.skills ?? []).filter(Boolean);
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const skill of skills) {
    const parts = tokenize(skill);
    if (parts.length === 0) continue;
    // A skill matches if all of its significant words appear in the posting.
    if (parts.every((p) => textTokens.has(p))) matchedSkills.push(skill);
    else missingSkills.push(skill);
  }
  // Normalize against a soft cap so a focused profile can still max out.
  const skillDenom = Math.max(1, Math.min(skills.length, 8));
  const skillScore = Math.min(1, matchedSkills.length / skillDenom);
  let skillDetail: string;
  if (skills.length === 0) {
    skillDetail = "Add skills to your profile so we can match them against postings.";
  } else if (matchedSkills.length === 0) {
    skillDetail = "None of your listed skills appear in this posting.";
  } else {
    skillDetail = `Found ${matchedSkills.length} of your ${skills.length} skills: ${matchedSkills.slice(0, 5).join(", ")}` +
      (matchedSkills.length < skills.length && missingSkills.length
        ? `. Not mentioned: ${missingSkills.slice(0, 3).join(", ")}.`
        : ".");
    reasons.push(
      `Matches ${matchedSkills.length} of your skill${matchedSkills.length === 1 ? "" : "s"}: ` +
        matchedSkills.slice(0, 4).join(", "),
    );
  }

  // ── Role-title alignment (weight 30) ───────────────────────────────────────
  const roleSources = [
    profile.targetRole,
    profile.currentRole,
    ...(profile.targetRoles ?? []).map((r) => r.title),
    ...(profile.workHistory ?? []).map((w) => w.role),
  ].filter(Boolean) as string[];
  const ref = profile.targetRole || profile.currentRole || roleSources[0];
  // Base tokens + synonym-family tokens, so abbreviations and spelled-out titles
  // match each other (e.g. profile "TPM" ↔ job "Technical Program Manager").
  const profileRoleTokens = new Set<string>();
  for (const src of roleSources) {
    for (const t of roleTokens(src)) profileRoleTokens.add(t);
    for (const t of expandRoleTokens(src)) profileRoleTokens.add(t);
  }
  const jobTitleRoleTokens = roleTokens(job.title);
  const titleOverlap = jobTitleRoleTokens.filter((t) => profileRoleTokens.has(t));
  const titleScore = jobTitleRoleTokens.length
    ? Math.min(1, titleOverlap.length / jobTitleRoleTokens.length)
    : 0;
  let roleDetail: string;
  if (roleSources.length === 0) {
    roleDetail = "Set a target role in your profile to improve role matching.";
  } else if (titleScore >= 0.5) {
    roleDetail = `The title closely matches your ${ref} background.`;
    reasons.push(`Aligned with your ${ref} background`);
  } else if (titleScore > 0) {
    roleDetail = `The title partly overlaps your ${ref} background.`;
  } else {
    roleDetail = `The title doesn't match your target role (${ref}).`;
  }

  // ── Experience fit (weight 18) ─────────────────────────────────────────────
  const years = profile.yearsOfExperience;
  const req = requiredYears(job.description ?? "");
  const level = seniorityLevel(job.title);
  let expScore = 0.6; // neutral when nothing to compare
  let expDetail = "No specific experience requirement detected in this posting.";
  if (typeof years === "number") {
    if (req != null) {
      expScore = years >= req ? 1 : Math.max(0.2, years / Math.max(req, 1));
      expDetail = years >= req
        ? `You meet the ${req}+ years required (you have ${years}).`
        : `Asks for ${req}+ years; your profile lists ${years}.`;
    } else if (level === "senior") {
      expScore = years >= 5 ? 1 : years >= 3 ? 0.65 : 0.35;
      expDetail = years >= 5
        ? `Senior-level role; your ${years} years are a strong fit.`
        : `Senior-level role; your ${years} years may be light.`;
    } else if (level === "junior") {
      expScore = years <= 3 ? 1 : years <= 6 ? 0.7 : 0.5;
      expDetail = years <= 3
        ? `Early-career role that fits your ${years} years.`
        : `Early-career role; with ${years} years you may be overqualified.`;
    } else {
      expScore = 0.75;
      expDetail = `No stated requirement; your ${years} years are a reasonable fit.`;
    }
    if (expScore >= 0.85) {
      reasons.push(`Fits your ${years} year${years === 1 ? "" : "s"} of experience`);
    }
  } else {
    expDetail = "Add your years of experience to your profile for a better estimate.";
  }

  // ── Work-history relevance (weight 10) ─────────────────────────────────────
  let historyScore = 0;
  let historyCompany = "";
  for (const w of profile.workHistory ?? []) {
    const wTokens = roleTokens([w.role, w.responsibilities].filter(Boolean).join(" "));
    if (wTokens.length === 0) continue;
    const overlap = wTokens.filter((t) => textTokens.has(t)).length / wTokens.length;
    if (overlap > historyScore) {
      historyScore = overlap;
      historyCompany = w.company;
    }
  }
  historyScore = Math.min(1, historyScore * 1.5); // related work counts generously
  let historyDetail: string;
  if ((profile.workHistory ?? []).length === 0) {
    historyDetail = "Add work history to your profile to factor in past roles.";
  } else if (historyScore >= 0.4 && historyCompany) {
    historyDetail = `Overlaps your past experience${historyCompany ? ` at ${historyCompany}` : ""}.`;
    reasons.push(`Related to your experience at ${historyCompany}`);
  } else {
    historyDetail = "Little overlap with your past roles.";
  }

  const score = Math.round(
    skillScore * 42 + titleScore * 30 + expScore * 18 + historyScore * 10,
  );

  const factors: FitFactor[] = [
    { key: "skills", label: "Skills", score: Math.round(skillScore * 100), weight: 42, detail: skillDetail },
    { key: "role", label: "Role match", score: Math.round(titleScore * 100), weight: 30, detail: roleDetail },
    { key: "experience", label: "Experience", score: Math.round(expScore * 100), weight: 18, detail: expDetail },
    { key: "history", label: "Work history", score: Math.round(historyScore * 100), weight: 10, detail: historyDetail },
  ];

  return { score: Math.min(100, Math.max(0, score)), reasons: reasons.slice(0, 3), factors };
}

/**
 * Whether the profile has enough substance to produce a meaningful fit score.
 * Skills (42%) and role/title (30%) dominate the score, so without any of these
 * signals the number would be noise — we hide it and prompt the user to complete
 * their profile instead.
 */
export function canScoreProfile(profile: UserProfile): boolean {
  return (
    (profile.skills?.length ?? 0) > 0 ||
    (profile.workHistory?.length ?? 0) > 0 ||
    (profile.targetRoles?.length ?? 0) > 0 ||
    !!profile.targetRole ||
    !!profile.currentRole
  );
}

/** A short qualitative label for a fit score. */
export function fitLabel(score: number): string {
  if (score >= RECOMMENDED_THRESHOLD) return "Recommended";
  if (score >= 40) return "Good match";
  return "Possible match";
}

/**
 * Derive a sensible default keyword + location search from the user's profile,
 * so the board auto-populates with relevant jobs on first load — no input needed.
 */
export function buildDefaultQuery(profile: UserProfile): { keyword: string; location: string } {
  const keyword =
    profile.targetRole ||
    (profile.targetRoles ?? [])[0]?.title ||
    profile.currentRole ||
    (profile.workHistory ?? [])[0]?.role ||
    "";
  const location =
    (profile.targetRoles ?? []).find((r) => r.location)?.location || "";
  return { keyword: keyword.trim(), location: location.trim() };
}
