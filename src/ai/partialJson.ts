/**
 * Progressive-reveal extraction for grounded structured-output workflows
 * (company research), which declare their JSON shape in the prompt rather than
 * a native `responseSchema` (Gemini forbids `responseSchema` alongside search
 * tools) — so the streamed text is JSON-shaped prose, not a schema the SDK can
 * parse incrementally. This scans the raw accumulating buffer for known
 * top-level or one-level-nested string fields and returns only the ones whose
 * closing quote has already arrived, so the UI can render prose sections as
 * they finish without waiting for the whole object.
 *
 * Best-effort only: the authoritative result is still the full buffer parsed
 * and Zod-validated once the stream closes, exactly as `runWorkflow` does
 * today. A field extracted here is never trusted beyond display.
 */

/** Find the index of the unescaped closing quote for a string starting at `contentStart`. */
function findClosingQuote(buffer: string, contentStart: number): number {
  for (let i = contentStart; i < buffer.length; i++) {
    if (buffer[i] === "\\") {
      i++; // skip the escaped character
      continue;
    }
    if (buffer[i] === '"') return i;
  }
  return -1;
}

/**
 * Extract a closed JSON string value for `key`, searched for at or after
 * `searchFrom`. Returns undefined if the key hasn't appeared yet, isn't
 * followed by a string value, or that value hasn't closed yet.
 */
function extractClosedString(buffer: string, key: string, searchFrom: number): string | undefined {
  const keyIdx = buffer.indexOf(`"${key}"`, searchFrom);
  if (keyIdx === -1) return undefined;
  const colonIdx = buffer.indexOf(":", keyIdx + key.length + 2);
  if (colonIdx === -1) return undefined;
  let valueStart = colonIdx + 1;
  while (valueStart < buffer.length && /\s/.test(buffer[valueStart])) valueStart++;
  if (buffer[valueStart] !== '"') return undefined;
  const contentStart = valueStart + 1;
  const closeIdx = findClosingQuote(buffer, contentStart);
  if (closeIdx === -1) return undefined;
  try {
    return JSON.parse(buffer.slice(valueStart, closeIdx + 1)) as string;
  } catch {
    return undefined;
  }
}

/**
 * Scan `buffer` for each requested field path — either a top-level key
 * ("overview") or a one-level-nested "parent.child" path (a company-research
 * section's "summary") — and return the ones whose value has fully streamed
 * in. Nested lookups are scoped to text at-or-after the parent key so distinct
 * sections sharing a child key name (every section has its own "summary")
 * resolve to the right section rather than the first "summary" in the buffer.
 */
export function extractCompleteStringFields(
  buffer: string,
  paths: string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const path of paths) {
    const segments = path.split(".");
    let value: string | undefined;
    if (segments.length === 1) {
      value = extractClosedString(buffer, segments[0], 0);
    } else {
      const [parent, child] = segments;
      const parentIdx = buffer.indexOf(`"${parent}"`);
      if (parentIdx !== -1) value = extractClosedString(buffer, child, parentIdx);
    }
    if (value !== undefined) result[path] = value;
  }
  return result;
}
