/**
 * Kokoro TTS, running 100% in the browser via ONNX (Transformers.js) — no API
 * key, no server (the GPU is used when available, otherwise the CPU). Gives the
 * interviewer a genuinely human voice and lets the user pick among Kokoro's
 * top-graded voices.
 *
 * This module is the MAIN-THREAD CLIENT. The model (~80MB) and all ONNX
 * inference live in a dedicated Web Worker (`kokoroWorker.ts`) so synthesis
 * never blocks the UI — without the worker, the WASM-CPU `generate()` burst
 * freezes the page during voice sampling, the interview intro, and every spoken
 * question. Callers fall back to other TTS while the model loads or if it can't
 * run. Pure helpers (voice list, wasm base path) live in `kokoroShared.ts` so
 * they stay unit-testable and worker-safe; playback lives in `kokoroAudio.ts`.
 */

import {
  DEFAULT_KOKORO_VOICE,
  KOKORO_VOICES,
  isKokoroVoice,
  kokoroWasmBase,
  type KokoroVoice,
} from "./kokoroShared";

// Re-export the shared public surface so existing importers (and the unit test)
// keep importing from "@/services/kokoroTts" unchanged.
export { DEFAULT_KOKORO_VOICE, KOKORO_VOICES, isKokoroVoice, kokoroWasmBase, type KokoroVoice };

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
// Set once we've given up on WebGPU for this session and pinned the worker to CPU.
let forceCpu = false;
let readyTimer: ReturnType<typeof setTimeout> | null = null;

// The worker has this long to report `ready` before we assume its WebGPU bring-up is
// wedged (some drivers compile ORT's shader pipelines pathologically slowly, or hang),
// terminate it, and respawn pinned to the CPU q8 path. Terminating is the only reliable
// way to abandon stuck GPU work — it can't be cancelled from inside the worker.
// Generous enough for a healthy GPU's first shader-compile + model download, short
// enough that a stuck driver doesn't leave the interviewer mute for long. Kokoro
// preloads on the setup screen, so this normally overlaps time the user already spends.
const WORKER_READY_DEADLINE_MS = 30_000;

// Resolves when whichever worker reports the model ready; rejects only if it can't
// load at all. Created once and REUSED across respawns, so awaiters resolve when the
// CPU worker becomes ready even if the original GPU worker was torn down.
let readyPromise: Promise<void> | null = null;
let resolveReady: (() => void) | null = null;
let rejectReady: ((e: unknown) => void) | null = null;

let nextId = 1;
const pending = new Map<
  number,
  {
    resolve: (r: { samples: Float32Array; sampleRate: number }) => void;
    reject: (e: unknown) => void;
  }
>();

function failPending(err: unknown) {
  for (const { reject } of pending.values()) reject(err);
  pending.clear();
}

function clearReadyTimer() {
  if (readyTimer !== null) {
    clearTimeout(readyTimer);
    readyTimer = null;
  }
}

// Transformers.js caches the ~80–330MB model weights in the Cache API, but that
// storage is *best-effort* — browsers evict it under pressure, so a returning user
// re-downloads the whole model. Requesting persistent storage marks the origin as
// non-evictable, turning repeat interviews into a warm start (and saving the user's
// bandwidth). Fire-and-forget, once, at first load; harmless where unsupported.
let persistRequested = false;
function requestPersistentStorage() {
  if (persistRequested) return;
  persistRequested = true;
  try {
    const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
    storage?.persist?.().catch(() => { /* best-effort */ });
  } catch { /* ignore */ }
}

