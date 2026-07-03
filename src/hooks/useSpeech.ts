import { useCallback, useEffect, useRef, useState } from "react";
import { stripMarkdown } from "@/lib/speechText";
import { pickVoice } from "@/lib/voicePick";
import { synthesizeSpeech, ttsConfigured, TtsUnavailableError } from "@/services/ttsService";
import { kokoroGenerate, kokoroFailed, isKokoroVoice } from "@/services/kokoroTts";

/**
 * Speak text aloud for the interview agent. Voice priority:
 *   1. Kokoro (in-browser ONNX) when a Kokoro voice is selected — most human.
 *   2. A configured neural TTS backend via the gateway /api/tts proxy.
 *   3. The browser's Web Speech API (best installed voice, chunked, warm prosody).
 *
 * Latency: Kokoro is synthesized **sentence-by-sentence and pipelined** — the
 * first sentence starts playing while the rest generate in the background, so
 * time-to-first-audio is one short sentence instead of the whole response.
 *
 * `speak(text, { voice, onEnd })` calls `onEnd` when playback finishes naturally
 * (not on cancel) so the caller can resume a hands-free conversation.
 */

/** Break text into short, natural speech chunks (≈ one sentence each). */
function splitForSpeech(text: string): string[] {
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
  return chunks.length ? chunks : [text];
}

export interface SpeakOptions {
  voice?: string;
  onEnd?: () => void;
}

export function useSpeech() {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  const supported = !!synth || ttsConfigured;
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
   * Kokoro, pipelined: generate sentence i+1 while sentence i plays.
   * Returns false if it couldn't even start (model loading/failed) so the
   * caller can fall back; true if it handled playback (incl. cancellation).
   */
  const speakKokoroStreaming = useCallback(
    async (clean: string, voice: string, token: number, onEnd?: () => void): Promise<boolean> => {
      const chunks = splitForSpeech(clean);
      // First sentence: don't block on model load — bail fast to a fallback.
      let current: Blob;
      try {
        current = await kokoroGenerate(chunks[0], voice, { waitForLoad: false });
      } catch {
        return false;
      }
      if (token !== tokenRef.current) return true;
      // Prefetch the 2nd sentence (model is warm now) while the 1st plays.
      const genNext = (i: number) =>
        i < chunks.length
          ? kokoroGenerate(chunks[i], voice, { waitForLoad: true }).catch(() => null)
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

      // 1. Kokoro in-browser, pipelined for low latency.
      if (isKokoroVoice(opts?.voice) && !kokoroFailed()) {
        const handled = await speakKokoroStreaming(clean, opts!.voice!, token, opts?.onEnd);
        if (handled || token !== tokenRef.current) return;
        // not handled → model still loading; fall through to a fast fallback
      }

      // 2. Configured remote neural TTS backend.
      if (ttsConfigured && !remoteDownRef.current) {
        const ac = new AbortController();
        abortRef.current = ac;
        try {
          const blob = await synthesizeSpeech(clean, opts?.voice, ac.signal);
          if (token !== tokenRef.current) return;
          await playBlobAwait(blob, token);
          if (token === tokenRef.current) {
            setSpeaking(false);
            opts?.onEnd?.();
          }
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (err instanceof TtsUnavailableError) remoteDownRef.current = true;
          if (token !== tokenRef.current) return;
        }
      }

      // 3. Browser speech synthesis.
      speakBrowser(clean, token, opts?.onEnd);
    },
    [cancel, playBlobAwait, speakKokoroStreaming, speakBrowser],
  );

  useEffect(
    () => () => {
      cancel();
    },
    [cancel],
  );

  return { supported, speaking, speak, cancel };
}
