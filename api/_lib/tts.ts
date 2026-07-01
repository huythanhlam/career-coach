/**
 * Shared text-to-speech helper: synthesize speech through the **Vercel AI
 * Gateway** voice models via the AI SDK's `generateSpeech`
 * (https://vercel.com/blog/realtime-voice-agents-on-ai-gateway).
 *
 * NB: the gateway's OpenAI-compatible REST surface does NOT expose
 * `/v1/audio/speech` — speech must go through the AI SDK's speech provider,
 * which the gateway routes. Used by both the local Express dev gateway
 * (`server.ts`) and the production Vercel function (`api/tts.ts`). The AI
 * Gateway key stays server-side here — never shipped to the browser.
 */
import { experimental_generateSpeech as generateSpeech } from "ai";
import { createGateway } from "@ai-sdk/gateway";

/** Max characters accepted per request — one spoken sentence is far smaller. */
export const TTS_TEXT_LIMIT = 8000;

// Gateway-supported speech models: openai/tts-1, openai/tts-1-hd, xai/grok-tts.
// Override with TTS_MODEL; voice falls back to TTS_VOICE then "alloy".
const DEFAULT_MODEL = "openai/tts-1";
const DEFAULT_VOICE = "alloy";

export interface SynthResult {
  audio: Buffer;
  contentType: string;
}

/**
 * Synthesize `text` in `voice` to MP3 audio via the AI Gateway.
 * @throws Error if AI_GATEWAY_API_KEY is unset or the gateway request fails.
 */
export async function synthesizeViaGateway(text: string, voice?: string): Promise<SynthResult> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("AI_GATEWAY_API_KEY not configured");

  const model = process.env.TTS_MODEL || DEFAULT_MODEL;
  const selectedVoice = voice || process.env.TTS_VOICE || DEFAULT_VOICE;

  const gateway = createGateway({ apiKey });
  const { audio } = await generateSpeech({
    model: gateway.speech(model),
    text,
    voice: selectedVoice,
    outputFormat: "mp3",
    abortSignal: AbortSignal.timeout(20_000),
  });

  const buf = Buffer.from(audio.uint8Array);
  if (!buf.length) throw new Error("gateway returned empty audio");
  return { audio: buf, contentType: audio.mediaType || "audio/mpeg" };
}
