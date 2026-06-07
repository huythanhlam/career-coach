import { useCallback, useEffect, useRef, useState } from "react";

/* The Web Speech API isn't in TS's DOM lib; treat the constructor as `any`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionLike = any;

function getRecognitionCtor(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Map a raw SpeechRecognition error code to a human-readable message. */
function humanizeError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow mic access — and make sure you're on http://localhost (voice needs a secure page).";
    case "no-speech":
      return "Didn't catch any speech — try again and speak clearly.";
    case "audio-capture":
      return "No microphone was found.";
    case "network":
      return "Network error during voice recognition. Check your connection.";
    case "aborted":
      return "";
    default:
      return `Voice input error: ${code}`;
  }
}

interface UseDictationArgs {
  /** Called with the full transcript of the current session (final + interim). */
  onText: (sessionText: string) => void;
  /** Called with a human-readable message when recognition fails. */
  onError?: (message: string) => void;
}

/**
 * Browser speech-to-text via the Web Speech API. Streams interim + final
 * results so text appears live. No-ops gracefully where unsupported, and
 * surfaces permission / secure-context errors instead of failing silently.
 */
export function useDictation({ onText, onError }: UseDictationArgs) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike>(null);
  const finalRef = useRef("");

  const onTextRef = useRef(onText);
  const onErrorRef = useRef(onError);
  useEffect(() => { onTextRef.current = onText; }, [onText]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const supported = getRecognitionCtor() !== null;

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.("Voice input isn't supported in this browser. Try Chrome, Edge, or Safari.");
      return;
    }
    if (recognitionRef.current) return;

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    finalRef.current = "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalRef.current += transcript;
        else interim += transcript;
      }
      const full = (finalRef.current + interim).trim();
      onTextRef.current(full);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (event: any) => {
      const msg = humanizeError(event?.error ?? "unknown");
      if (msg) onErrorRef.current?.(msg);
      recognitionRef.current = null;
      setListening(false);
    };
    rec.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      recognitionRef.current = null;
      setListening(false);
      onErrorRef.current?.("Couldn't start voice input. Make sure you're on http://localhost and a mic is connected.");
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop(); else start();
  }, [listening, start, stop]);

  // Clean up if the component unmounts mid-recording.
  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch { /* ignore */ } }, []);

  return { supported, listening, start, stop, toggle };
}
