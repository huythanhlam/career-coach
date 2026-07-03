import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";

/**
 * Score a finished mock-interview transcript against a fixed rubric.
 * Non-grounded; native `responseSchema` replaces the truncation-prone
 * `parseLooseJsonObject` path. Schemas are permissive (unbounded numbers, loose
 * enums) so a single odd field never fails the whole parse — the caller clamps
 * and derives quality afterward.
 */

const starSchema = z.object({
  situation: z.string().nullable(),
  task: z.string().nullable(),
  action: z.string().nullable(),
  result: z.string().nullable(),
});

const questionFeedbackSchema = z.object({
  question: z.string(),
  answerSummary: z.string(),
  star: starSchema,
  missing: z.array(z.string()),
  score: z.number(),
  quality: z.string(),
  feedback: z.string(),
});

export const interviewEvaluationSchema = z.object({
  scores: z.object({
    communication: z.number(),
    structure: z.number(),
    depth: z.number(),
  }),
  overall: z.number(),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  questionFeedback: z.array(questionFeedbackSchema),
});

export type InterviewEvaluationOutput = z.infer<typeof interviewEvaluationSchema>;

const inputSchema = z.object({
  interviewKind: z.string(),
  role: z.string(),
  transcript: z.string(),
});

const SYSTEM = `You are a rigorous behavioral-interview assessor. Given a mock-interview transcript, evaluate THE CANDIDATE's answers (the "User" turns) — never the interviewer.
Overall rubric (score each 0-100, calibrated so 50 = a typical unprepared candidate, 80+ = hire-bar):
- communication: clarity, concision, confidence of the answers.
- structure: framing and organization (STAR — Situation, Task, Action, Result).
- depth: specificity, evidence, rigor, and trade-off awareness.
Per-question rules:
- Add ONE questionFeedback entry for every substantive interview question the candidate answered (skip the interviewer's greeting and any closing remarks).
- For each STAR element, fill the summary if the candidate clearly provided it; otherwise set it to null AND name it in "missing" (list ONLY the STAR elements — Situation/Task/Action/Result — the candidate failed to provide).
- "score" rates that single answer 0-100; set "quality" to "Strong" (>=80), "Adequate" (>=50), or "Weak" (<50) to match.
- "summary" is 2-3 sentences on overall performance; "strengths"/"improvements" are 2-3 short, specific items each.
Be honest and consistent — scores must reflect the actual transcript so they are comparable across sessions. If the candidate barely answered, score low.`;

export const interviewEvaluationWorkflow = defineWorkflow({
  id: "interview_evaluation",
  tier: "QUALITY",
  inputSchema,
  outputSchema: interviewEvaluationSchema,
  buildSystem: () => SYSTEM,
  buildPrompt: ({ interviewKind, role, transcript }) =>
    `Interview type: ${interviewKind}\nTarget role: ${role || "unspecified"}\n\nTRANSCRIPT:\n${transcript}\n\nScore the candidate per the rubric.`,
});
