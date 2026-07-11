import { useCallback, useEffect, useRef, useState } from "react";
import { stripMarkdown } from "@/lib/speechText";
import { pickVoice } from "@/lib/voicePick";
import { synthesizeSpeech, TtsUnavailableError } from "@/services/ttsService";

/**
 * Speak text aloud for the interview agent. Voice priority:
 *   1. Gemini TTS via the gateway (server.ts dev / ai-gateway prod).
 *   2. The browser's Web Speech API (best installed voice, chunked, warm prosody).
 *
 * Latency: short Gemini TTS replies (see `chunksForSpeech`) are synthesized as
 * a single clip — no inter-sentence network round-trips. Longer replies are
 * split and pipelined — the first chunk starts playing while the rest
 * generate in the background — so time-to-first-audio stays low even for a
 * long response.
 *
 * `speak(text, { voice, onEnd })` calls `onEnd` when playback finishes naturally
 * (not on cancel) so the caller can resume a hands-free conversation.
 */

// Time-to-first-audio is gated by generating chunk 0, so if the first chunk is a
// long sentence, break it at its first clause boundary (comma/semicolon/colon) —
// the interviewer starts talking sooner and the pipeline hides the rest. Keep a
// minimum so we never isolate a tiny opener ("Hi,"), and only bother past a length
// where the latency saving is worth the extra prosody break.
const FIRST_CHUNK_SPLIT_MIN = 24;
const FIRST_CHUNK_SPLIT_MAX = 90;

