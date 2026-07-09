import { z } from "zod";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { chatTurnSchema } from "@/ai/workflows/coachingChat";

/**
 * Streaming document-drafting chat (Resume Generator, Cover Letter, the
 * DocumentEditor's revise-chat). A free-text workflow — no `outputSchema`, so
 * `streamWorkflow` emits the model's prose token-by-token and returns it
 * verbatim. Structurally identical to `coachingChatWorkflow` but kept as a
 * separate workflow id so `ai_usage` metering distinguishes document drafting
 * from coach-chat conversations.
 *
 * The AI gateway is stateless, so the running transcript is replayed into the
 * prompt each turn, same semantics as the retired `createTechCoachChat` helper:
 * prior turns render "User:" / "Assistant:", the new message is appended, and
 * the prompt ends on "Assistant:" so the model continues generating the
 * document (or revision) in its voice.
 */
export const documentDraftingWorkflow = defineWorkflow({
  id: "document_drafting",
  tier: "QUALITY",
  inputSchema: z.object({
    /** Full system instruction, built by the caller (persona + doc-wrap format). */
    systemInstruction: z.string(),
    /** Prior turns in this conversation (excluding the new message). */
    history: z.array(chatTurnSchema),
    /** The user's new message (generation request or revision instruction) this turn. */
    message: z.string(),
  }),
  buildSystem: ({ systemInstruction }) => systemInstruction,
  buildPrompt: ({ history, message }) => {
    const transcript = history
      .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text}`)
      .join("\n\n");
    return transcript
      ? `Conversation so far:\n${transcript}\n\nUser: ${message}\n\nAssistant:`
      : message;
  },
});
