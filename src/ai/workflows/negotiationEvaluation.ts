import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { basePersona } from "@/config/workflows";

/**
 * Score a finished salary-negotiation roleplay transcript against a fixed
 * rubric. Non-grounded; native `responseSchema` replaces the truncation-prone
 * `parseLooseJsonObject` path. Like {@link interviewEvaluationWorkflow}, the
 * schema is permissive (unbounded scores, free-text rating) so a single odd
 * field never fails the whole parse — `evaluateNegotiationTranscript` clamps
 * scores, coerces ratings, and fills defaults afterward.
 */

const moveFeedbackSchema = z.object({
  move: z.string(),
  feedback: z.string(),
  /** "Strong" | "Adequate" | "Weak" — coerced by the caller. */
  rating: z.string(),
});

export const negotiationEvaluationSchema = z.object({
  scores: z.object({
    anchoring: z.number(),
    justification: z.number(),
    composure: z.number(),
    outcome: z.number(),
  }),
  overall: z.number().optional(),
  summary: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
  moveFeedback: z.array(moveFeedbackSchema).optional(),
});

export type NegotiationEvaluationOutput = z.infer<typeof negotiationEvaluationSchema>;

const inputSchema = z.object({
  role: z.string(),
  /** The transcript, already serialized to "Candidate: … / Counterpart: …" lines. */
  transcript: z.string(),
});

const SYSTEM = `${basePersona}

Now switch roles: you are a rigorous negotiation coach grading a finished salary-negotiation roleplay. Evaluate ONLY the CANDIDATE's turns (the "User" turns) — never the counterpart.
Rubric (score each 0-100, calibrated so 50 = a typical unprepared candidate, 80+ = expert):
- anchoring: did they set an ambitious, specific target rather than accepting/echoing the first number?
- justification: did they back asks with market data, competing offers, or concrete value they bring?
- composure: did they stay calm, collaborative, and non-defensive under pushback?
- outcome: did they actually improve the offer or keep leverage/options open (vs. caving or blowing it up)?
Also produce: overall (0-100), a 2-3 sentence summary, 2-3 specific strengths, 2-3 specific highest-impact improvements, and 3-6 moveFeedback entries for the most consequential candidate moves (each: a brief paraphrase of the move, 1-2 sentences of feedback, and a rating of "Strong", "Adequate", or "Weak").
Be honest and consistent — scores must reflect the actual transcript so they are comparable across sessions.`;

export const negotiationEvaluationWorkflow = defineWorkflow({
  id: "negotiation_evaluation",
  tier: "QUALITY",
  inputSchema,
  outputSchema: negotiationEvaluationSchema,
  buildSystem: () => SYSTEM,
  buildPrompt: ({ role, transcript }) =>
    `Role being negotiated: ${role || "unspecified"}\n\nTRANSCRIPT:\n${transcript}\n\nScore the candidate's negotiation per the rubric.`,
});
