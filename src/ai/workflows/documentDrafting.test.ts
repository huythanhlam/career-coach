import { describe, it, expect } from "vitest";
import { documentDraftingWorkflow } from "@/ai/workflows/documentDrafting";

describe("documentDraftingWorkflow", () => {
  it("is a free-text QUALITY workflow with no output schema or search", () => {
    expect(documentDraftingWorkflow.id).toBe("document_drafting");
    expect(documentDraftingWorkflow.tier).toBe("QUALITY");
    expect(documentDraftingWorkflow.enableSearch).toBe(false);
    expect(documentDraftingWorkflow.outputSchema).toBeUndefined();
  });

  it("returns the caller-provided system instruction verbatim", () => {
    const sys = documentDraftingWorkflow.buildSystem({
      systemInstruction: "You write resumes.",
      history: [],
      message: "Generate my resume.",
    });
    expect(sys).toBe("You write resumes.");
  });

  it("sends just the message when there is no prior history", () => {
    const prompt = documentDraftingWorkflow.buildPrompt({
      systemInstruction: "s",
      history: [],
      message: "Please generate my resume based on my details.",
    });
    expect(prompt).toBe("Please generate my resume based on my details.");
  });

  it("replays prior turns as User/Assistant and ends on 'Assistant:' so the model continues", () => {
    const prompt = documentDraftingWorkflow.buildPrompt({
      systemInstruction: "s",
      history: [
        { role: "user", text: "Please generate my resume based on my details." },
        { role: "model", text: "<<<DOC_START>>>...resume...<<<DOC_END>>>" },
      ],
      message: "Make the bullet points more impactful.",
    }) as string;

    expect(prompt).toContain("Conversation so far:");
    expect(prompt).toContain("User: Please generate my resume based on my details.");
    expect(prompt).toContain("Assistant: <<<DOC_START>>>...resume...<<<DOC_END>>>");
    expect(prompt).toContain("User: Make the bullet points more impactful.");
    expect(prompt.endsWith("Assistant:")).toBe(true);
  });

  it("rejects a history turn with an out-of-vocabulary role", () => {
    const bad = documentDraftingWorkflow.inputSchema.safeParse({
      systemInstruction: "s",
      history: [{ role: "assistant", text: "nope" }],
      message: "hi",
    });
    expect(bad.success).toBe(false);
  });
});
