import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/ai/client", () => ({
  GATEWAY_URL: "https://gw.example/functions/v1/ai-gateway",
  SUPABASE_ANON_KEY: "test-anon-key",
  getAuthHeader: vi.fn(async () => "Bearer test-token"),
}));

import { getAuthHeader } from "@/ai/client";
import {
  synthesizeSpeech,
  synthesizeSpeechDev,
  synthesizeSpeechProd,
  TtsUnavailableError,
} from "./ttsService";

describe("synthesizeSpeechDev", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs text/voice to the local gateway and returns the audio blob", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const blob = await synthesizeSpeechDev("hello", "Charon", new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/tts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "hello", voice: "Charon" }),
      }),
    );
    expect(blob.size).toBe(3);
  });

  it("throws TtsUnavailableError on 501 (no GEMINI_API_KEY configured)", async () => {
    global.fetch = vi.fn(
      async () => new Response(null, { status: 501 }),
    ) as unknown as typeof fetch;
    await expect(
      synthesizeSpeechDev("hello", undefined, new AbortController().signal),
    ).rejects.toBeInstanceOf(TtsUnavailableError);
  });

  it("throws on a non-501 error status", async () => {
    global.fetch = vi.fn(
      async () => new Response(null, { status: 502 }),
    ) as unknown as typeof fetch;
    await expect(
      synthesizeSpeechDev("hello", undefined, new AbortController().signal),
    ).rejects.toThrow("TTS request failed (502)");
  });

  it("throws on empty audio", async () => {
    global.fetch = vi.fn(
      async () => new Response(new Uint8Array([]), { status: 200 }),
    ) as unknown as typeof fetch;
    await expect(
      synthesizeSpeechDev("hello", undefined, new AbortController().signal),
    ).rejects.toThrow("TTS returned empty audio");
  });
});

describe("synthesizeSpeechProd", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    vi.mocked(getAuthHeader).mockClear();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("calls the gateway with modality:audio, an auth header, and decodes base64 PCM into a WAV blob", async () => {
    const pcm = new Uint8Array([10, 20, 30, 40]);
    const b64 = Buffer.from(pcm).toString("base64");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ audio: b64, sampleRateHz: 24000 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const blob = await synthesizeSpeechProd("hello", "Puck", new AbortController().signal);

    expect(getAuthHeader).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://gw.example/functions/v1/ai-gateway");
    expect(JSON.parse(init.body as string)).toEqual({
      modality: "audio",
      text: "hello",
      voice: "Puck",
    });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect((init.headers as Record<string, string>).apikey).toBe("test-anon-key");
    // WAV-wrapped: 44-byte header + the 4 raw PCM bytes.
    expect(blob.size).toBe(48);
  });

  it("throws when the gateway response has no audio field", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({}), { status: 200 }),
    ) as unknown as typeof fetch;
    await expect(
      synthesizeSpeechProd("hello", undefined, new AbortController().signal),
    ).rejects.toThrow("TTS returned empty audio");
  });

  it("throws on a non-ok gateway response", async () => {
    global.fetch = vi.fn(
      async () => new Response(null, { status: 429 }),
    ) as unknown as typeof fetch;
    await expect(
      synthesizeSpeechProd("hello", undefined, new AbortController().signal),
    ).rejects.toThrow("TTS request failed (429)");
  });
});

describe("synthesizeSpeech (dispatcher)", () => {
  it("uses the dev path in the DEV vitest environment", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([9]), { status: 200 }));
    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      await synthesizeSpeech("hi", undefined, new AbortController().signal);
      expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/tts", expect.anything());
    } finally {
      global.fetch = originalFetch;
    }
  });
});
