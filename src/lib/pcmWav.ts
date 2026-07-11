/**
 * Wrap raw 16-bit PCM bytes (mono) in a WAV container. Gemini TTS returns
 * audio already encoded as int16 PCM, so — unlike Kokoro's float32 output —
 * no sample-format conversion is needed here, just a 44-byte RIFF header.
 */
export function wrapPcm16AsWav(pcmBytes: Uint8Array, sampleRate: number): Uint8Array {
  const n = pcmBytes.length;
  const out = new Uint8Array(44 + n);
  const view = new DataView(out.buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + n, true);
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
  view.setUint32(40, n, true);
  out.set(pcmBytes, 44);
  return out;
}
