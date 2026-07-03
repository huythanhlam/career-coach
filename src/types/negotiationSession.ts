// Negotiation Roleplay — shared types.

import type { ChatTurn } from "@/types/interviewSession";

export type { ChatTurn };

export type Counterpart = "recruiter" | "hiring_manager";

export const COUNTERPART_LABELS: Record<Counterpart, string> = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring Manager",
};

export type Difficulty = "easy" | "standard" | "tough";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Friendly",
  standard: "Standard",
  tough: "Hardball",
};

/** Per-dimension rubric scores (0–100) for a negotiation. */
export interface NegotiationScores {
  anchoring: number;
  justification: number;
  composure: number;
  outcome: number;
}

export const NEGOTIATION_DIMENSIONS: {
  key: keyof NegotiationScores;
  label: string;
  hint: string;
}[] = [
  { key: "anchoring", label: "Anchoring", hint: "set an ambitious, specific target" },
  { key: "justification", label: "Justification", hint: "backed asks with market/value evidence" },
  { key: "composure", label: "Composure", hint: "stayed calm, collaborative, unflustered" },
  { key: "outcome", label: "Outcome", hint: "improved the offer / kept options open" },
];

export type MoveRating = "Strong" | "Adequate" | "Weak";

/** Feedback on a single negotiation move the user made. */
export interface MoveFeedback {
  move: string;
  feedback: string;
  rating: MoveRating;
}

export interface NegotiationEvaluation {
  scores: NegotiationScores;
  overall: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  moveFeedback: MoveFeedback[];
}

/** A completed (scored) negotiation roleplay. */
export interface NegotiationSession {
  id: string;
  role?: string;
  counterpart?: Counterpart;
  scenario?: string;
  transcript: ChatTurn[];
  scores?: NegotiationScores;
  overallScore?: number;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  moveFeedback?: MoveFeedback[];
  createdAt: string;
}

export type NewNegotiationSession = Omit<NegotiationSession, "id" | "createdAt">;