/** Build the inference worker and wire up its message/error handlers. */
function spawnWorker(): Worker | null {
  if (failed || typeof Worker === "undefined") return null;
  let w: Worker;
  try {
    w = new Worker(new URL("./kokoroWorker.ts", import.meta.url), { type: "module" });
  } catch {
    failed = true;
    return null;
  }
  w.onmessage = (e: MessageEvent<OutboundMsg>) => {
    const msg = e.data;
    if (msg.type === "ready") {
      ready = true;
      clearReadyTimer();
      resolveReady?.();
    } else if (msg.type === "loadfailed") {
      failed = true;
      clearReadyTimer();
      const err = new Error("Kokoro unavailable");
      rejectReady?.(err);
      failPending(err);
    } else if (msg.type === "result") {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.resolve({ samples: msg.samples, sampleRate: msg.sampleRate });
      }
    } else if (msg.type === "error") {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.reject(new Error(msg.message));
      }
    }
  };
  w.onerror = () => {
    // A crash before the model is ready is just another way the GPU path can fail —
    // respawn on CPU instead of giving up. After that (or once ready), it's fatal.
    if (!ready && !failed && !forceCpu) {
      restartOnCpu();
      return;
    }
    failed = true;
    clearReadyTimer();
    const err = new Error("Kokoro worker crashed");
    rejectReady?.(err);
    failPending(err);
  };
  return w;
}

/** Terminate a worker whose GPU bring-up wedged and respawn it pinned to CPU q8. */
function restartOnCpu() {
  clearReadyTimer();
  forceCpu = true;
  try {
    worker?.terminate();
  } catch {
    /* ignore */
  }
  worker = null;
  loadRequested = false;
  // Drop any in-flight generates; this only fires during the initial bring-up it
  // guards (the deadline is cleared once ready), when there are none in flight.
  failPending(new Error("Kokoro restarted on CPU"));
  ensureLoad();
}

/** Lazily create the inference worker. Returns null where Workers aren't available (SSR/tests). */
function getWorker(): Worker | null {
  if (worker) return worker;
  worker = spawnWorker();
  return worker;
}

/** Ensure the worker exists and has been asked to load the model (idempotent). */
function ensureLoad(): Worker | null {
  if (!readyPromise) {
    readyPromise = new Promise<void>((res, rej) => {
      resolveReady = res;
      rejectReady = rej;
    });
  }
  const w = getWorker();
  if (!w) return null;
  if (!loadRequested) {
    loadRequested = true;
    requestPersistentStorage();
    w.postMessage({ type: "load", forceCpu });
    // Only the WebGPU path can wedge, and the worker only takes it when the page is
    // NOT cross-origin isolated (isolated → straight to multi-threaded q8 WASM). So
    // arm the watchdog only then; isolated and already-forced-CPU loads can't wedge.
    const isolated = typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
    if (!forceCpu && !isolated) {
      clearReadyTimer();
      readyTimer = setTimeout(() => {
        if (!ready && !failed) restartOnCpu();
      }, WORKER_READY_DEADLINE_MS);
    }
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
 * Synthesize `text` in `voice` to raw mono `Float32` samples, with inference
 * running in the worker so the UI never freezes. Callers play the samples
 * directly through the Web Audio API (see `kokoroAudio.ts`) — no WAV encode.
 * @throws KokoroLoadingError if not loaded yet and waitForLoad is false
 * @throws Error if Kokoro can't run at all
 */
export async function kokoroGenerateSamples(
  text: string,
  voice: string,
  opts: { waitForLoad?: boolean } = {},
): Promise<{ samples: Float32Array; sampleRate: number }> {
  if (failed) throw new Error("Kokoro unavailable");
  if (!ensureLoad()) throw new Error("Kokoro unavailable");

  if (!ready) {
    if (!opts.waitForLoad) throw new KokoroLoadingError("Kokoro model is loading");
    // Wait for the worker to finish loading (rejects → "Kokoro unavailable").
    await readyPromise;
  }

  // Re-read the worker AFTER awaiting: a wedged GPU bring-up may have terminated the
  // original worker and respawned a CPU one while we waited.
  const w = worker;
  if (!w) throw new Error("Kokoro unavailable");
  const id = nextId++;
  return new Promise<{ samples: Float32Array; sampleRate: number }>(
    (resolve, reject) => {
      pending.set(id, { resolve, reject });
      w.postMessage({ type: "generate", id, text, voice });
    },
  );
}
