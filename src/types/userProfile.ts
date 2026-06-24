export interface WorkExperience {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  responsibilities: string;
  current?: boolean;
}

export interface Education {
  id: string;
  university: string;
  degree: string;
  graduationYear: string;
  major?: string;
  minor?: string;
}

import type { TargetRole, TargetCompany } from "@/types/jobPosting";

export interface SavedCoverLetter {
  id: string;
  name: string;
  storagePath: string;
  text?: string; // transient: populated after downloading from Storage, not persisted to DB
  jobTitle: string;
  company: string;
  createdAt: string;
}

/** One time-boxed checkpoint extracted from a plan's Milestones section. */
export interface PlanMilestone {
  id: string;
  title: string;
  /** Optional time-box as written in the plan, e.g. "Month 3" or "by mid-July". */
  timeframe?: string;
  done: boolean;
  completedAt?: string;
}

export interface SavedCareerPlan {
  id: string;
  name: string;
  storagePath: string;
  goalType: string;
  goalSummary: string;
  createdAt: string;
  /** Structured milestones with completion state — lives here (not just in the
   * storage payload) so the Dashboard can show progress without a download. */
  milestones?: PlanMilestone[];
  /** Last time the user checked in with the coach about this plan. */
  lastCheckInAt?: string;
}

/** Sentinel value letting the user explicitly answer "Unsure" on any question. */
export const UNSURE = "Unsure";

/** A 1–5 rating, or "Unsure". */
export type ScaleAnswer = number | typeof UNSURE;

/** Snapshot of the user's present job situation, used to ground goal planning. */
export interface CareerSurvey {
  // Baseline identity — captured here when the user doesn't fill out the full
  // profile. Mirrors profile.currentRole / current company / yearsOfExperience.
  currentRole?: string;
  company?: string;
  yearsExperience?: string;
  // 1–5 scales (or "Unsure")
  jobSatisfaction?: ScaleAnswer;
  growthOpportunity?: ScaleAnswer;
  compensationSatisfaction?: ScaleAnswer;
  workLifeBalance?: ScaleAnswer;
  recognition?: ScaleAnswer;
  // single-select (includes "Unsure")
  mobility?: string;        // "Staying & growing" | "Open to the right move" | "Actively looking" | "Unsure"
  managerSupport?: string;  // "Very supportive" | "Somewhat" | "Not really" | "No manager" | "Unsure"
  // free text (or "Unsure")
  energizers?: string;
  frustrations?: string;
  recentWins?: string;
  skillsToGrow?: string;
  biggestBlocker?: string;
  updatedAt?: string;
}

export interface UserProfile {
  fullName: string;
  preferredName: string;
  email: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  targetRole?: string;
  /** Multiple structured target roles, used by the Targeted Job Postings feature. */
  targetRoles?: TargetRole[];
  /** Companies whose public ATS feeds are scanned for postings. */
  targetCompanies?: TargetCompany[];
  currentRole?: string;
  yearsOfExperience?: number;
  summary?: string;
  workHistory: WorkExperience[];
  education: Education[];
  skills: string[];
  resumeText?: string;
  linkedinText?: string;
  resumeStoragePath?: string;
  linkedinStoragePath?: string;
  savedResumes?: { id: string; name: string; storagePath: string; text?: string; createdAt: string }[];
  savedCoverLetters?: SavedCoverLetter[];
  savedCareerPlans?: SavedCareerPlan[];
  careerSurvey?: CareerSurvey;
  /** Latest Resume Analyzer score (0–100); undefined until the user runs an analysis. */
  resumeScore?: number;
  resumeScoreAt?: string;
  /** Latest LinkedIn Optimization score (0–100); undefined until the user runs an analysis. */
  linkedinScore?: number;
  linkedinScoreAt?: string;
  onboardingComplete: boolean;
  aiConsentGivenAt?: string;
  /** Which side of the product this account uses. Defaults to 'seeker'. */
  accountType?: AccountType;
  /** Server-managed admin flag (read-only on the client). Gates the Blog Admin view. */
  isAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AccountType = "seeker" | "employer";

export function createEmptyProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    fullName: "",
    preferredName: "",
    email: "",
    workHistory: [],
    education: [],
    skills: [],
    onboardingComplete: false,
    accountType: "seeker",
    createdAt: now,
    updatedAt: now,
  };
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
