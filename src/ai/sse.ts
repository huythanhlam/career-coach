/**
 * Minimal Server-Sent Events frame parser for the `ai-gateway` streaming path.
 *
 * The gateway emits named events (`token`, `sources`, `done`, `error`), each a
 * `event:`/`data:` pair terminated by a blank line. A network read can split a
 * frame across chunk boundaries, so parsing is buffered: feed decoded text in,
 * get back the complete frames plus the unparsed remainder to carry forward.
 *
 * Kept dependency-free and pure so it can be unit-tested deterministically
 * without a real stream (see `sse.test.ts`).
 */

export interface SseEvent {
  /** The event name (`event:` line); defaults to "message" when omitted, per spec. */
  event: string;
  /** The joined `data:` payload (multiple `data:` lines are newline-joined). */
  data: string;
}

/**
 * Parse one frame (the text between blank-line separators) into an event.
 * Returns `null` for a frame carrying no `data:` line (e.g. a lone comment or
 * heartbeat) so callers can skip it.
 */
export function parseSseFrame(frame: string): SseEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue; // blank or comment
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    // A single leading space after the colon is stripped, per the SSE spec.
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

/**
 * Split a running buffer into complete SSE events and the leftover tail. Frames
 * are separated by a blank line (`\n\n`, tolerant of `\r\n\r\n`). The returned
 * `rest` is whatever follows the last complete separator — pass it back
 * prepended to the next chunk.
 */
export function parseSseBuffer(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  // Normalize CRLF so a single separator regex handles both line endings.
  let rest = buffer;
  const SEP = /\r?\n\r?\n/;
  let match = SEP.exec(rest);
  while (match) {
    const frame = rest.slice(0, match.index);
    rest = rest.slice(match.index + match[0].length);
    const evt = parseSseFrame(frame);
    if (evt) events.push(evt);
    match = SEP.exec(rest);
  }
  return { events, rest };
}
