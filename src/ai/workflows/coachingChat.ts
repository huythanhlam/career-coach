import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";

/**
 * Streaming coaching chat (Global Coach, Goal Planning coaching). A free-text
 * workflow — no `outputSchema`, so `streamWorkflow` emits the model's prose
 * token-by-token and returns it verbatim.
 *
 * The AI gateway is stateless (one `systemInstruction` + one `prompt` per call),
 * so the running transcript is replayed into the prompt each turn. This mirrors
 * the semantics of the retired `createCoachingChat` helper exactly: prior turns
 * are rendered "User:" / "Coach:", the new message is appended, and the prompt
 * ends on "Coach:" so the model continues in the coach's voice. The caller owns
 * the `systemInstruction` (built with profile/pipeline context at send time) and
 * the `history`; durable persistence is handled separately via `conversationId`
 * (see `src/ai/conversation.ts` and the gateway's streaming path).
 *
 * Chat messages are deliberately NOT wrapped in `uc()` — the user IS talking to
 * the coach, so their message is the instruction. The system prompt still frames
 * the coach's role and boundaries. (Structured, data-extracting workflows keep
 * the `uc()` injection wrapping; conversational ones never had it.)
 */

export const chatTurnSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string(),
});

export type ChatTurn = z.infer<typeof chatTurnSchema>;

export const coachingChatWorkflow = defineWorkflow({
  id: "coaching_chat",
  tier: "QUALITY",
  inputSchema: z.object({
    /** Full system instruction, built by the caller with live profile context. */
    systemInstruction: z.string(),
    /** Prior turns in this conversation (excluding the new message). */
    history: z.array(chatTurnSchema),
    /** The user's new message this turn. */
    message: z.string(),
  }),
  buildSystem: ({ systemInstruction }) => systemInstruction,
  buildPrompt: ({ history, message }) => {
    const transcript = history
      .map((t) => `${t.role === "user" ? "User" : "Coach"}: ${t.text}`)
      .join("\n\n");
    return transcript
      ? `Conversation so far:\n${transcript}\n\nUser: ${message}\n\nCoach:`
      : message;
  },
});
