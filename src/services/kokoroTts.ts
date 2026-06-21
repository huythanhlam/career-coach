/**
 * Kokoro TTS, running 100% in the browser via ONNX (Transformers.js) — no API
 * key, no GPU, no server. Gives the interviewer a genuinely human voice and lets
 * the user pick among Kokoro's top-graded voices. The model (~80MB) is loaded
 * lazily and cached by the browser; callers fall back to other TTS while it
 * loads or if it can't run.
 */

export interface KokoroVoice {
  id: string;
  label: string;
  grade: string;
  accent: string;
  gender: string;
}

// The 5 highest-graded English voices from the Kokoro-82M model card.
export const KOKORO_VOICES: KokoroVoice[] = [
  { id: "af_heart", label: "Heart", grade: "A", accent: "American", gender: "Female" },
  { id: "af_bella", label: "Bella", grade: "A-", accent: "American", gender: "Female" },
  { id: "af_nicole", label: "Nicole", grade: "B-", accent: "American", gender: "Female" },
  { id: "am_fenrir", label: "Fenrir", grade: "C+", accent: "American", gender: "Male" },
  { id: "am_michael", label: "Michael", grade: "C+", accent: "American", gender: "Male" },
];

export const DEFAULT_KOKORO_VOICE = "af_heart";
export const isKokoroVoice = (v: string | undefined): boolean =>
  !!v && KOKORO_VOICES.some((k) => k.id === v);

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

/** Thrown when the model is still downloading/initializing — caller should fall back this turn. */
export class KokoroLoadingError extends Error {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsPromise: Promise<any> | null = null;
let ready = false;
let failed = false;

let warmed = false;

async function load() {
  const { KokoroTTS } = await import("kokoro-js");
  // Prefer WebGPU (much faster) with q4f16 weights — NOT fp16, which emits NaN
  // (silent) audio for some voices, notably the default af_heart. But q4f16
  // needs 4-bit WebGPU kernels that not every GPU/driver provides, and a failed
  // GPU load otherwise bricks every voice ("Kokoro unavailable"). So fall back
  // to the universally-supported WASM (CPU) q8 path if the GPU path can't load.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasGpu = typeof navigator !== "undefined" && !!(navigator as any).gpu;
  if (hasGpu) {
    try {
      return await KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q4f16", device: "webgpu" });
    } catch (e) {
      console.warn("Kokoro: WebGPU load failed, falling back to WASM/CPU.", e);
    }
  }
  return KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "wasm" });
}

function ensureLoad() {
  if (!ttsPromise) {
    ttsPromise = load()
      .then((t) => { ready = true; return t; })
      .catch((e) => { failed = true; ttsPromise = null; throw e; });
  }
  return ttsPromise;
}

/**
 * Kick off model loading (and a one-time warm-up generation) in the background,
 * e.g. when a voice is sampled/selected or the interview starts — so the first
 * real sentence doesn't pay the download + graph-compile cost.
 */
export function preloadKokoro() {
  if (failed) return;
  ensureLoad()
    .then(async (tts) => {
      if (warmed) return;
      warmed = true;
      try { await tts.generate("Hello.", { voice: DEFAULT_KOKORO_VOICE }); } catch { /* ignore */ }
    })
    .catch(() => { /* surfaced on next generate */ });
}

export const kokoroReady = () => ready;
export const kokoroFailed = () => failed;

/**
 * Synthesize `text` in `voice` to an audio Blob.
 * @throws KokoroLoadingError if not loaded yet and waitForLoad is false
 * @throws Error if Kokoro can't run at all
 */
export async function kokoroGenerate(
  text: string,
  voice: string,
  opts: { waitForLoad?: boolean } = {},
): Promise<Blob> {
  if (failed) throw new Error("Kokoro unavailable");
  if (!ready && !opts.waitForLoad) {
    ensureLoad().catch(() => { /* background load */ });
    throw new KokoroLoadingError("Kokoro model is loading");
  }
  const tts = await ensureLoad();
  const audio = await tts.generate(text, { voice });
  if (typeof audio.toBlob === "function") return audio.toBlob();
  // Fallback for older builds: wrap the WAV bytes.
  return new Blob([audio.toWav()], { type: "audio/wav" });
}
