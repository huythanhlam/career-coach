export interface StreamAnnouncer {
  /** Call whenever new streamed text arrives; pass `isDone: true` on the final call. */
  update(text: string, isDone: boolean): void;
  /** Cancel any pending timer (call on unmount). */
  dispose(): void;
}

/**
 * Throttled announcer for streamed AI content, backing the `aria-live` regions
 * on every F2 streaming surface. Fires `onAnnounce` only after `pauseMs` of no
 * new text (a natural pause) or immediately once the stream settles
 * (`isDone: true`) — never on every token, which would make a screen reader
 * re-announce a growing chat bubble dozens of times per reply.
 */
export function createStreamAnnouncer(
  onAnnounce: (text: string) => void,
  pauseMs = 1200,
): StreamAnnouncer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return {
    update(text, isDone) {
      clear();
      if (isDone) {
        onAnnounce(text);
        return;
      }
      timer = setTimeout(() => onAnnounce(text), pauseMs);
    },
    dispose: clear,
  };
}
