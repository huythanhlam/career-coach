/**
 * Kokoro TTS, running 100% in the browser via ONNX (Transformers.js) — no API
 * key, no GPU, no server. Gives the interviewer a genuinely human voice and lets
 * the user pick among Kokoro's top-graded voices.
 *
 * This module is the MAIN-THREAD CLIENT. The model (~80MB) and all ONNX
 * inference live in a dedicated Web Worker (`kokoroWorker.ts`) so synthesis
 * never blocks the UI — without the worker, the WASM-CPU `generate()` burst
 * freezes the page during voice sampling, the interview intro, and every spoken
 * question. Callers fall back to other TTS while the model loads or if it can't
 * run. Pure helpers (voice list, WAV encoding, wasm base path) live in
 * `kokoroShared.ts` so they stay unit-testable and worker-safe.
 */

import {
  DEFAULT_KOKORO_VOICE,
  KOKORO_VOICES,
  encodePcm16Wav,
  isKokoroVoice,
  kokoroWasmBase,
  type KokoroVoice,
} from "./kokoroShared";

// Re-export the shared public surface so existing importers (and the unit test)
// keep importing from "@/services/kokoroTts" unchanged.
export {
  DEFAULT_KOKORO_VOICE,
  KOKORO_VOICES,
  isKokoroVoice,
  kokoroWasmBase,
  type KokoroVoice,
};

/** Thrown when the model is still downloading/initializing — caller should fall back this turn. */
export class KokoroLoadingError extends Error {}

type ResultMsg = { type: "result"; id: number; samples: Float32Array; sampleRate: number };
type OutboundMsg =
  | { type: "ready" }
  | { type: "loadfailed" }
  | ResultMsg
  | { type: "error"; id: number; message: string };

let worker: Worker | null = null;
let ready = false;
let failed = false;
let loadRequested = false;

// Resolves when the worker reports the model ready; rejects if it can't load.
let readyPromise: Promise<void> | null = null;
let resolveReady: (() => void) | null = null;
let rejectReady: ((e: unknown) => void) | null = null;

let nextId = 1;
const pending = new Map<number, {
  resolve: (r: { samples: Float32Array; sampleRate: number }) => void;
  reject: (e: unknown) => void;
}>();

function failPending(err: unknown) {
  for (const { reject } of pending.values()) reject(err);
  pending.clear();
}

/** Lazily create the inference worker. Returns null where Workers aren't available (SSR/tests). */
function getWorker(): Worker | null {
  if (worker) return worker;
  if (failed || typeof Worker === "undefined") return null;
  try {
    worker = new Worker(new URL("./kokoroWorker.ts", import.meta.url), { type: "module" });
  } catch {
    failed = true;
    return null;
  }
  readyPromise = new Promise<void>((res, rej) => { resolveReady = res; rejectReady = rej; });
  worker.onmessage = (e: MessageEvent<OutboundMsg>) => {
    const msg = e.data;
    if (msg.type === "ready") {
      ready = true;
      resolveReady?.();
    } else if (msg.type === "loadfailed") {
      failed = true;
      const err = new Error("Kokoro unavailable");
      rejectReady?.(err);
      failPending(err);
    } else if (msg.type === "result") {
      const p = pending.get(msg.id);
      if (p) { pending.delete(msg.id); p.resolve({ samples: msg.samples, sampleRate: msg.sampleRate }); }
    } else if (msg.type === "error") {
      const p = pending.get(msg.id);
      if (p) { pending.delete(msg.id); p.reject(new Error(msg.message)); }
    }
  };
  worker.onerror = () => {
    failed = true;
    const err = new Error("Kokoro worker crashed");
    rejectReady?.(err);
    failPending(err);
  };
  return worker;
}

/** Ensure the worker exists and has been asked to load the model (idempotent). */
function ensureLoad(): Worker | null {
  const w = getWorker();
  if (!w) return null;
  if (!loadRequested) {
    loadRequested = true;
    w.postMessage({ type: "load" });
  }
  return w;
}

/**
 * Kick off model loading (and a one-time warm-up generation) in the worker, e.g.
 * when a voice is sampled/selected or the interview starts — so the first real
 * sentence doesn't pay the download + graph-compile cost.
 */
export function preloadKokoro() {
  if (failed) return;
  ensureLoad();
}

export const kokoroReady = () => ready;
export const kokoroFailed = () => failed;

/**
 * Synthesize `text` in `voice` to an audio Blob, with inference running in the
 * worker so the UI never freezes.
 * @throws KokoroLoadingError if not loaded yet and waitForLoad is false
 * @throws Error if Kokoro can't run at all
 */
export async function kokoroGenerate(
  text: string,
  voice: string,
  opts: { waitForLoad?: boolean } = {},
): Promise<Blob> {
  if (failed) throw new Error("Kokoro unavailable");
  const w = ensureLoad();
  if (!w) throw new Error("Kokoro unavailable");

  if (!ready) {
    if (!opts.waitForLoad) throw new KokoroLoadingError("Kokoro model is loading");
    // Wait for the worker to finish loading (rejects → "Kokoro unavailable").
    await readyPromise;
  }

  const id = nextId++;
  const { samples, sampleRate } = await new Promise<{ samples: Float32Array; sampleRate: number }>(
    (resolve, reject) => {
      pending.set(id, { resolve, reject });
      w.postMessage({ type: "generate", id, text, voice });
    },
  );
  // Re-encode to 16-bit PCM WAV; kokoro's native 32-bit float WAV plays back
  // scratchy/distorted through <audio> on some browsers (see encodePcm16Wav).
  return encodePcm16Wav(samples, sampleRate);
}
