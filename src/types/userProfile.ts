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
  savedResumes?: { id: string; name: string; text: string; createdAt: string }[];
  onboardingComplete: boolean;
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
