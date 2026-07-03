// Negotiation Roleplay — counterpart persona + transcript scoring.
//
// Reuses the geminiService chat + the evaluateInterviewTranscript scoring
// pattern (strict JSON, loose parse, defensive normalize). The counterpart
// stays in character via a strong system instruction; scoring grades the
// CANDIDATE's negotiation moves against a fixed rubric so progress is comparable.

import { runWorkflow } from "@/ai/client";
import { negotiationEvaluationWorkflow } from "@/ai/workflows/negotiationEvaluation";
import type { ChatTurn } from "@/types/interviewSession";
import type {
  Counterpart,
  Difficulty,
  NegotiationEvaluation,
  NegotiationScores,
  MoveFeedback,
  MoveRating,
} from "@/types/negotiationSession";

export interface NegotiationSetup {
  role: string;
  counterpart: Counterpart;
  difficulty: Difficulty;
  /** The offer on the table + any target/market context, free text. */
  scenario: string;
  /** Optional market anchor (e.g. from BLS / market data) the recruiter defends against. */
  marketContext?: string;
  /** The candidate's profile baseline, for realistic, personalized pushback. */
  baseline?: string;
}

const DIFFICULTY_HINT: Record<Difficulty, string> = {
  easy: "You have some flexibility and want to close the deal; concede a little when the candidate justifies an ask.",
  standard:
    "You have a real but limited budget; push back, but reward well-justified, specific asks with modest movement.",
  tough:
    "Budget is tight and you negotiate hard; defend the number firmly, probe for the candidate's walk-away, and concede slowly and only for strong justification.",
};

/** System instruction that keeps the AI fully in character as the counterpart. */
export function buildRecruiterSystemInstruction(setup: NegotiationSetup): string {
  const who = setup.counterpart === "hiring_manager" ? "hiring manager" : "recruiter";
  return `You are roleplaying as a ${who} for a ${setup.role || "role"}, negotiating a job offer with the candidate over a voice/chat call.

Stay FULLY in character at all times:
- Never coach the candidate, never break role, never explain what they should do. You ARE the ${who}.
- Speak naturally and conversationally (your words will be read aloud by text-to-speech) — one short turn at a time, then let the candidate respond.
- ${DIFFICULTY_HINT[setup.difficulty]}
- Defend the company's position realistically. Probe the candidate's reasoning and their walk-away point. Acknowledge strong, evidence-backed arguments and move only when warranted.
- Keep each turn brief (2-5 sentences). Do not monologue. Do not award everything at once.
- It is fine to reach an agreement, hold firm, or leave it open — let the candidate's skill drive the outcome.

THE OFFER / SETUP ON THE TABLE:
${setup.scenario || "(no specific numbers given — ask the candidate what they're looking for and negotiate from there)"}
${setup.marketContext ? `\nMARKET CONTEXT you can reference to justify the company's position (present as estimates):\n${setup.marketContext}` : ""}
${setup.baseline ? `\nABOUT THE CANDIDATE (so your pushback feels personalized):\n${setup.baseline}` : ""}

Begin by greeting the candidate and opening the negotiation.`;
}

const clamp = (n: unknown): number =>
  Math.min(100, Math.max(0, Math.round(typeof n === "number" ? n : parseFloat(String(n)) || 0)));
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s) => typeof s === "string" && s.trim()).slice(0, 4) : [];

export async function evaluateNegotiationTranscript(
  setup: { role: string },
  transcript: ChatTurn[],
): Promise<NegotiationEvaluation> {
  const serialized = transcript
    .map((t) => `${t.role === "user" ? "Candidate" : "Counterpart"}: ${t.text}`)
    .join("\n\n")
    .slice(-20000);
  const result = await runWorkflow(negotiationEvaluationWorkflow, {
    role: setup.role,
    transcript: serialized,
  });
  if (result.status !== "ok") throw new Error(result.error);
  const parsed = result.data;

  const scores: NegotiationScores = {
    anchoring: clamp(parsed?.scores?.anchoring),
    justification: clamp(parsed?.scores?.justification),
    composure: clamp(parsed?.scores?.composure),
    outcome: clamp(parsed?.scores?.outcome),
  };

  const moveFeedback: MoveFeedback[] = Array.isArray(parsed?.moveFeedback)
    ? parsed.moveFeedback
        .filter((m: unknown): m is Record<string, unknown> => !!m && typeof m === "object")
        .map((m: Record<string, unknown>): MoveFeedback => {
          const rating: MoveRating =
            m.rating === "Strong" || m.rating === "Adequate" || m.rating === "Weak"
              ? (m.rating as MoveRating)
              : "Adequate";
          return {
            move: typeof m.move === "string" ? m.move : "",
            feedback: typeof m.feedback === "string" ? m.feedback : "",
            rating,
          };
        })
        .filter((m: MoveFeedback) => m.move || m.feedback)
        .slice(0, 6)
    : [];

  return {
    scores,
    overall: clamp(
      parsed?.overall ??
        (scores.anchoring + scores.justification + scores.composure + scores.outcome) / 4,
    ),
    summary: typeof parsed?.summary === "string" ? parsed.summary : "",
    strengths: strings(parsed?.strengths),
    improvements: strings(parsed?.improvements),
    moveFeedback,
  };
}
