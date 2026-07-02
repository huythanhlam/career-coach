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
