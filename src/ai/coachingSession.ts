import { streamWorkflow } from "@/ai/client";
import { coachingChatWorkflow, type ChatTurn } from "@/ai/workflows/coachingChat";

/**
 * A stateful conversational coaching session — the streaming replacement for the
 * retired `createCoachingChat` helper. Holds the running transcript in memory and
 * replays it into `coachingChatWorkflow` each turn (the gateway is stateless), so
 * callers keep the exact "hold a chat handle in a ref" ergonomics they had
 * before, but now get real token-by-token streaming via `streamWorkflow`.
 *
 * Used by the live conversational surfaces (Mock Interview, Negotiation). Global
 * Coach / Goal Planning drive `streamWorkflow` directly with their own persisted
 * history; this factory is for the in-memory, non-persisted sessions.
 */
export interface CoachingSession {
  /**
   * Stream one turn. `onToken` is called with the running *full* reply so far
   * (already accumulated), so callers can render the growing bubble directly.
   * Resolves with the final reply. Throws on failure — the turn is NOT recorded,
   * so a caller-driven Retry re-sends against the same history.
   */
  send(message: string, onToken: (fullText: string) => void, signal?: AbortSignal): Promise<string>;
  /** The turns recorded so far (user + model), oldest first. */
  readonly history: readonly ChatTurn[];
}

export function createCoachingSession(systemInstruction: string): CoachingSession {
  const history: ChatTurn[] = [];
  return {
    get history() {
      return history;
    },
    async send(message, onToken, signal) {
      let full = "";
      await streamWorkflow(
        coachingChatWorkflow,
        { systemInstruction, history: [...history], message },
        {
          signal,
          onToken: (delta) => {
            full += delta;
            onToken(full);
          },
        },
      );
      history.push({ role: "user", text: message }, { role: "model", text: full });
      return full;
    },
  };
}
