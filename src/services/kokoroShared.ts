/**
 * Pure, environment-agnostic helpers shared by the Kokoro main-thread client
 * (`kokoroTts.ts`) and the Web Worker that actually runs ONNX inference
 * (`kokoroWorker.ts`). Keeping these here avoids the worker importing the
 * client (which constructs a Worker) and keeps everything unit-testable without
 * a real `speechSynthesis`, Worker, or WASM runtime.
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

export const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

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

/**
 * Encode mono float samples as a 16-bit PCM WAV. kokoro-js emits 32-bit float
 * WAV (format 3), which some browsers' HTMLAudioElement decode as noise —
 * audibly scratchy/distorted — even though the samples themselves are fine.
 * 16-bit PCM is decoded cleanly everywhere. Cheap (O(n) over a few seconds of
 * audio), so it stays on the main thread; the heavy inference is what we move
 * into the worker.
 */
export function encodePcm16Wav(samples: Float32Array, sampleRate: number): Blob {
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
