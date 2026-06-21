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
 * Encode mono float samples as a 16-bit PCM WAV. kokoro-js emits 32-bit float
 * WAV (format 3), which some browsers' HTMLAudioElement decode as noise —
 * audibly scratchy/distorted — even though the samples themselves are fine.
 * 16-bit PCM is decoded cleanly everywhere.
 */
function encodePcm16Wav(samples: Float32Array, sampleRate: number): Blob {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk length
  view.setUint16(20, 1, true); // 1 = PCM (integer)
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (rate * blockAlign)
  view.setUint16(32, 2, true); // block align (mono * 16-bit)
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

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
  // Re-encode to 16-bit PCM WAV; kokoro's native 32-bit float WAV plays back
  // scratchy/distorted through <audio> on some browsers (see encodePcm16Wav).
  if (audio?.audio instanceof Float32Array) {
    return encodePcm16Wav(audio.audio, audio.sampling_rate ?? 24000);
  }
  // Fallbacks if the library's output shape ever changes.
  if (typeof audio.toBlob === "function") return audio.toBlob();
  return new Blob([audio.toWav()], { type: "audio/wav" });
}
