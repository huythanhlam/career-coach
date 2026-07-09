import { useEffect, useRef, useState } from "react";
import { createStreamAnnouncer } from "@/lib/streamAnnouncer";

/**
 * Throttled `aria-live` text for a streaming AI reply. Returns the string to
 * render inside a screen-reader-only `aria-live="polite"` node — updated only
 * on a natural pause in tokens (~1.2s) or once `isDone` flips true, never on
 * every delta. The growing bubble itself should still update on every token;
 * this hook only throttles what gets announced. See `createStreamAnnouncer`
 * for the (separately unit-tested) throttling logic.
 */
export function useStreamAnnouncer(text: string, isDone: boolean, pauseMs = 1200): string {
  const [announcement, setAnnouncement] = useState("");
  const announcerRef = useRef(createStreamAnnouncer(setAnnouncement, pauseMs));

  useEffect(() => {
    const announcer = announcerRef.current;
    return () => announcer.dispose();
  }, []);

  useEffect(() => {
    announcerRef.current.update(text, isDone);
  }, [text, isDone]);

  return announcement;
}
