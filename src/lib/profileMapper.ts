import type { UserProfile } from "@/types/userProfile";
import { normalizeWorkHistory } from "@/lib/workExperience";
import { deriveTargetRoles } from "@/lib/targetRoleDerivation";

export function rowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    fullName: (row.full_name as string) ?? "",
    preferredName: (row.preferred_name as string) ?? "",
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? undefined,
    linkedin: (row.linkedin as string) ?? undefined,
    github: (row.github as string) ?? undefined,
    portfolio: (row.portfolio as string) ?? undefined,
    targetRole: (row.target_role as string) ?? undefined,
    currentRole: (row.current_role as string) ?? undefined,
    yearsOfExperience: (row.years_of_experience as number) ?? undefined,
    summary: (row.summary as string) ?? undefined,
    workHistory: normalizeWorkHistory((row.work_history as UserProfile["workHistory"]) ?? []),
    education: (row.education as UserProfile["education"]) ?? [],
    skills: (row.skills as string[]) ?? [],
    resumeStoragePath: (row.resume_storage_path as string) ?? undefined,
    linkedinStoragePath: (row.linkedin_storage_path as string) ?? undefined,
    savedResumes: (row.saved_resumes as UserProfile["savedResumes"]) ?? [],
    savedCoverLetters: (row.saved_cover_letters as UserProfile["savedCoverLetters"]) ?? [],
    savedCareerPlans: (row.saved_career_plans as UserProfile["savedCareerPlans"]) ?? [],
    targetRoles: (row.target_roles as UserProfile["targetRoles"]) ?? [],
    targetCompanies: (row.target_companies as UserProfile["targetCompanies"]) ?? [],
    careerSurvey: (row.career_survey as UserProfile["careerSurvey"]) ?? {},
    resumeScore: (row.resume_score as number) ?? undefined,
    resumeScoreAt: (row.resume_score_at as string) ?? undefined,
    linkedinScore: (row.linkedin_score as number) ?? undefined,
    linkedinScoreAt: (row.linkedin_score_at as string) ?? undefined,
    onboardingComplete: (row.onboarding_complete as boolean) ?? false,
    aiConsentGivenAt: (row.ai_consent_given_at as string) ?? undefined,
    accountType: (row.account_type as UserProfile["accountType"]) ?? "seeker",
    // Read-only: server-managed, like mfa_enrolled it is intentionally NOT written
    // back in profileToRow (the RLS update policy blocks client changes anyway).
    isAdmin: (row.is_admin as boolean) ?? false,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

export function profileToRow(profile: UserProfile, userId: string): Record<string, unknown> {
  return {
    id: userId,
    full_name: profile.fullName,
    preferred_name: profile.preferredName,
    email: profile.email,
    phone: profile.phone ?? null,
    linkedin: profile.linkedin ?? null,
    github: profile.github ?? null,
    portfolio: profile.portfolio ?? null,
    target_role: profile.targetRole ?? null,
    current_role: profile.currentRole ?? null,
    years_of_experience: profile.yearsOfExperience ?? null,
    summary: profile.summary ?? null,
    work_history: normalizeWorkHistory(profile.workHistory),
    education: profile.education,
    skills: profile.skills,
    resume_storage_path: profile.resumeStoragePath ?? null,
    linkedin_storage_path: profile.linkedinStoragePath ?? null,
    saved_resumes: profile.savedResumes ?? [],
    saved_cover_letters: (profile.savedCoverLetters ?? []).map(
      ({ id, name, storagePath, jobTitle, company, createdAt }) => ({
        id,
        name,
        storagePath,
        jobTitle,
        company,
        createdAt,
      }),
    ),
    saved_career_plans: (profile.savedCareerPlans ?? []).map(
      ({ id, name, storagePath, goalType, goalSummary, createdAt, milestones, lastCheckInAt }) => ({
        id,
        name,
        storagePath,
        goalType,
        goalSummary,
        createdAt,
        ...(milestones?.length ? { milestones } : {}),
        ...(lastCheckInAt ? { lastCheckInAt } : {}),
      }),
    ),
    // Auto-fill target roles from resume/work-history signal when the user
    // hasn't set any yet, so the weekly suggestion cron works out of the box.
    target_roles:
      profile.targetRoles?.length ? profile.targetRoles : deriveTargetRoles(profile),
    target_companies: profile.targetCompanies ?? [],
    career_survey: profile.careerSurvey ?? {},
    resume_score: profile.resumeScore ?? null,
    resume_score_at: profile.resumeScoreAt ?? null,
    linkedin_score: profile.linkedinScore ?? null,
    linkedin_score_at: profile.linkedinScoreAt ?? null,
    onboarding_complete: profile.onboardingComplete,
    ai_consent_given_at: profile.aiConsentGivenAt ?? null,
    account_type: profile.accountType ?? "seeker",
    updated_at: new Date().toISOString(),
  };
}
