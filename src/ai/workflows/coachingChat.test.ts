import { describe, it, expect } from "vitest";
import { coachingChatWorkflow } from "@/ai/workflows/coachingChat";

describe("coachingChatWorkflow", () => {
  it("is a free-text QUALITY workflow with no output schema or search", () => {
    expect(coachingChatWorkflow.id).toBe("coaching_chat");
    expect(coachingChatWorkflow.tier).toBe("QUALITY");
    expect(coachingChatWorkflow.enableSearch).toBe(false);
    expect(coachingChatWorkflow.outputSchema).toBeUndefined();
  });

  it("returns the caller-provided system instruction verbatim", () => {
    const sys = coachingChatWorkflow.buildSystem({
      systemInstruction: "You are the coach.",
      history: [],
      message: "hi",
    });
    expect(sys).toBe("You are the coach.");
  });

  it("sends just the message when there is no prior history", () => {
    const prompt = coachingChatWorkflow.buildPrompt({
      systemInstruction: "s",
      history: [],
      message: "How do I negotiate?",
    });
    expect(prompt).toBe("How do I negotiate?");
  });

  it("replays prior turns as User/Coach and ends on 'Coach:' so the model continues", () => {
    const prompt = coachingChatWorkflow.buildPrompt({
      systemInstruction: "s",
      history: [
        { role: "user", text: "Hi" },
        { role: "model", text: "Hello! How can I help?" },
      ],
      message: "Review my resume",
    }) as string;

    expect(prompt).toContain("Conversation so far:");
    expect(prompt).toContain("User: Hi");
    expect(prompt).toContain("Coach: Hello! How can I help?");
    expect(prompt).toContain("User: Review my resume");
    expect(prompt.endsWith("Coach:")).toBe(true);
  });

  it("rejects a history turn with an out-of-vocabulary role", () => {
    const bad = coachingChatWorkflow.inputSchema.safeParse({
      systemInstruction: "s",
      history: [{ role: "assistant", text: "nope" }],
      message: "hi",
    });
    expect(bad.success).toBe(false);
  });
});
