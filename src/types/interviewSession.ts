// Interview practice history — shared types.

export type MockWorkflowId = "mock_behavioral";

export const MOCK_WORKFLOW_IDS: MockWorkflowId[] = ["mock_behavioral"];

export const MOCK_WORKFLOW_LABELS: Record<MockWorkflowId, string> = {
  mock_behavioral: "Behavioral",
};

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

/** Per-dimension rubric scores (0–100). */
export interface InterviewScores {
  communication: number;
  structure: number;
  depth: number;
}

export const SCORE_DIMENSIONS: { key: keyof InterviewScores; label: string; hint: string }[] = [
  { key: "communication", label: "Communication", hint: "clarity, concision, confidence" },
  { key: "structure", label: "Structure", hint: "framing, STAR / framework use" },
  { key: "depth", label: "Depth", hint: "specificity, rigor, trade-offs" },
];

/** The four STAR elements, summarized from the candidate's answer (null = absent). */
export interface STARSummary {
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
}

export type STARElement = "Situation" | "Task" | "Action" | "Result";
export const STAR_ELEMENTS: { key: keyof STARSummary; label: STARElement }[] = [
  { key: "situation", label: "Situation" },
  { key: "task", label: "Task" },
  { key: "action", label: "Action" },
  { key: "result", label: "Result" },
];
export type AnswerQuality = "Strong" | "Adequate" | "Weak";

/** Detailed end-of-session feedback for a single interview question + answer. */
export interface QuestionFeedback {
  question: string;
  answerSummary: string;
  star: STARSummary;
  missing: STARElement[];
  /** 0–100 rating for this specific answer. */
  score: number;
  quality: AnswerQuality;
  feedback: string;
}

/** Map a 0–100 answer score to its quality label. */
export const qualityFromScore = (score: number): AnswerQuality =>
  score >= 80 ? "Strong" : score >= 50 ? "Adequate" : "Weak";

/** A completed (scored) practice session. */
export interface InterviewSession {
  id: string;
  workflow: MockWorkflowId;
  role?: string;
  focus?: string;
  transcript: ChatTurn[];
  scores?: InterviewScores;
  overallScore?: number;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  questionFeedback?: QuestionFeedback[];
  createdAt: string;
}
