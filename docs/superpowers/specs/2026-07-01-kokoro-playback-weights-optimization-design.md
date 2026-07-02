# Kokoro TTS Playback & Weights Optimization — Design

**Date:** 2026-07-01
**Status:** Approved

## Goal
Two independent performance improvements to the in-browser **Kokoro** voice, following the quick wins in [PR #77](https://github.com/huythanhlam/career-coach/pull/77):

1. **Web Audio playback** — play Kokoro's raw `Float32` samples directly through a shared **`AudioContext`**, removing the per-sentence **WAV-encode → Blob → `<audio>`-decode** round-trip and enabling **gapless** sentence-to-sentence scheduling.
2. **q8 weights on WebGPU** — attempt the clean **q8** weights on the WebGPU path instead of **fp32**, cutting the one-time download for non-cross-origin-isolated browsers (notably **Safari**) from **~330MB to ~80MB**.

User-visible outcome: the interviewer/recruiter voice starts marginally faster, plays back without the seams between pipelined sentences, and (if #2 verifies) costs Safari users ~4× less bandwidth on first use.

## Why (problem with the current approach)

**Playback path today.** The worker returns raw mono `Float32Array` samples ([kokoroWorker.ts:153](../../../src/services/kokoroWorker.ts)). On the main thread, `kokoroGenerate` re-encodes them to a 16-bit PCM WAV `Blob` via `encodePcm16Wav` ([kokoroShared.ts:57](../../../src/services/kokoroShared.ts)), and `useSpeech` plays that Blob through an `HTMLAudioElement` + `URL.createObjectURL` ([useSpeech.ts:85](../../../src/hooks/useSpeech.ts)). So every sentence pays: an O(n) WAV encode, a Blob + object-URL allocation, and a full container **decode** inside the `<audio>` element — only to play back samples we already had decoded in memory. The `encodePcm16Wav` step exists purely to dodge a bug where kokoro-js's native 32-bit-float WAV plays scratchy through `<audio>` on some browsers; the Web Audio API consumes `Float32` natively and sidesteps that bug entirely, making the whole encode/decode detour unnecessary. `<audio>` also gives no control over inter-clip timing, so pipelined sentences ([useSpeech.ts:108](../../../src/hooks/useSpeech.ts)) have an audible seam.

**WebGPU weights today.** When the page is **not** cross-origin isolated (Safari lacks COEP `credentialless`), the worker loads Kokoro on WebGPU with **fp32** weights — a ~330MB download ([kokoroWorker.ts:108](../../../src/services/kokoroWorker.ts)). fp32 was chosen because the code documents fp16/q4f16 as audibly distorted. But the CPU path already proves **q8 is clean** (`dtype: "q8"`, [kokoroWorker.ts:88](../../../src/services/kokoroWorker.ts)) at ~80MB. If q8 runs acceptably on the ONNX Runtime WebGPU (JSEP) backend, Safari's first-load download and time-to-ready shrink ~4×.

## Design

Two independently shippable components. #1 is a deterministic refactor; #2 is a verification-gated spike.

### 1. Web Audio playback for Kokoro

**1a. Shared audio context — `src/services/kokoroAudio.ts` (new).**
A tiny module owning one lazily-created `AudioContext` (browsers cap the count) plus scheduling helpers:
- `getAudioContext(): AudioContext | null` — lazily construct; return `null` in SSR/tests (no `AudioContext`).
- `resumeAudioContext(): void` — call from the user gesture that starts a session (`handleStart` / send), since a context created before a gesture starts `suspended`.
- `samplesToAudioBuffer(ctx, samples, sampleRate): AudioBuffer` — allocate a mono buffer and `copyToChannel`.
- A pure helper `nextStartTime(now, cursor, minLead)` (exported) that computes the gapless start time for the next clip given the context clock — this is the one piece worth unit-testing without a real context.

**1b. Worker/client return raw samples — `src/services/kokoroTts.ts`.**
Replace `kokoroGenerate(...) → Blob` with `kokoroGenerateSamples(text, voice, opts): Promise<{ samples: Float32Array; sampleRate: number }>` returning the worker's samples unchanged (the worker already posts `{ samples, sampleRate }` — no worker change needed). **Both** consumers (the interview pipeline and the voice preview) move to the shared context, so the Blob path has no remaining Kokoro caller — `kokoroGenerate` and `encodePcm16Wav` (plus its unit test) are deleted. The remote `/api/tts` backend never used `encodePcm16Wav` (it returns its own encoded audio), so nothing else depends on it.

**1c. Playback in `useSpeech.ts`.**
Replace `playBlobAwait` for the Kokoro branch with `playSamplesAwait(samples, sampleRate, token)` that: creates an `AudioBufferSourceNode`, schedules it at `nextStartTime(...)` on the shared context for gapless joins, resolves on `onended`, and is interruptible by `cancel()` (track live nodes; `stop()` them, mirroring how `stopAudio()` pauses the `<audio>` element today). `speakKokoroStreaming` switches from `kokoroGenerate` to `kokoroGenerateSamples`. The remote-backend branch ([useSpeech.ts:172](../../../src/hooks/useSpeech.ts)) and the browser-speech branch are unchanged — remote backends already return an encoded audio `Blob`, so `playBlobAwait` stays for them.

**1d. Voice preview — `MockInterviewWorkspace.tsx` / `NegotiationRoleplayWorkspace.tsx`.**
`sampleVoice` currently synthesizes via `kokoroGenerate` and plays the Blob through a private `sampleAudioRef` `<audio>` element ([MockInterviewWorkspace.tsx:562](../../../src/components/MockInterviewWorkspace.tsx), [NegotiationRoleplayWorkspace.tsx](../../../src/components/NegotiationRoleplayWorkspace.tsx)). Move both onto the shared context: call `kokoroGenerateSamples` and play through a `kokoroAudio` helper that exposes a **stoppable one-shot** (`playSampleAwait(samples, sampleRate)`) so previews still don't overlap (today's `stopSample()` semantics) and the in-progress interviewer voice is still cancelled first. This removes `sampleAudioRef`/`stopSample` in favor of the shared player's stop, and is what lets `encodePcm16Wav` go away (1b).

**No data-model, gateway, or GitHub-workflow changes.** This is entirely client-side; no Gemini calls, no `server.ts`/Edge Function, no migration, no RLS.

### 2. q8 weights on WebGPU (verification-gated)

**2a. Spike — `src/services/kokoroWorker.ts`.**
In `tryWebgpu`, change `dtype: "fp32"` → `dtype: "q8"` ([kokoroWorker.ts:108](../../../src/services/kokoroWorker.ts)). The existing prove-it-synthesizes warm-up generate (`tts.generate("Hello.")`) already guards adapters that initialize but can't run the graph, and the CPU fallback already catches a thrown load — so the failure path is covered.

**2b. Verification gate (must pass before merge).** Because q8 on the ORT WebGPU/JSEP backend can either (a) sound distorted or (b) silently fall back to CPU for quantized ops — negating the benefit — this change ships **only if** a manual check on a non-isolated browser (Safari, or Chrome with COOP/COEP stripped) confirms **both**: the voice is clean to the ear, and the transferred model bytes actually drop (DevTools Network / `about:webgpu`). If either fails, keep fp32 and record the finding in the PR; #1 ships regardless.

**No data-model, gateway, or GitHub-workflow changes.**

## Testing

- **`nextStartTime` (1a)** — pure vitest unit tests (node env): first clip starts at `now + minLead`; a clip queued while the previous still plays starts at the running cursor, not `now`; a clip queued into silence starts at `now + minLead`. No `AudioContext` needed.
- **`splitForSpeech`** — already covered by `src/hooks/useSpeech.test.ts` (from #77); unaffected.
- **Playback wiring (1c/1d)** — extract the pure/decidable logic into `nextStartTime` and the live-node bookkeeping; assert cancellation clears tracked nodes and that a new preview stops the prior one, via a minimal fake `AudioContext`/`AudioBufferSourceNode` (plain objects with `stop`/`onended`), injected so no real Web Audio is required in the node test env. Full audio output stays a manual check.
- **Deletion (1b)** — `encodePcm16Wav` has no unit test and its only caller is `kokoroGenerate` (confirmed by `grep encodePcm16Wav`), so removing both is self-contained; the grep after deletion should return no hits.
- **q8 WebGPU (2)** — no unit test; the acceptance criterion is the manual verification gate in 2b. Optionally assert the worker requests `dtype: "q8"` on both paths to prevent an accidental fp32 regression.

## Out of scope
- Any change to the remote `/api/tts` backend, its transport, or the browser Web Speech fallback.
- A persistent service-worker precache of the weights (a separate, larger follow-up to #77's `navigator.storage.persist()` win).
- Deeper prefetch (>1 sentence ahead), new voices, multi-speaker, or any Gemini-TTS migration.
- Adding q8 to the *cross-origin-isolated* path — that path already runs clean multi-threaded q8 WASM and does not touch WebGPU.
