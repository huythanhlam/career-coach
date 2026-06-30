/**
 * Neural text-to-speech for the AI interviewer / recruiter, powered by
 * **Vercel AI Gateway voice models** (https://vercel.com/blog/realtime-voice-agents-on-ai-gateway).
 *
 * The browser never talks to the gateway directly — the AI Gateway key is a
 * server-side secret. Instead the browser calls a thin proxy (`/api/tts`): the
 * local Express gateway in dev, a Vercel serverless function in prod. The proxy
 * forwards to the gateway's OpenAI-compatible speech endpoint, keeps the key
 * server-side, and avoids browser CORS. If the gateway isn't configured (or a
 * request fails) callers fall back to the browser's built-in Web Speech voice.
 */
import { supabase } from "@/lib/supabaseClient";

const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

// Where the browser sends TTS requests. Both dev (local Express gateway) and
// prod (Vercel `api/tts` function) expose `/api/tts`; `VITE_TTS_URL` overrides.
const TTS_URL: string =
  (import.meta.env.VITE_TTS_URL as string) ??
  (import.meta.env.DEV ? "http://localhost:4000/api/tts" : "/api/tts");

/** True if a TTS proxy endpoint is even worth trying. */
export const ttsConfigured = !!TTS_URL;

/** A selectable AI Gateway voice, shaped for the voice-picker UI. */
export interface TtsVoice {
  id: string;
  label: string;
  accent: string;
  gender: string;
}

// Curated OpenAI voices served through the Vercel AI Gateway. These are the
// voices the gateway's text-to-speech models (e.g. `openai/gpt-4o-mini-tts`)
// accept; the server picks the model, the client only picks the voice.
export const TTS_VOICES: TtsVoice[] = [
  { id: "nova", label: "Nova", accent: "American", gender: "Female" },
  { id: "shimmer", label: "Shimmer", accent: "American", gender: "Female" },
  { id: "alloy", label: "Alloy", accent: "American", gender: "Neutral" },
  { id: "echo", label: "Echo", accent: "American", gender: "Male" },
  { id: "onyx", label: "Onyx", accent: "American", gender: "Male" },
  { id: "fable", label: "Fable", accent: "British", gender: "Male" },
];

export const DEFAULT_TTS_VOICE = "nova";
export const isTtsVoice = (v: string | undefined): boolean =>
  !!v && TTS_VOICES.some((t) => t.id === v);

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
  // Cap the wait so a slow upstream never hangs the spoken turn — the caller
  // falls back to the browser voice and retries on the next turn. Combine with
  // the caller's cancel signal.
  const timeout = AbortSignal.timeout(20_000);
  const combined =
    typeof (AbortSignal as { any?: unknown }).any === "function"
      ? AbortSignal.any([signal, timeout])
      : signal;
  // Send the Supabase access token so the (public) production endpoint can
  // require authentication, mirroring the AI gateway in geminiService.ts. The
  // dev Express gateway ignores it.
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? "";
  const res = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text, voice }),
    signal: combined,
  });
  if (res.status === 501) throw new TtsUnavailableError("TTS backend not configured");
  if (!res.ok) throw new Error(`TTS request failed (${res.status})`);
  const blob = await res.blob();
  if (!blob.size) throw new Error("TTS returned empty audio");
  return blob;
}
