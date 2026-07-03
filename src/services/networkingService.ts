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

import { generateWorkflowData } from "@/services/geminiService";
import { MODELS } from "@/config/models";
import { parseJsonArray } from "@/lib/looseJson";
import { buildProfileBaseline } from "@/lib/careerBaseline";
import { basePersona } from "@/config/workflows";
import type { UserProfile } from "@/types/userProfile";
import type { OutreachTarget, PersonaType, OutreachType, OutreachTone } from "@/types/outreach";
import { OUTREACH_LABELS, TONE_LABELS } from "@/types/outreach";

const PERSONAS: readonly PersonaType[] = ["recruiter", "hiring_manager", "team_member", "alumni"];

const TARGETS_SYSTEM = `You are an expert career networking coach. Given a candidate's background and a target company, suggest specific *types of people* (by role/title) the candidate should reach out to to improve their odds — and a search query to find each. You never claim to know real named individuals; you suggest titles/roles and how to find them. Output only the requested JSON array: no prose, no code fences; begin with "[" and end with "]".`;

const buildTargetsPrompt = (
  company: string,
  companyIntel: string,
  baseline: string,
  targetRole: string,
): string =>
  `
The candidate wants to network into a role at ${company}. Suggest 4-6 outreach targets (people-by-role), prioritized by impact.

Return ONLY a JSON array with this exact shape:
[
  {
    "personaType": "recruiter" | "hiring_manager" | "team_member" | "alumni",
    "title": "<the specific role/title to look for, e.g. 'Engineering Manager, Payments' or 'Technical Recruiter'>",
    "rationale": "<one sentence: why reaching out to this person helps THIS candidate, referencing their background where relevant>",
    "searchQuery": "<a ready-to-paste LinkedIn or Google search to find this person, e.g. '\"${company}\" recruiter software engineering'>"
  }
]

Rules:
- "alumni" = someone who shares a school, past employer, or background with the candidate (infer ONLY from the candidate's own profile below) — name the overlap in the rationale.
- Tailor titles to the candidate's target role/seniority. Prefer hiring managers and team members on the actual team over generic recruiters when possible.
- Never invent real names — suggest roles/titles and how to find them.
${targetRole ? `\nTarget role: ${targetRole}` : ""}

CANDIDATE PROFILE:
${baseline || "(no profile provided)"}

${companyIntel ? `WHAT WE KNOW ABOUT ${company.toUpperCase()}:\n${companyIntel}` : ""}
`.trim();

export async function suggestOutreachTargets(input: {
  company: string;
  companyIntel?: string;
  profile: UserProfile;
}): Promise<OutreachTarget[]> {
  const baseline = buildProfileBaseline(input.profile);
  const targetRole = input.profile.targetRole?.trim() ?? "";
  const prompt = buildTargetsPrompt(input.company, input.companyIntel ?? "", baseline, targetRole);
  const raw = await generateWorkflowData(TARGETS_SYSTEM, prompt, MODELS.FAST);

  let parsed: Array<Record<string, unknown>>;
  try {
    parsed = parseJsonArray(raw);
  } catch {
    console.error("Failed to parse outreach targets. Raw preview:", raw.slice(0, 400));
    return [];
  }

  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  return parsed
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
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

const DRAFT_SYSTEM = `${basePersona}

Now you are drafting a single, concise networking outreach message for the candidate to send. Write in the candidate's own first-person voice.

Hard rules:
- Never invent facts: no fabricated shared connections, mutual friends, specific projects, or details the candidate didn't provide. Where a personal specific would strengthen the message but you don't have it, insert a SHORT bracketed placeholder for the user to fill, e.g. "[mention the specific project of theirs you admired]".
- Keep it genuinely personalized to the candidate's real background and the company — not a generic template.
- Respect the channel's norms and length (a LinkedIn connection note must be under 300 characters; a cold email can be a few short paragraphs).
- Return ONLY the message text — no preamble, no subject-line label unless it's a cold email (then start with "Subject: ..."), no quotes, no markdown fences.`;

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
  const prompt = `
Channel: ${OUTREACH_LABELS[input.outreachType]}
Tone: ${TONE_LABELS[input.tone]}
Recipient: a ${input.contactTitle || input.personaType} at ${input.company}

Write the outreach message per the rules.

CANDIDATE PROFILE:
${baseline || "(no profile provided)"}

${input.companyIntel ? `ABOUT ${input.company.toUpperCase()}:\n${input.companyIntel}` : ""}
`.trim();

  const raw = await generateWorkflowData(DRAFT_SYSTEM, prompt, MODELS.QUALITY);
  return raw
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
