import { supabase } from "./supabaseClient";

const PROFILE_KEY = "careerCoach_userProfile";
const ANALYSES_KEY = "tc_saved_analyses";
const MIGRATION_FLAG = "supabase_migration_done";

export async function migrateFromLocalStorage(userId: string): Promise<void> {
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  try {
    const rawProfile = localStorage.getItem(PROFILE_KEY);
    if (rawProfile) {
      const profile = JSON.parse(rawProfile);
      const { data: existing } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .single();

      if (existing && !existing.name) {
        await supabase.from("profiles").upsert({
          id: userId,
          name: profile.name ?? "",
          email: profile.email ?? "",
          phone: profile.phone ?? null,
          linkedin: profile.linkedin ?? null,
          github: profile.github ?? null,
          portfolio: profile.portfolio ?? null,
          target_role: profile.targetRole ?? null,
          current_job_role: profile.currentRole ?? null,
          years_of_experience: profile.yearsOfExperience ?? null,
          summary: profile.summary ?? null,
          work_history: profile.workHistory ?? [],
          education: profile.education ?? [],
          skills: profile.skills ?? [],
          resume_text: profile.resumeText ?? null,
          linkedin_text: profile.linkedinText ?? null,
          onboarding_complete: profile.onboardingComplete ?? false,
        });
      }
    }

    const rawAnalyses = localStorage.getItem(ANALYSES_KEY);
    if (rawAnalyses) {
      const analyses = JSON.parse(rawAnalyses) as any[];
      for (const item of analyses) {
        await supabase.from("saved_analyses").insert({
          user_id: userId,
          job_input: item.jobInput ?? "",
          yoe: item.yoe ?? null,
          level: item.level ?? null,
          market_data: item.marketData ?? null,
          company_intel: item.companyIntel ?? null,
          resume_fit: item.resumeFit ?? null,
          interview_strategy: item.interviewStrategy ?? null,
          resume_file_name: item.resumeData?.name ?? null,
        });
      }
    }
  } catch (err) {
    console.error("localStorage migration error:", err);
  } finally {
    localStorage.setItem(MIGRATION_FLAG, "true");
  }
}
