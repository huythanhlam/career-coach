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

/**
 * Where we self-host the ONNX Runtime WASM artifacts. By default Transformers.js
 * sets `wasmPaths` to its jsDelivr CDN and dynamically imports the runtime glue
 * (`ort-wasm-simd-threaded.jsep.mjs`) cross-origin at session-init time. That
 * import is blocked in restricted/offline/CSP-locked environments — failing with
 * "no available backend found … Failed to fetch dynamically imported module" —
 * and since BOTH the WebGPU and the WASM-CPU paths need that module, the fallback
 * can't save it and every voice reports "Kokoro unavailable". vite.config.ts
 * copies the artifacts into `public/ort/` so we can point the runtime at our own
 * origin and never touch the CDN. Keep the trailing-slash base in sync with the
 * Vite plugin's output dir.
 */
export function kokoroWasmBase(baseUrl: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}ort/`;
}

/** Thrown when the model is still downloading/initializing — caller should fall back this turn. */
export class KokoroLoadingError extends Error {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsPromise: Promise<any> | null = null;
let ready = false;
let failed = false;

let warmed = false;

async function load() {
  const [{ KokoroTTS }, { env }] = await Promise.all([
    import("kokoro-js"),
    import("@huggingface/transformers"),
  ]);
  // Serve the ONNX runtime WASM from our own origin instead of the jsDelivr CDN
  // (see kokoroWasmBase). Must be set before from_pretrained, which is when ORT
  // resolves wasmPaths and dynamically imports the runtime glue. Transformers.js
  // has already initialized the wasm flags by this point; we only override the
  // path it pulls the artifacts from.
  const wasm = env.backends?.onnx?.wasm;
  if (wasm) {
    wasm.wasmPaths = kokoroWasmBase(import.meta.env.BASE_URL);
  }
  // Run on WASM (CPU) with q8 (8-bit) weights — deliberately NOT WebGPU. WebGPU's
  // q4f16 (4-bit) weights make the voice audibly distorted, and kokoro-js's
  // recommended WebGPU dtype, fp32, is a ~330 MB download. q8 is ~90 MB, sounds
  // clean, runs in every browser, and the short interviewer lines synthesize fast
  // enough on CPU — especially since the model is preloaded and warmed in the
  // background (see preloadKokoro). The browser caches the weights after the
  // first download, so it's a one-time cost per browser.
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
