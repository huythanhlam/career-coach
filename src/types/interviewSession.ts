// Interview practice history — shared types.

export type MockWorkflowId = "mock_behavioral" | "mock_tech" | "mock_case_study";

export const MOCK_WORKFLOW_IDS: MockWorkflowId[] = ["mock_behavioral", "mock_tech", "mock_case_study"];

export const MOCK_WORKFLOW_LABELS: Record<MockWorkflowId, string> = {
  mock_behavioral: "Behavioral",
  mock_tech: "Technical",
  mock_case_study: "Case Study",
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
  createdAt: string;
}
