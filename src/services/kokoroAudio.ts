/**
 * Shared Web Audio playback for Kokoro. Plays kokoro-js's raw `Float32` samples
 * directly through a single `AudioContext`, replacing the old per-sentence
 * WAV-encode → Blob → `<audio>`-decode round-trip. Web Audio consumes `Float32`
 * natively, so this also sidesteps the scratchy-32-bit-float `<audio>` playback
 * bug that the removed `encodePcm16Wav` used to work around, and it lets the
 * sentence-ahead pipeline schedule clips back-to-back for GAPLESS playback.
 *
 * Two consumers:
 *   - the interview/negotiation pipeline (`useSpeech`) schedules a sequence of
 *     clips on a running cursor for gapless joins;
 *   - the setup-screen voice preview plays a single stoppable one-shot.
 *
 * Pure helpers (`nextStartTime`) and the context accessors are unit-testable; a
 * fake `AudioContext` can be injected where a real one isn't available (tests).
 */

/** Small lead so a clip scheduled into silence never starts in the past. */
export const MIN_LEAD_S = 0.03;

let ctx: AudioContext | null = null;
let ctxUnavailable = false;

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Lazily create the shared AudioContext; `null` in SSR/tests or where unsupported. */
export function getAudioContext(): AudioContext | null {
  if (ctx || ctxUnavailable) return ctx;
  const Ctor = audioContextCtor();
  if (!Ctor) { ctxUnavailable = true; return null; }
  try { ctx = new Ctor(); } catch { ctxUnavailable = true; }
  return ctx;
}

/**
 * Resume a suspended context. Browsers start it `suspended` until a user gesture,
 * so call this from the click that starts a session / samples a voice.
 */
export function resumeAudioContext(): void {
  const c = getAudioContext();
  if (c && c.state === "suspended") c.resume().catch(() => { /* best-effort */ });
}

/** Copy mono `Float32` samples into an `AudioBuffer` on `c`. */
export function samplesToAudioBuffer(
  c: AudioContext, samples: Float32Array, sampleRate: number,
): AudioBuffer {
  const buf = c.createBuffer(1, samples.length, sampleRate);
  buf.copyToChannel(samples, 0);
  return buf;
}

/**
 * Gapless start time for the next clip: continue exactly at the running `cursor`
 * when the previous clip is still playing, otherwise start just ahead of `now`
 * so we never schedule in the past (a gap only appears if generation fell behind
 * playback, which is unavoidable and preferable to a glitch).
 */
export function nextStartTime(now: number, cursor: number, minLead: number): number {
  return cursor > now ? cursor : now + minLead;
}

// ── Single-clip voice preview (setup screen) ───────────────────────────────
let previewNode: AudioBufferSourceNode | null = null;

/** Stop any in-flight voice preview so previews never overlap. */
export function stopKokoroSample(): void {
  if (previewNode) {
    try { previewNode.onended = null; previewNode.stop(); } catch { /* ignore */ }
    previewNode = null;
  }
}

/**
 * Play a one-shot voice-preview clip, stopping any previous preview first.
 * Resolves when it finishes (or immediately where Web Audio is unavailable).
 * `c` is injectable for tests; defaults to the shared context.
 */
export function playKokoroSample(
  samples: Float32Array,
  sampleRate: number,
  c: AudioContext | null = getAudioContext(),
): Promise<void> {
  if (!c || samples.length === 0) return Promise.resolve();
  stopKokoroSample();
  return new Promise<void>((resolve) => {
    const src = c.createBufferSource();
    src.buffer = samplesToAudioBuffer(c, samples, sampleRate);
    src.connect(c.destination);
    previewNode = src;
    const finish = () => { if (previewNode === src) previewNode = null; resolve(); };
    src.onended = finish;
    try { src.start(); } catch { finish(); }
  });
}
