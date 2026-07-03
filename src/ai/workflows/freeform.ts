import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";

/**
 * Free-text workflows: no `outputSchema`, so `runWorkflow` returns the model's
 * text verbatim. Callers do any light post-processing (fence stripping, etc.).
 */

// ─── Rewrite a selected resume passage ──────────────────────────────────────

const REWRITE_SYSTEM = `You are an elite resume writer. The user has selected a specific passage from their resume and wants it improved.
Return ONLY the rewritten text — no explanation, no preamble, no quotes. Preserve the original's markdown structure (any leading bullet marker like "- ", heading level, bold, etc.) so it drops in cleanly, and keep it close to the original length (within roughly ±15%). Improve wording, impact, and clarity, but never invent achievements, metrics, employers, titles, or dates that aren't in the original or clearly supported by the resume context — if a metric would help, leave a placeholder like "[X%]" for the user to fill in.`;

export const rewriteSelectionWorkflow = defineWorkflow({
  id: "resume_rewrite_selection",
  tier: "FAST",
  inputSchema: z.object({
    selectedText: z.string(),
    instruction: z.string(),
    fullResumeText: z.string(),
  }),
  buildSystem: () => REWRITE_SYSTEM,
  buildPrompt: ({ selectedText, instruction, fullResumeText }) =>
    `Full resume context:\n${fullResumeText}\n\n---\nSelected text to rewrite:\n${selectedText}\n\nInstruction: ${instruction}`,
});

// ─── Suggest work-experience bullet points ──────────────────────────────────

const BULLETS_SYSTEM = `You are an expert resume writer. Generate 3-5 high-impact bullet points for the given role, tailored to its field, using strong action verbs and the XYZ pattern (accomplished X, measured by Y, by doing Z). Do NOT invent specific numbers, metrics, employers, or facts the user hasn't provided — where a metric would strengthen a bullet, insert a clear placeholder like "[X%]" or "[$ amount]" for the user to fill in. Return only the bullet points.`;

export const workBulletsWorkflow = defineWorkflow({
  id: "resume_work_bullets",
  tier: "FAST",
  inputSchema: z.object({
    role: z.string(),
    company: z.string(),
    currentBullets: z.string(),
  }),
  buildSystem: () => BULLETS_SYSTEM,
  buildPrompt: ({ role, company, currentBullets }) =>
    `Role: ${role}\nCompany: ${company}\nCurrent content: ${currentBullets}\n\nGenerate improved bullet points using the XYZ pattern. Use placeholders like [X%] for any metric you don't have.`,
});

// ─── Improve a free-text survey answer (refine | suggest) ────────────────────

const REFINE_SYSTEM = `You are an editor polishing a short career self-assessment answer. Improve HOW it is written without changing WHAT it says.

You MAY:
- Fix grammar, spelling, and punctuation.
- Improve sentence structure and flow.
- Improve clarity — rephrase awkward or vague wording into plain, precise language (same meaning).
- Make it more concise — cut filler, redundancy, and rambling.
- Strengthen tone — confident and professional, while staying authentic and first person.
- Prefer active voice and stronger, more precise verbs (e.g. "was responsible for managing" → "managed").
- Remove hedging and filler words ("kind of", "I guess", "just", "really").
- Keep tense and point of view consistent.

You MUST NOT:
- Add new ideas, facts, examples, skills, metrics, or details that aren't already in the draft.
- Complete or expand unfinished thoughts, or answer parts the user left blank — that is the separate "Suggest" tool's job.

Return ONLY the edited text — no preamble, no quotes, no markdown.`;

const SUGGEST_SYSTEM = `You help a professional complete and round out a short answer to a career self-assessment question.
Review their draft and produce an improved, fuller version that builds on what they wrote — completing unfinished thoughts and making it clearer and more specific so it's useful for career planning.
RULES:
- Build on the user's actual content; keep their voice, stay first person, keep it concise (1–5 sentences).
- Do NOT invent concrete facts the user didn't provide (specific companies, metrics, named skills). Where a specific detail would strengthen the answer but you don't know it, insert a short bracketed placeholder for the user to fill in, e.g. "[name the specific skill — e.g. mobile dev, UX, or back-end]".
- Return ONLY the suggested text — no preamble, no quotes, no markdown.`;

export const surveyAnswerWorkflow = defineWorkflow({
  id: "survey_answer",
  tier: "FAST",
  inputSchema: z.object({
    question: z.string(),
    answer: z.string(),
    mode: z.enum(["refine", "suggest"]),
  }),
  buildSystem: ({ mode }) => (mode === "refine" ? REFINE_SYSTEM : SUGGEST_SYSTEM),
  buildPrompt: ({ question, answer, mode }) => {
    const verb = mode === "refine" ? "Correct" : "Improve and complete";
    return `Question: ${question}\n\nMy draft answer:\n${answer}\n\n${verb} my answer per the rules.`;
  },
});
