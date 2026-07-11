import { describe, expect, it } from "vitest";

import { wrapPcm16AsWav } from "./pcmWav";

describe("wrapPcm16AsWav", () => {
  it("prepends a 44-byte RIFF/WAVE header before the PCM bytes", () => {
    const pcm = new Uint8Array([1, 2, 3, 4]);
    const wav = wrapPcm16AsWav(pcm, 24000);
    expect(wav.length).toBe(44 + pcm.length);
    expect(wav.slice(44)).toEqual(pcm);
  });

  it("writes the RIFF/WAVE/fmt/data chunk markers", () => {
    const wav = wrapPcm16AsWav(new Uint8Array([0, 0]), 24000);
    const text = (start: number, len: number) =>
      String.fromCharCode(...wav.slice(start, start + len));
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(text(12, 4)).toBe("fmt ");
    expect(text(36, 4)).toBe("data");
  });

  it("declares mono, 16-bit PCM at the given sample rate", () => {
    const wav = wrapPcm16AsWav(new Uint8Array(10), 24000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getUint16(20, true)).toBe(1); // PCM format
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(24000); // sample rate
    expect(view.getUint16(32, true)).toBe(2); // block align (mono * 16-bit)
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
  });

  it("records the RIFF and data chunk sizes relative to the PCM byte length", () => {
    const pcm = new Uint8Array(100);
    const wav = wrapPcm16AsWav(pcm, 24000);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getUint32(4, true)).toBe(36 + pcm.length);
    expect(view.getUint32(40, true)).toBe(pcm.length);
  });

  it("handles empty PCM input without throwing", () => {
    const wav = wrapPcm16AsWav(new Uint8Array(0), 24000);
    expect(wav.length).toBe(44);
  });
});
