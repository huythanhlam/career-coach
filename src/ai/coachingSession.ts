import { streamWorkflow } from "@/ai/client";
import { coachingChatWorkflow, type ChatTurn } from "@/ai/workflows/coachingChat";
import type { Workflow } from "@/ai/defineWorkflow";

type ChatWorkflow = Workflow<
  { systemInstruction: string; history: ChatTurn[]; message: string },
  unknown
>;

// The gateway is stateless, so every turn resends the transcript as input
// tokens — cost that grows linearly with session length. Beyond this many
// turns (8 exchanges), only the most recent MAX_HISTORY_TURNS are replayed
// into the model; the full transcript is still kept on `history` for any
// other consumer (e.g. end-of-session scoring reads the component's own
// message log, not this). Tradeoff: a very long session's interviewer may
// occasionally lose track of turns older than the window (e.g. re-ask a
// question), which is an acceptable cost for bounding per-turn token spend.
const MAX_HISTORY_TURNS = 16;

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

export function createCoachingSession(
  systemInstruction: string,
  workflow: ChatWorkflow = coachingChatWorkflow,
): CoachingSession {
  const history: ChatTurn[] = [];
  return {
    get history() {
      return history;
    },
    async send(message, onToken, signal) {
      let full = "";
      const capped =
        history.length > MAX_HISTORY_TURNS ? history.slice(-MAX_HISTORY_TURNS) : history;
      await streamWorkflow(
        workflow,
        { systemInstruction, history: [...capped], message },
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