/** Break text into short, natural speech chunks (≈ one sentence each). */
export function splitForSpeech(text: string): string[] {
  const pieces = text.match(/[^.!?\n]+[.!?]*(\s+|$)/g) ?? [text];
  const chunks: string[] = [];
  let buf = "";
  for (const p of pieces) {
    buf += p;
    if (/[.!?]["')\]]?\s*$/.test(p) || buf.trim().length >= 140) {
      const t = buf.trim();
      if (t) chunks.push(t);
      buf = "";
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  if (!chunks.length) return [text];

  if (chunks[0].length > FIRST_CHUNK_SPLIT_MAX) {
    const head = chunks[0];
    const rel = head.slice(FIRST_CHUNK_SPLIT_MIN).search(/[,;:]\s/);
    if (rel !== -1) {
      const cut = FIRST_CHUNK_SPLIT_MIN + rel + 1; // keep the punctuation with the first part
      const first = head.slice(0, cut).trim();
      const rest = head.slice(cut).trim();
      if (first && rest) {
        chunks[0] = rest;
        chunks.unshift(first);
      }
    }
  }
  return chunks;
}

// Below this length, a Gemini TTS reply is spoken as a single clip instead of
// being split per sentence. Most interview questions are 1-3 sentences —
// splitting them buys nothing (each chunk is its own network round-trip to
// Gemini) and risks an audible gap if a later chunk's generation is slower
// than the previous chunk's playback. Longer replies (e.g. end-of-interview
// feedback) still chunk, so time-to-first-audio stays low for those.
const SHORT_REPLY_CHARS = 280;

/** Chunk a Gemini TTS reply: one clip below the threshold, else per-sentence. */
export function chunksForSpeech(text: string): string[] {
  return text.length <= SHORT_REPLY_CHARS ? [text] : splitForSpeech(text);
}

export interface SpeakOptions {
  voice?: string;
  onEnd?: () => void;
}

export function useSpeech() {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  const supported = !!synth;
  const [speaking, setSpeaking] = useState(false);

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Resolver for the currently-playing clip, so cancel() can unblock the queue.
  const audioDoneRef = useRef<(() => void) | null>(null);
  // Bumped on every cancel/new utterance so stale async callbacks bail out.
  const tokenRef = useRef(0);
  const remoteDownRef = useRef(false);

  useEffect(() => {
    if (!synth) return;
    const choose = () => {
      const voices = synth.getVoices();
      if (voices.length) voiceRef.current = pickVoice(voices);
    };
    choose();
    synth.addEventListener?.("voiceschanged", choose);
    return () => synth.removeEventListener?.("voiceschanged", choose);
  }, [synth]);

  const stopAudio = () => {
    const a = audioRef.current;
    if (a) {
      try {
        a.pause();
      } catch {
        /* ignore */
      }
      a.src = "";
      audioRef.current = null;
    }
    audioDoneRef.current?.();
    audioDoneRef.current = null;
  };

  const cancel = useCallback(() => {
    tokenRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    stopAudio();
    try {
      synth?.cancel();
    } catch {
      /* ignore */
    }
    setSpeaking(false);
  }, [synth]);

  /** Play an audio Blob; resolves when it finishes (or is cancelled/errors). */
  const playBlobAwait = useCallback(
    (blob: Blob, token: number) =>
      new Promise<void>((resolve) => {
        if (token !== tokenRef.current) {
          resolve();
          return;
        }
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          URL.revokeObjectURL(url);
          if (audioDoneRef.current === finish) audioDoneRef.current = null;
          resolve();
        };
        audioDoneRef.current = finish;
        audio.onended = finish;
        audio.onerror = finish;
        audio.play().catch(finish);
      }),
    [],
  );

  /**
   * Gemini TTS, pipelined: generate sentence i+1 while sentence i plays, so
   * time-to-first-audio is one short sentence instead of the whole response.
   * Returns false if the backend is unreachable/unconfigured (so the caller
   * falls back to the browser voice); true if it handled playback (incl.
   * cancellation).
   */
  const speakGeminiStreaming = useCallback(
    async (
      clean: string,
      voice: string | undefined,
      token: number,
      onEnd?: () => void,
    ): Promise<boolean> => {
      const chunks = chunksForSpeech(clean);
      const ac = new AbortController();
      abortRef.current = ac;
      let current: Blob;
      try {
        current = await synthesizeSpeech(chunks[0], voice, ac.signal);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return true;
        if (err instanceof TtsUnavailableError) remoteDownRef.current = true;
        return false;
      }
      if (token !== tokenRef.current) return true;
      // Prefetch the 2nd sentence while the 1st plays.
      const genNext = (i: number) =>
        i < chunks.length
          ? synthesizeSpeech(chunks[i], voice, ac.signal).catch(() => null)
          : Promise.resolve(null);
      let nextPromise = genNext(1);
      for (let i = 0; i < chunks.length; i++) {
        await playBlobAwait(current, token);
        if (token !== tokenRef.current) return true;
        if (i + 1 >= chunks.length) break;
        const next = await nextPromise;
        if (token !== tokenRef.current) return true;
        if (!next) break; // a later sentence failed to synthesize — stop gracefully
        current = next;
        nextPromise = genNext(i + 2);
      }
      if (token === tokenRef.current) {
        setSpeaking(false);
        onEnd?.();
      }
      return true;
    },
    [playBlobAwait],
  );

  /** Browser Web Speech, sentence-chunked for a more natural cadence. */
  const speakBrowser = useCallback(
    (clean: string, token: number, onEnd?: () => void) => {
      if (!synth) {
        if (token === tokenRef.current) {
          setSpeaking(false);
          onEnd?.();
        }
        return;
      }
      const chunks = splitForSpeech(clean);
      let i = 0;
      const next = () => {
        if (token !== tokenRef.current) return;
        if (i >= chunks.length) {
          setSpeaking(false);
          onEnd?.();
          return;
        }
        const u = new SpeechSynthesisUtterance(chunks[i++]);
        if (voiceRef.current) u.voice = voiceRef.current;
        u.lang = voiceRef.current?.lang || "en-US";
        u.rate = 0.97;
        u.pitch = 1.05;
        u.onend = () => {
          if (token === tokenRef.current) setTimeout(next, 90);
        };
        u.onerror = () => {
          if (token === tokenRef.current) {
            setSpeaking(false);
            onEnd?.();
          }
        };
        synth.speak(u);
      };
      next();
    },
    [synth],
  );

  const speak = useCallback(
    async (text: string, opts?: SpeakOptions) => {
      const clean = stripMarkdown(text);
      if (!clean) {
        opts?.onEnd?.();
        return;
      }
      cancel();
      const token = tokenRef.current;
      setSpeaking(true);

      // 1. Gemini TTS, pipelined for low latency.
      if (!remoteDownRef.current) {
        const handled = await speakGeminiStreaming(clean, opts?.voice, token, opts?.onEnd);
        if (handled || token !== tokenRef.current) return;
        // not handled → backend unreachable this turn; fall through to browser voice
      }

      // 2. Browser speech synthesis.
      speakBrowser(clean, token, opts?.onEnd);
    },
    [cancel, speakGeminiStreaming, speakBrowser],
  );

  useEffect(
    () => () => {
      cancel();
    },
    [cancel],
  );

  return { supported, speaking, speak, cancel };
}
