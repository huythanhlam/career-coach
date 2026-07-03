// Application Autopilot orchestration.
//
// Client-side (matches every existing AI flow): for each posting, deterministically
// score fit, generate tailoring suggestions and apply them to the base resume,
// and draft a cover letter — producing a review-and-approve package. NOTHING is
// submitted here; approval/submission is a separate, explicit user action.

import { tailorResume, type TailorSuggestion } from "@/services/geminiService";
import { runWorkflow } from "@/ai/client";
import { coverLetterWorkflow } from "@/ai/workflows/coverLetter";
import { scoreJobFit } from "@/services/jobRecommendation";
import { buildProfileBaseline } from "@/lib/careerBaseline";
import type { UserProfile } from "@/types/userProfile";
import type { JobPosting } from "@/types/jobPosting";

export interface GeneratedPackage {
  fitScore: number;
  tailoredResumeText: string;
  coverLetterText: string;
}

/**
 * Apply tailoring suggestions to the resume text by exact substring replacement
 * (originalText → suggestedText). Same locate-then-replace contract the
 * TailorResumeWorkspace relies on; suggestions whose originalText isn't found
 * are skipped (no hallucinated edits).
 */
export function applyTailorSuggestions(
  resumeText: string,
  suggestions: TailorSuggestion[],
): string {
  let out = resumeText;
  for (const s of suggestions) {
    if (!s.originalText || !s.suggestedText) continue;
    if (out.includes(s.originalText)) {
      out = out.replace(s.originalText, s.suggestedText);
    }
  }
  return out;
}

async function draftCoverLetter(
  posting: JobPosting,
  resumeText: string,
  baseline: string,
): Promise<string> {
  const result = await runWorkflow(coverLetterWorkflow, {
    jobTitle: posting.title,
    company: posting.company ?? "",
    jobDescription: posting.description ?? "",
    resumeText,
    baseline,
  });
  if (result.status !== "ok") throw new Error(result.error);
  return result.data
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Build a full application package for one posting. Fit scoring is deterministic
 * and free; tailoring + cover letter each make one gateway call.
 */
export async function generatePackage(
  posting: JobPosting,
  profile: UserProfile,
  baseResumeText: string,
): Promise<GeneratedPackage> {
  const fit = scoreJobFit(
    { title: posting.title, company: posting.company, description: posting.description },
    profile,
  );
  const baseline = buildProfileBaseline(profile);
  const jd = posting.description ?? "";

  let tailoredResumeText = baseResumeText;
  if (jd.trim()) {
    const suggestions = await tailorResume(baseResumeText, jd, {
      jobTitle: posting.title,
      companyName: posting.company ?? undefined,
    });
    tailoredResumeText = applyTailorSuggestions(baseResumeText, suggestions);
  }

  const coverLetterText = await draftCoverLetter(posting, tailoredResumeText, baseline);

  return { fitScore: fit.score, tailoredResumeText, coverLetterText };
}
