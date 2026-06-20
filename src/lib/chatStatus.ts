/**
 * Derive the live status line shown during a conversational session, so users
 * always know what the agent is doing (a "feedback loop" — they should never
 * wonder whether the system is working). Pure so it can be unit-tested.
 */
export interface ChatStatusFlags {
  isScoring?: boolean;
  isGenerating?: boolean;
  speaking?: boolean;
  listening?: boolean;
}

export function deriveChatStatus({
  isScoring,
  isGenerating,
  speaking,
  listening,
}: ChatStatusFlags): string {
  if (isScoring) return "Scoring your interview…";
  if (isGenerating) return "Interviewer is thinking…";
  if (speaking) return "Interviewer is speaking…";
  if (listening) return "Listening — speak your answer";
  return "Your turn";
}
