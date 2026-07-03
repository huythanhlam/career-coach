import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { streamWorkflow } from "@/ai/client";
import { defineWorkflow } from "@/ai/defineWorkflow";
import { supabase } from "@/lib/supabaseClient";

// A minimal free-text workflow to exercise the streaming client.
const testWf = defineWorkflow({
  id: "test_stream",
  tier: "QUALITY",
  inputSchema: z.object({ message: z.string() }),
  buildSystem: () => "system",
  buildPrompt: ({ message }) => message,
});

const enc = new TextEncoder();

/** A response streaming the given SSE frames, closed cleanly at the end. */
function okStream(frames: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const f of frames) c.enqueue(enc.encode(f));
      c.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** A response that delivers one frame, then errors on the next read (mid-stream failure). */
function frameThenError(frame: string): Response {
  let step = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (step === 0) {
        c.enqueue(enc.encode(frame));
        step += 1;
      } else {
        c.error(new Error("mid-stream boom"));
      }
    },
  });
  return new Response(body, { status: 200 });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeSession = { data: { session: { access_token: "test-token" } }, error: null } as any;
  vi.spyOn(supabase.auth, "getSession").mockResolvedValue(fakeSession);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("streamWorkflow — event handling", () => {
  it("delivers tokens in order and returns the assembled text, sources, and usage", async () => {
    fetchMock.mockResolvedValue(
      okStream([
        'event: token\ndata: {"delta":"Hel"}\n\n',
        'event: token\ndata: {"delta":"lo"}\n\n',
        'event: sources\ndata: [{"label":"Src","url":"https://x.test"}]\n\n',
        'event: done\ndata: {"usage":{"inputTokens":3,"outputTokens":2,"ttftMs":12}}\n\n',
      ]),
    );

    const tokens: string[] = [];
    let sources: unknown;
    const result = await streamWorkflow(
      testWf,
      { message: "hi" },
      { onToken: (t) => tokens.push(t), onSources: (s) => (sources = s) },
    );

    expect(tokens).toEqual(["Hel", "lo"]);
    expect(result.text).toBe("Hello");
    expect(sources).toEqual([{ label: "Src", url: "https://x.test" }]);
    expect(result.sources).toEqual([{ label: "Src", url: "https://x.test" }]);
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 2, ttftMs: 12 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends stream:true and forwards conversationId + userMessage in the request body", async () => {
    fetchMock.mockResolvedValue(okStream(['event: done\ndata: {"usage":{}}\n\n']));

    await streamWorkflow(
      testWf,
      { message: "remember me" },
      { conversationId: "convo-1", userMessage: "remember me" },
    );

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.stream).toBe(true);
    expect(body.tier).toBe("QUALITY");
    expect(body.conversationId).toBe("convo-1");
    expect(body.userMessage).toBe("remember me");
  });

  it("throws the server's generic message on an error frame, without retrying", async () => {
    fetchMock.mockResolvedValue(
      okStream(['event: error\ndata: {"message":"AI generation failed."}\n\n']),
    );

    await expect(streamWorkflow(testWf, { message: "hi" })).rejects.toThrow(
      "AI generation failed.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tolerates a malformed data frame and keeps streaming later tokens", async () => {
    fetchMock.mockResolvedValue(
      okStream([
        "event: token\ndata: {not json}\n\n",
        'event: token\ndata: {"delta":"ok"}\n\n',
        'event: done\ndata: {"usage":{}}\n\n',
      ]),
    );

    const result = await streamWorkflow(testWf, { message: "hi" });
    expect(result.text).toBe("ok");
  });
});

describe("streamWorkflow — abort", () => {
  it("propagates a caller abort and does not retry", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));

    await expect(
      streamWorkflow(testWf, { message: "hi" }, { signal: controller.signal }),
    ).rejects.toThrow();
    // Aborted before any token — the retry loop must short-circuit.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("streamWorkflow — retry semantics", () => {
  it("retries a transient HTTP failure that occurs before the first token", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("overloaded", { status: 503 }))
      .mockResolvedValueOnce(
        okStream([
          'event: token\ndata: {"delta":"recovered"}\n\n',
          'event: done\ndata: {"usage":{}}\n\n',
        ]),
      );

    const result = await streamWorkflow(testWf, { message: "hi" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.text).toBe("recovered");
  }, 10_000);

  it("does NOT retry once a token has already streamed", async () => {
    fetchMock.mockResolvedValue(frameThenError('event: token\ndata: {"delta":"partial"}\n\n'));

    const tokens: string[] = [];
    await expect(
      streamWorkflow(testWf, { message: "hi" }, { onToken: (t) => tokens.push(t) }),
    ).rejects.toThrow();

    expect(tokens).toEqual(["partial"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
