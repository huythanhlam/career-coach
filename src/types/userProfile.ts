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

export interface SavedCoverLetter {
  id: string;
  name: string;
  storagePath: string;
  text?: string; // transient: populated after downloading from Storage, not persisted to DB
  jobTitle: string;
  company: string;
  createdAt: string;
}

export interface SavedCareerPlan {
  id: string;
  name: string;
  storagePath: string;
  goalType: string;
  goalSummary: string;
  createdAt: string;
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
  onboardingComplete: boolean;
  aiConsentGivenAt?: string;
  createdAt: string;
  updatedAt: string;
}

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
    createdAt: now,
    updatedAt: now,
  };
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
