/**
 * Gemini-native text-to-speech. Dev talks to the local Express gateway
 * (`server.ts` /api/tts, which calls Gemini directly). Prod talks to the
 * `ai-gateway` edge function's `modality: "audio"` branch (authenticated,
 * same auth/cap/rate-limit pipeline as text generation) and decodes the
 * returned base64 PCM into a WAV blob client-side. If neither backend is
 * reachable, callers fall back to the Web Speech API. See
 * docs/superpowers/specs/2026-07-11-gemini-tts-design.md §§1-3.
 */
import { GATEWAY_URL, SUPABASE_ANON_KEY, getAuthHeader } from "@/ai/client";
import { wrapPcm16AsWav } from "@/lib/pcmWav";

const DEV_TTS_URL = "http://localhost:4000/api/tts";
const TTS_TIMEOUT_MS = 20_000;

/** Thrown when the backend reports it isn't configured — so we stop retrying. */
export class TtsUnavailableError extends Error {}

function withTimeout(signal: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(TTS_TIMEOUT_MS);
  return typeof (AbortSignal as { any?: unknown }).any === "function"
    ? AbortSignal.any([signal, timeout])
    : signal;
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Dev: unauthenticated call to the local gateway, which calls Gemini directly. */
export async function synthesizeSpeechDev(
  text: string,
  voice: string | undefined,
  signal: AbortSignal,
): Promise<Blob> {
  const res = await fetch(DEV_TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
    signal: withTimeout(signal),
  });
  if (res.status === 501) throw new TtsUnavailableError("TTS backend not configured");
  if (!res.ok) throw new Error(`TTS request failed (${res.status})`);
  const blob = await res.blob();
  if (!blob.size) throw new Error("TTS returned empty audio");
  return blob;
}

/** Prod: authenticated call to the ai-gateway edge function. */
export async function synthesizeSpeechProd(
  text: string,
  voice: string | undefined,
  signal: AbortSignal,
): Promise<Blob> {
  const authHeader = await getAuthHeader();
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: authHeader,
    },
    body: JSON.stringify({ modality: "audio", text, voice }),
    signal: withTimeout(signal),
  });
  if (!res.ok) throw new Error(`TTS request failed (${res.status})`);
  const data = (await res.json()) as { audio?: string; sampleRateHz?: number };
  if (!data.audio) throw new Error("TTS returned empty audio");
  const pcm = decodeBase64(data.audio);
  const wav = wrapPcm16AsWav(pcm, data.sampleRateHz ?? 24000);
  return new Blob([wav], { type: "audio/wav" });
}

/**
 * Synthesize `text` to an audio Blob.
 * @throws TtsUnavailableError when no backend is configured (dev only, HTTP 501)
 * @throws Error on other failures (network, 4xx/5xx, empty audio)
 */
export async function synthesizeSpeech(
  text: string,
  voice: string | undefined,
  signal: AbortSignal,
): Promise<Blob> {
  return import.meta.env.DEV
    ? synthesizeSpeechDev(text, voice, signal)
    : synthesizeSpeechProd(text, voice, signal);
}
