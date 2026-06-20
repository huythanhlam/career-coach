/**
 * Optional neural text-to-speech. When a TTS backend is configured (via the
 * local gateway's /api/tts proxy → a VibeVoice / ElevenLabs / any HTTP TTS
 * server you run), the interviewer speaks with a far more human voice than the
 * browser's built-in synthesis. If it isn't configured or fails, callers fall
 * back to the Web Speech API. The proxy keeps any backend key server-side and
 * avoids browser CORS.
 */

// Dev: default to the local gateway. Prod (Edge Function) has no TTS proxy, so
// leave it empty and rely on browser speech unless VITE_TTS_URL is set.
const TTS_URL: string =
  (import.meta.env.VITE_TTS_URL as string) ??
  (import.meta.env.DEV ? "http://localhost:4000/api/tts" : "");

/** True if a remote TTS endpoint is even worth trying. */
export const ttsConfigured = !!TTS_URL;

/** Thrown when the backend reports it isn't configured — so we stop retrying. */
export class TtsUnavailableError extends Error {}

/**
 * Synthesize `text` to an audio Blob via the gateway proxy.
 * @throws TtsUnavailableError when no backend is configured (HTTP 501)
 * @throws Error on other failures (network, 5xx, empty audio)
 */
export async function synthesizeSpeech(
  text: string,
  voice: string | undefined,
  signal: AbortSignal,
): Promise<Blob> {
  if (!TTS_URL) throw new TtsUnavailableError("TTS endpoint not configured");
  // Cap the wait so a cold/slow model never hangs the spoken turn — the caller
  // falls back to the browser voice and retries on the next turn (by which time
  // the model has usually warmed up). Combine with the caller's cancel signal.
  const timeout = AbortSignal.timeout(20_000);
  const combined =
    typeof (AbortSignal as { any?: unknown }).any === "function"
      ? AbortSignal.any([signal, timeout])
      : signal;
  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
    signal: combined,
  });
  if (res.status === 501) throw new TtsUnavailableError("TTS backend not configured");
  if (!res.ok) throw new Error(`TTS request failed (${res.status})`);
  const blob = await res.blob();
  if (!blob.size) throw new Error("TTS returned empty audio");
  return blob;
}
