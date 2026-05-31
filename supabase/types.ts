export interface DbProfile {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
  target_role: string | null;
  current_role: string | null;
  summary: string | null;
  skills: string[];
  work_history: DbWorkExperience[];
  education: DbEducation[];
  resume_text: string | null;
  linkedin_text: string | null;
  onboarding_complete: boolean;
  mfa_enrolled: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbWorkExperience {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  responsibilities: string;
  current?: boolean;
}

export interface DbEducation {
  id: string;
  university: string;
  degree: string;
  graduationYear: string;
}

export type DbProfileUpdate = Partial<
  Omit<DbProfile, "id" | "created_at" | "updated_at" | "mfa_enrolled">
>;
