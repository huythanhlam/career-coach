import { describe, it, expect, vi } from "vitest";
import {
  nextStartTime,
  MIN_LEAD_S,
  samplesToAudioBuffer,
  playKokoroSample,
  stopKokoroSample,
} from "./kokoroAudio";

describe("nextStartTime", () => {
  it("starts the first clip just ahead of now (cursor at 0 / silence)", () => {
    expect(nextStartTime(5, 0, MIN_LEAD_S)).toBeCloseTo(5 + MIN_LEAD_S);
  });

  it("continues gaplessly at the cursor while a previous clip is still playing", () => {
    expect(nextStartTime(5, 8, MIN_LEAD_S)).toBe(8);
  });

  it("re-leads when the cursor has fallen behind now (generation lagged)", () => {
    expect(nextStartTime(10, 8, MIN_LEAD_S)).toBeCloseTo(10 + MIN_LEAD_S);
  });

  it("leads when the cursor exactly equals now", () => {
    expect(nextStartTime(5, 5, MIN_LEAD_S)).toBeCloseTo(5 + MIN_LEAD_S);
  });
});

// A minimal fake AudioContext good enough to drive the preview helpers without a
// real Web Audio implementation (vitest runs in the node environment).
function fakeContext() {
  const started: FakeSource[] = [];
  interface FakeSource {
    buffer: unknown;
    onended: (() => void) | null;
    connect: () => void;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }
  const ctx = {
    currentTime: 0,
    destination: {},
    createBuffer: (_ch: number, length: number, sampleRate: number) => ({
      length,
      sampleRate,
      copyToChannel: vi.fn(),
    }),
    createBufferSource: (): FakeSource => {
      const src: FakeSource = {
        buffer: null,
        onended: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      started.push(src);
      return src;
    },
    started,
  };
  return ctx as unknown as AudioContext & { started: FakeSource[] };
}

describe("samplesToAudioBuffer", () => {
  it("copies mono samples into a buffer of the right length/rate", () => {
    const c = fakeContext();
    const buf = samplesToAudioBuffer(c, new Float32Array([0.1, -0.2, 0.3]), 24000);
    expect((buf as unknown as { length: number }).length).toBe(3);
    expect((buf as unknown as { sampleRate: number }).sampleRate).toBe(24000);
  });
});

describe("playKokoroSample", () => {
  it("resolves immediately with no context and no samples", async () => {
    await expect(playKokoroSample(new Float32Array([1]), 24000, null)).resolves.toBeUndefined();
    const c = fakeContext();
    await expect(playKokoroSample(new Float32Array([]), 24000, c)).resolves.toBeUndefined();
    expect(c.started.length).toBe(0); // empty samples never allocate a source
  });

  it("starts a source and resolves when it ends", async () => {
    const c = fakeContext();
    const done = playKokoroSample(new Float32Array([0.5, 0.5]), 24000, c);
    expect(c.started.length).toBe(1);
    expect(c.started[0].start).toHaveBeenCalled();
    c.started[0].onended?.(); // simulate playback finishing
    await expect(done).resolves.toBeUndefined();
  });

  it("stops the previous preview when a new one starts (no overlap)", () => {
    const c = fakeContext();
    void playKokoroSample(new Float32Array([0.5]), 24000, c);
    void playKokoroSample(new Float32Array([0.5]), 24000, c);
    // The first source is stopped before the second plays.
    expect(c.started[0].stop).toHaveBeenCalled();
    expect(c.started[1].stop).not.toHaveBeenCalled();
    stopKokoroSample();
    expect(c.started[1].stop).toHaveBeenCalled();
  });
});
