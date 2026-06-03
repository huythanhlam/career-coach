import type { UserProfile } from "@/types/userProfile";

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
    workHistory: (row.work_history as UserProfile["workHistory"]) ?? [],
    education: (row.education as UserProfile["education"]) ?? [],
    skills: (row.skills as string[]) ?? [],
    resumeText: (row.resume_text as string) ?? undefined,
    linkedinText: (row.linkedin_text as string) ?? undefined,
    resumeStoragePath: (row.resume_storage_path as string) ?? undefined,
    linkedinStoragePath: (row.linkedin_storage_path as string) ?? undefined,
    savedResumes: (row.saved_resumes as UserProfile["savedResumes"]) ?? [],
    savedCoverLetters: (row.saved_cover_letters as UserProfile["savedCoverLetters"]) ?? [],
    onboardingComplete: (row.onboarding_complete as boolean) ?? false,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

export function profileToRow(
  profile: UserProfile,
  userId: string
): Record<string, unknown> {
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
    summary: profile.summary ?? null,
    work_history: profile.workHistory,
    education: profile.education,
    skills: profile.skills,
    resume_text: profile.resumeText ?? null,
    linkedin_text: profile.linkedinText ?? null,
    resume_storage_path: profile.resumeStoragePath ?? null,
    linkedin_storage_path: profile.linkedinStoragePath ?? null,
    saved_resumes: profile.savedResumes ?? [],
    saved_cover_letters: (profile.savedCoverLetters ?? []).map(
      ({ id, name, storagePath, jobTitle, company, createdAt }) => ({
        id, name, storagePath, jobTitle, company, createdAt,
      })
    ),
    onboarding_complete: profile.onboardingComplete,
    updated_at: new Date().toISOString(),
  };
}
