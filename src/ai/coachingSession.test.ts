import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the streaming client so we test the session's history/accumulation logic.
const streamWorkflow = vi.fn();
vi.mock("@/ai/client", () => ({
  streamWorkflow: (...a: unknown[]) => streamWorkflow(...a),
}));

import { createCoachingSession } from "@/ai/coachingSession";
import { coachingChatWorkflow } from "@/ai/workflows/coachingChat";
import { documentDraftingWorkflow } from "@/ai/workflows/documentDrafting";

/** A fake streamWorkflow that emits `reply` in two chunks and resolves. */
function emits(...chunks: string[]) {
  return async (_wf: unknown, _input: unknown, opts?: { onToken?: (d: string) => void }) => {
    for (const c of chunks) opts?.onToken?.(c);
    return { text: chunks.join(""), sources: [], usage: {} };
  };
}

describe("createCoachingSession", () => {
  beforeEach(() => streamWorkflow.mockReset());

  it("streams the running text and returns the full reply", async () => {
    streamWorkflow.mockImplementation(emits("Hello ", "there"));
    const session = createCoachingSession("You are the coach.");

    const running: string[] = [];
    const full = await session.send("hi", (t) => running.push(t));

    expect(full).toBe("Hello there");
    // onToken receives the accumulated text, not raw deltas.
    expect(running).toEqual(["Hello ", "Hello there"]);
  });

  it("passes the workflow, system instruction, and message to streamWorkflow", async () => {
    streamWorkflow.mockImplementation(emits("ok"));
    const session = createCoachingSession("SYSTEM");
    await session.send("first message", () => {});

    const [wf, input] = streamWorkflow.mock.calls[0];
    expect(wf).toBe(coachingChatWorkflow);
    expect(input).toMatchObject({
      systemInstruction: "SYSTEM",
      history: [],
      message: "first message",
    });
  });

  it("replays prior turns as history on the next turn", async () => {
    streamWorkflow.mockImplementation(emits("A1"));
    const session = createCoachingSession("SYSTEM");
    await session.send("Q1", () => {});

    streamWorkflow.mockImplementation(emits("A2"));
    await session.send("Q2", () => {});

    const secondInput = streamWorkflow.mock.calls[1][1] as { history: unknown[]; message: string };
    expect(secondInput.message).toBe("Q2");
    expect(secondInput.history).toEqual([
      { role: "user", text: "Q1" },
      { role: "model", text: "A1" },
    ]);
  });

  it("uses a caller-provided workflow instead of the coachingChat default", async () => {
    streamWorkflow.mockImplementation(emits("draft"));
    const session = createCoachingSession("SYSTEM", documentDraftingWorkflow);
    await session.send("Generate my resume.", () => {});

    const [wf] = streamWorkflow.mock.calls[0];
    expect(wf).toBe(documentDraftingWorkflow);
  });

  it("propagates errors so the caller can offer Retry", async () => {
    streamWorkflow.mockRejectedValue(new Error("gateway down"));
    const session = createCoachingSession("SYSTEM");
    await expect(session.send("hi", () => {})).rejects.toThrow(/gateway down/);
    // A failed turn is not recorded, so Retry re-sends against clean history.
    streamWorkflow.mockImplementation(emits("recovered"));
    await session.send("hi", () => {});
    const retryInput = streamWorkflow.mock.calls[1][1] as { history: unknown[] };
    expect(retryInput.history).toEqual([]);
  });
});
