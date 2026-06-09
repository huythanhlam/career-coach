export interface DbSavedResume {
  id: string;
  name: string;
  storagePath: string;
  createdAt: string;
}

export interface DbSavedCareerPlan {
  id: string;
  name: string;
  storagePath: string;
  goalType: string;
  goalSummary: string;
  createdAt: string;
}

export interface DbCareerSurvey {
  currentRole?: string;
  company?: string;
  yearsExperience?: string;
  jobSatisfaction?: number | string;
  growthOpportunity?: number | string;
  compensationSatisfaction?: number | string;
  workLifeBalance?: number | string;
  recognition?: number | string;
  mobility?: string;
  managerSupport?: string;
  energizers?: string;
  frustrations?: string;
  recentWins?: string;
  skillsToGrow?: string;
  biggestBlocker?: string;
  updatedAt?: string;
}

export interface DbTargetRole {
  id: string;
  title: string;
  keywords?: string[];
  location?: string;
  seniority?: string;
  remote?: boolean;
}

export interface DbTargetCompany {
  id: string;
  name: string;
  ats: "greenhouse" | "lever" | "ashby";
  boardToken: string;
}

export interface DbJobPosting {
  id: string;
  user_id: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string | null;
  url: string | null;
  source: "ats" | "web" | "manual";
  external_id: string | null;
  employment_type: string | null;
  remote: boolean | null;
  target_role_id: string | null;
  target_company_id: string | null;
  match_score: number | null;
  status: string;
  favorite: boolean;
  applied_resume_id: string | null;
  applied_cover_letter_id: string | null;
  notes: string | null;
  applied_at: string | null;
  posting_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

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
  resume_storage_path: string | null;
  linkedin_storage_path: string | null;
  saved_resumes: DbSavedResume[];
  saved_career_plans: DbSavedCareerPlan[];
  target_roles: DbTargetRole[];
  target_companies: DbTargetCompany[];
  career_survey: DbCareerSurvey;
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
