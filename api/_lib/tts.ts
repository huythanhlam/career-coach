/**
 * Shared text-to-speech helper: synthesize speech through the **Vercel AI
 * Gateway** voice models (https://vercel.com/blog/realtime-voice-agents-on-ai-gateway).
 *
 * Used by both the local Express dev gateway (`server.ts`) and the production
 * Vercel function (`api/tts.ts`). The gateway exposes an OpenAI-compatible
 * speech endpoint, so we POST `{ model, input, voice, response_format }` and get
 * back audio bytes. The AI Gateway key stays server-side here — never shipped to
 * the browser.
 */

/** Max characters accepted per request — one spoken sentence is far smaller. */
export const TTS_TEXT_LIMIT = 8000;

// OpenAI-compatible speech endpoint on the Vercel AI Gateway.
const GATEWAY_SPEECH_URL = "https://ai-gateway.vercel.sh/v1/audio/speech";

// Default to OpenAI's fast, natural mini TTS model (served via the gateway).
// Override with TTS_MODEL; voice falls back to TTS_VOICE then "alloy".
const DEFAULT_MODEL = "openai/gpt-4o-mini-tts";
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

  const upstream = await fetch(GATEWAY_SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text,
      voice: selectedVoice,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`gateway ${upstream.status}: ${detail.slice(0, 200)}`);
  }

  const audio = Buffer.from(await upstream.arrayBuffer());
  if (!audio.length) throw new Error("gateway returned empty audio");
  const contentType = upstream.headers.get("content-type") ?? "audio/mpeg";
  return { audio, contentType };
}
