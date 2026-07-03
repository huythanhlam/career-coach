// Networking & Referral Agent service.
//
// Two AI calls, both grounded in the user's own profile baseline + (optional)
// deterministic company intel:
//   1. suggestOutreachTargets — ranked role/title personas to reach out to.
//   2. draftOutreachMessage    — a personalized, honest outreach message.
//
// IMPORTANT: personas are *role/title suggestions + search queries*, never
// scraped real people. Drafts never invent shared connections or facts — the
// model inserts [bracketed] placeholders for anything only the user knows.

import { runWorkflow } from "@/ai/client";
import { outreachTargetsWorkflow, outreachMessageWorkflow } from "@/ai/workflows/networking";
import { buildProfileBaseline } from "@/lib/careerBaseline";
import type { UserProfile } from "@/types/userProfile";
import type { OutreachTarget, PersonaType, OutreachType, OutreachTone } from "@/types/outreach";
import { OUTREACH_LABELS, TONE_LABELS } from "@/types/outreach";

const PERSONAS: readonly PersonaType[] = ["recruiter", "hiring_manager", "team_member", "alumni"];

export async function suggestOutreachTargets(input: {
  company: string;
  companyIntel?: string;
  profile: UserProfile;
}): Promise<OutreachTarget[]> {
  const baseline = buildProfileBaseline(input.profile);
  const targetRole = input.profile.targetRole?.trim() ?? "";
  const result = await runWorkflow(outreachTargetsWorkflow, {
    company: input.company,
    companyIntel: input.companyIntel ?? "",
    baseline,
    targetRole,
  });
  if (result.status !== "ok") {
    console.error("Failed to generate outreach targets:", result.error);
    return [];
  }

  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  return result.data.targets
    .map((t) => ({
      personaType: PERSONAS.includes(t.personaType as PersonaType)
        ? (t.personaType as PersonaType)
        : "team_member",
      title: str(t.title),
      rationale: str(t.rationale),
      searchQuery: str(t.searchQuery),
    }))
    .filter((t) => t.title)
    .slice(0, 6);
}

export async function draftOutreachMessage(input: {
  company: string;
  companyIntel?: string;
  profile: UserProfile;
  personaType: PersonaType;
  contactTitle: string;
  outreachType: OutreachType;
  tone: OutreachTone;
}): Promise<string> {
  const baseline = buildProfileBaseline(input.profile);
  const result = await runWorkflow(outreachMessageWorkflow, {
    channel: OUTREACH_LABELS[input.outreachType],
    tone: TONE_LABELS[input.tone],
    recipient: `a ${input.contactTitle || input.personaType} at ${input.company}`,
    baseline,
    companyIntel: input.companyIntel
      ? `ABOUT ${input.company.toUpperCase()}:\n${input.companyIntel}`
      : "",
  });
  if (result.status !== "ok") throw new Error(result.error);
  return result.data
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
