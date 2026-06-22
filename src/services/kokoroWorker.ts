/**
 * Web Worker that hosts Kokoro TTS and runs ONNX inference OFF the main thread.
 *
 * Why a worker: kokoro-js runs on the ONNX Runtime WASM (CPU) backend, whose
 * `generate()` is a long synchronous burst of compute. On the main thread that
 * burst blocks the event loop — the page freezes during voice sampling, the
 * interview intro, and every spoken question, plus the one-time model download
 * and graph compile. Moving it here keeps the UI thread responsive: only this
 * worker thread blocks while audio synthesizes.
 *
 * Protocol (main ↔ worker):
 *   main → { type: "load" }                       ensure model is loaded (+ warm)
 *   main → { type: "generate", id, text, voice }  synthesize one chunk
 *   worker → { type: "ready" }                    model loaded and ready
 *   worker → { type: "loadfailed" }               model can't run at all
 *   worker → { type: "result", id, samples, sampleRate }   Float32 mono samples
 *   worker → { type: "error", id, message }       this generate failed
 *
 * Raw Float32 samples (not an encoded WAV) cross the boundary as a transferable
 * ArrayBuffer; the cheap PCM-16 WAV encoding happens on the main thread.
 */

import { DEFAULT_KOKORO_VOICE, MODEL_ID, kokoroWasmBase } from "./kokoroShared";

type LoadMsg = { type: "load" };
type GenerateMsg = { type: "generate"; id: number; text: string; voice: string };
type InboundMsg = LoadMsg | GenerateMsg;

// `self` in a module worker is the DedicatedWorkerGlobalScope, but this project
// compiles with the DOM lib (not WebWorker), so reach postMessage through a
// narrow cast to avoid the Window.postMessage signature clash.
const post = (msg: unknown, transfer?: Transferable[]) =>
  (globalThis as unknown as {
    postMessage: (m: unknown, t?: Transferable[]) => void;
  }).postMessage(msg, transfer);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsPromise: Promise<any> | null = null;
let warmed = false;

async function load() {
  const [{ KokoroTTS }, { env }] = await Promise.all([
    import("kokoro-js"),
    import("@huggingface/transformers"),
  ]);
  // Serve the ONNX runtime WASM from our own origin instead of the jsDelivr CDN
  // (see kokoroWasmBase). Must be set before from_pretrained, which is when ORT
  // resolves wasmPaths and dynamically imports the runtime glue.
  const wasm = env.backends?.onnx?.wasm;
  if (wasm) {
    wasm.wasmPaths = kokoroWasmBase(import.meta.env.BASE_URL);
  }
  // Run on WASM (CPU) with q8 (8-bit) weights — deliberately NOT WebGPU. WebGPU's
  // q4f16 (4-bit) weights make the voice audibly distorted, and kokoro-js's
  // recommended WebGPU dtype, fp32, is a ~330 MB download. q8 is ~90 MB, sounds
  // clean, runs in every browser, and the short interviewer lines synthesize fast
  // enough on CPU — especially now that synthesis runs in this worker. The
  // browser caches the weights after the first download.
  return KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "wasm" });
}

function ensureLoad() {
  if (!ttsPromise) {
    // On failure, clear the promise so a later message retries the load instead
    // of being stuck on a rejected promise forever.
    ttsPromise = load().catch((e) => { ttsPromise = null; throw e; });
  }
  return ttsPromise;
}

addEventListener("message", async (event: MessageEvent<InboundMsg>) => {
  const msg = event.data;

  if (msg.type === "load") {
    try {
      const tts = await ensureLoad();
      post({ type: "ready" });
      // One-time warm-up so the first real sentence doesn't pay graph-compile
      // cost. Harmless if it fails — the next real generate surfaces any issue.
      if (!warmed) {
        warmed = true;
        try { await tts.generate("Hello.", { voice: DEFAULT_KOKORO_VOICE }); } catch { /* ignore */ }
      }
    } catch {
      post({ type: "loadfailed" });
    }
    return;
  }

  if (msg.type === "generate") {
    const { id, text, voice } = msg;
    try {
      const tts = await ensureLoad();
      const audio = await tts.generate(text, { voice });
      if (audio?.audio instanceof Float32Array) {
        const samples: Float32Array = audio.audio;
        post(
          { type: "result", id, samples, sampleRate: audio.sampling_rate ?? 24000 },
          [samples.buffer],
        );
      } else {
        // kokoro-js v1.2 always returns a Float32 `audio`; guard the unexpected.
        post({ type: "error", id, message: "Unexpected Kokoro audio shape" });
      }
    } catch (err) {
      post({ type: "error", id, message: err instanceof Error ? err.message : String(err) });
    }
  }
});
