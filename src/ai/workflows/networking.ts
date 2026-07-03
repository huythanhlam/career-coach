import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { basePersona } from "@/config/workflows";

/**
 * Networking & Referral Agent workflows.
 *   - outreachTargetsWorkflow: structured (native `responseSchema`) — ranked
 *     role/title personas to reach out to (never real named people).
 *   - outreachMessageWorkflow: free-text — a personalized outreach message.
 * Both are non-grounded; `networkingService` validates the persona enum and
 * strips fences afterward.
 */

const outreachTargetSchema = z.object({
  /** "recruiter" | "hiring_manager" | "team_member" | "alumni" — validated by the caller. */
  personaType: z.string(),
  title: z.string(),
  rationale: z.string(),
  searchQuery: z.string(),
});

export const outreachTargetsSchema = z.object({
  targets: z.array(outreachTargetSchema),
});

export type OutreachTargetsOutput = z.infer<typeof outreachTargetsSchema>;

const TARGETS_SYSTEM = `You are an expert career networking coach. Given a candidate's background and a target company, suggest specific *types of people* (by role/title) the candidate should reach out to to improve their odds — and a search query to find each. You never claim to know real named individuals; you suggest titles/roles and how to find them.`;

export const outreachTargetsWorkflow = defineWorkflow({
  id: "networking_targets",
  tier: "FAST",
  inputSchema: z.object({
    company: z.string(),
    companyIntel: z.string(),
    baseline: z.string(),
    targetRole: z.string(),
  }),
  outputSchema: outreachTargetsSchema,
  buildSystem: () => TARGETS_SYSTEM,
  buildPrompt: ({ company, companyIntel, baseline, targetRole }) =>
    `
The candidate wants to network into a role at ${company}. Suggest 4-6 outreach targets (people-by-role), prioritized by impact, as a "targets" array. Each target has:
- personaType: "recruiter" | "hiring_manager" | "team_member" | "alumni".
- title: the specific role/title to look for, e.g. 'Engineering Manager, Payments' or 'Technical Recruiter'.
- rationale: one sentence — why reaching out to this person helps THIS candidate, referencing their background where relevant.
- searchQuery: a ready-to-paste LinkedIn or Google search to find this person, e.g. '"${company}" recruiter software engineering'.

Rules:
- "alumni" = someone who shares a school, past employer, or background with the candidate (infer ONLY from the candidate's own profile below) — name the overlap in the rationale.
- Tailor titles to the candidate's target role/seniority. Prefer hiring managers and team members on the actual team over generic recruiters when possible.
- Never invent real names — suggest roles/titles and how to find them.
${targetRole ? `\nTarget role: ${targetRole}` : ""}

CANDIDATE PROFILE:
${baseline || "(no profile provided)"}

${companyIntel ? `WHAT WE KNOW ABOUT ${company.toUpperCase()}:\n${companyIntel}` : ""}
`.trim(),
});

const DRAFT_SYSTEM = `${basePersona}

Now you are drafting a single, concise networking outreach message for the candidate to send. Write in the candidate's own first-person voice.

Hard rules:
- Never invent facts: no fabricated shared connections, mutual friends, specific projects, or details the candidate didn't provide. Where a personal specific would strengthen the message but you don't have it, insert a SHORT bracketed placeholder for the user to fill, e.g. "[mention the specific project of theirs you admired]".
- Keep it genuinely personalized to the candidate's real background and the company — not a generic template.
- Respect the channel's norms and length (a LinkedIn connection note must be under 300 characters; a cold email can be a few short paragraphs).
- Return ONLY the message text — no preamble, no subject-line label unless it's a cold email (then start with "Subject: ..."), no quotes, no markdown fences.`;

export const outreachMessageWorkflow = defineWorkflow({
  id: "networking_message",
  tier: "QUALITY",
  inputSchema: z.object({
    channel: z.string(),
    tone: z.string(),
    recipient: z.string(),
    baseline: z.string(),
    companyIntel: z.string(),
  }),
  buildSystem: () => DRAFT_SYSTEM,
  buildPrompt: ({ channel, tone, recipient, baseline, companyIntel }) =>
    `
Channel: ${channel}
Tone: ${tone}
Recipient: ${recipient}

Write the outreach message per the rules.

CANDIDATE PROFILE:
${baseline || "(no profile provided)"}

${companyIntel}
`.trim(),
});
