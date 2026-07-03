/**
 * Web Worker that hosts Kokoro TTS and runs ONNX inference OFF the main thread.
 *
 * Why a worker: kokoro-js's `generate()` is a long burst of compute (a sync CPU
 * burst on the WASM backend; a GPU dispatch + readback on WebGPU). On the main
 * thread that blocks the event loop — the page freezes during voice sampling, the
 * interview intro, and every spoken question, plus the one-time model download and
 * graph compile. Moving it here keeps the UI thread responsive: only this worker
 * thread blocks while audio synthesizes. The backend itself (WebGPU → multi-thread
 * WASM → single-thread WASM) is chosen in load() for the fastest available path.
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

// `forceCpu` pins this worker to the CPU q8 path, skipping WebGPU. The main-thread
// client sets it when respawning a worker whose GPU bring-up wedged (see kokoroTts.ts).
type LoadMsg = { type: "load"; forceCpu?: boolean };
type GenerateMsg = { type: "generate"; id: number; text: string; voice: string };
type InboundMsg = LoadMsg | GenerateMsg;

// `self` in a module worker is the DedicatedWorkerGlobalScope, but this project
// compiles with the DOM lib (not WebWorker), so reach postMessage through a
// narrow cast to avoid the Window.postMessage signature clash.
const post = (msg: unknown, transfer?: Transferable[]) =>
  (
    globalThis as unknown as {
      postMessage: (m: unknown, t?: Transferable[]) => void;
    }
  ).postMessage(msg, transfer);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsPromise: Promise<any> | null = null;
let warmed = false;

async function load(forceCpu: boolean) {
  const [{ KokoroTTS }, { env }] = await Promise.all([
    import("kokoro-js"),
    import("@huggingface/transformers"),
  ]);
  // Serve the ONNX runtime WASM from our own origin instead of the jsDelivr CDN
  // (see kokoroWasmBase). Must be set before from_pretrained, which is when ORT
  // resolves wasmPaths and dynamically imports the runtime glue.
  const isolated = typeof crossOriginIsolated !== "undefined" && crossOriginIsolated;
  const wasm = env.backends?.onnx?.wasm;
  if (wasm) {
    wasm.wasmPaths = kokoroWasmBase(import.meta.env.BASE_URL);
    // Run the CPU (WASM) path multi-threaded so a sentence synthesizes FASTER than it
    // plays — that's what keeps the sentence-ahead pipeline in useSpeech fed and
    // eliminates the long gaps between spoken sentences. WASM threads need
    // SharedArrayBuffer, which the browser only exposes when the page is cross-origin
    // isolated (COOP+COEP headers — see vite.config.ts / vercel.json). Without it
    // (e.g. Safari, which lacks COEP: credentialless) we stay single-threaded: slower,
    // but it still works. Cap threads to avoid oversubscribing.
    const cores =
      typeof navigator !== "undefined" && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 4;
    wasm.numThreads = isolated ? Math.max(1, Math.min(cores, 8)) : 1;
  }

  // Backend priority — only CLEAN-SOUNDING Kokoro weights are used (fp16 and q4f16 are
  // audibly distorted, so neither is an option):
  //   1. Multi-threaded WASM q8 when the page is cross-origin isolated — the SAME clean
  //      q8 voice as before, just parallelized. Small (~86 MB), no GPU, no precision
  //      artifacts, and fast enough to outrun playback on a typical multi-core machine.
  //   2. WebGPU q8 when NOT isolated but a GPU is available — the SAME clean q8 weights
  //      as the CPU path (~86 MB) rather than fp32 (~330 MB), so browsers like Safari that
  //      can't be cross-origin isolated here download ~4x less on first use. (fp16/q4f16
  //      are audibly distorted; q8 is the smallest clean option and is proven clean on
  //      the CPU path — see the WebGPU verification note on tryWebgpu.)
  //   3. Single-threaded WASM q8 otherwise — clean but slow (the original path).
  //
  // We only reach WebGPU when NOT isolated, so cross-origin-isolated users never touch
  // it — sidestepping the drivers that compile ORT's WebGPU pipelines pathologically
  // slowly. For the browsers that do use it, a wedged bring-up can't be cancelled from
  // inside the worker, so the main-thread client times it out and respawns us with
  // `forceCpu` (see kokoroTts.ts), landing on the single-threaded q8 path below.
  if (!forceCpu && !isolated) {
    const gpuTts = await tryWebgpu(KokoroTTS);
    if (gpuTts) return gpuTts;
  }
  return KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "wasm" });
}

/**
 * Try to bring up Kokoro on WebGPU with the clean q8 weights, proving it can actually
 * synthesize. Returns the ready TTS, or null to fall back to CPU on no GPU or a
 * load/inference error. If the GPU path instead HANGS, this never resolves — the
 * client's ready-deadline terminates and respawns the worker with forceCpu, which is
 * the only reliable way to abandon stuck GPU work. (Integer q8 runs on any WebGPU
 * adapter, so like fp32 it needs no shader-f16 feature check.)
 *
 * VERIFICATION GATE: q8 replaces fp32 here to cut Safari's first-load download ~4x.
 * The prove-it-synthesizes generate below guards adapters that init but can't run the
 * graph — but it does NOT guard against (a) q8 sounding worse than fp32 on the ORT
 * WebGPU/JSEP backend, or (b) ORT silently running the quantized ops on CPU (no byte
 * saving). Before merging, confirm on a non-cross-origin-isolated browser (Safari, or
 * Chrome with COOP/COEP stripped) that the voice is clean AND the transferred model
 * bytes actually drop. If either fails, revert this to `dtype: "fp32"`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryWebgpu(KokoroTTS: any): Promise<any | null> {
  try {
    const gpu = (
      navigator as unknown as {
        gpu?: { requestAdapter?: () => Promise<unknown | null> };
      }
    ).gpu;
    if (!gpu?.requestAdapter) return null;
    if (!(await gpu.requestAdapter())) return null;

    const tts = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: "q8", device: "webgpu" });
    // Some adapters initialize but can't actually run the graph; prove it
    // synthesizes once (this doubles as the warm-up) before committing to it.
    await tts.generate("Hello.", { voice: DEFAULT_KOKORO_VOICE });
    warmed = true;
    return tts;
  } catch {
    // GPU path unusable on this device — fall through to the CPU path.
    return null;
  }
}

function ensureLoad(forceCpu = false) {
  if (!ttsPromise) {
    // On failure, clear the promise so a later message retries the load instead
    // of being stuck on a rejected promise forever.
    ttsPromise = load(forceCpu).catch((e) => {
      ttsPromise = null;
      throw e;
    });
  }
  return ttsPromise;
}

addEventListener("message", async (event: MessageEvent<InboundMsg>) => {
  const msg = event.data;

  if (msg.type === "load") {
    try {
      const tts = await ensureLoad(msg.forceCpu);
      post({ type: "ready" });
      // One-time warm-up so the first real sentence doesn't pay graph-compile
      // cost. Harmless if it fails — the next real generate surfaces any issue.
      if (!warmed) {
        warmed = true;
        try {
          await tts.generate("Hello.", { voice: DEFAULT_KOKORO_VOICE });
        } catch {
          /* ignore */
        }
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
        post({ type: "result", id, samples, sampleRate: audio.sampling_rate ?? 24000 }, [
          samples.buffer,
        ]);
      } else {
        // kokoro-js v1.2 always returns a Float32 `audio`; guard the unexpected.
        post({ type: "error", id, message: "Unexpected Kokoro audio shape" });
      }
    } catch (err) {
      post({ type: "error", id, message: err instanceof Error ? err.message : String(err) });
    }
  }
});
