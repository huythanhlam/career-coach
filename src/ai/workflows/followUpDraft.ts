import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { basePersona } from "@/config/workflows";

/**
 * Draft a short follow-up or post-interview thank-you email for a tracked
 * job application. Free-text (no `outputSchema`) — `runWorkflow`/
 * `streamWorkflow` return the email body verbatim.
 */

const SHARED_RULES = `Never invent interviewer names, specific dates, or details not present in the context below — if a specific would help and you don't have it, leave a short [bracketed] placeholder (e.g. [interviewer name]). Return ONLY the email body text — no subject line, no markdown fences, no preamble.`;

const FOLLOW_UP_SYSTEM = `${basePersona}

Now draft a brief, professional follow-up email (roughly 80-150 words) checking in on a job application that has gone quiet. Structure: a short reiteration of genuine interest in the role, one sentence naming a specific differentiator from the candidate's background, and a polite close asking about next steps or timeline. Warm but not desperate — this is a light touch, not a plea. ${SHARED_RULES}`;

const THANK_YOU_SYSTEM = `${basePersona}

Now draft a brief, professional post-interview thank-you email (roughly 80-150 words). Structure: genuine thanks for the interviewer's time, one sentence referencing a specific topic or priority from the job description (you don't have an interview transcript, so reference the role's stated priorities rather than inventing what was "discussed"), and a closing line reaffirming enthusiasm and fit. ${SHARED_RULES}`;

export const followUpDraftWorkflow = defineWorkflow({
  id: "follow_up_draft",
  tier: "FAST",
  inputSchema: z.object({
    kind: z.enum(["follow_up", "thank_you"]),
    jobTitle: z.string(),
    company: z.string(),
    jobDescription: z.string(),
    resumeText: z.string(),
    baseline: z.string(),
  }),
  buildSystem: ({ kind }) => (kind === "thank_you" ? THANK_YOU_SYSTEM : FOLLOW_UP_SYSTEM),
  buildPrompt: ({ jobTitle, company, jobDescription, resumeText, baseline }) =>
    `JOB TITLE: ${jobTitle}
COMPANY: ${company}

JOB DESCRIPTION:
${jobDescription || "(not provided)"}

CANDIDATE RESUME:
${resumeText || "(not provided)"}

${baseline ? `CANDIDATE PROFILE:\n${baseline}\n` : ""}
Write the email per the rules.`,
});
