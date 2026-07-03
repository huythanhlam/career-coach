/**
 * Coerce messy LLM output into JSON.
 *
 * Models intermittently wrap responses in ```` ```json ```` fences, prepend a
 * sentence of prose, leave a trailing comma, or get cut off mid-object when they
 * hit a token cap. These helpers recover the intended value from all of those.
 * Kept dependency-free so they're cheap to unit-test in isolation.
 */

/** Strip a leading/trailing markdown code fence and surrounding whitespace. */
function stripFences(raw: string): string {
  return (raw ?? "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Parse a JSON **object** from a model response. Tries, in order: a direct
 * parse, a fence-stripped parse, then the first `{…}` block found anywhere in
 * the text. Throws if none parse.
 */
export function parseJsonObject(raw: string): any {
  // 1. Direct parse (ideal — model returned clean JSON)
  try {
    return JSON.parse((raw ?? "").trim());
  } catch {
    /* try next */
  }

  // 2. Strip markdown code fences then parse
  try {
    return JSON.parse(stripFences(raw));
  } catch {
    /* try next */
  }

  // 3. Extract the first complete {...} block (handles text before/after the JSON)
  const match = (raw ?? "").match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      /* fall through */
    }
  }

  throw new Error("Could not parse JSON object from response");
}

/**
 * Parse a JSON **array** from a model response. Tries a fence-stripped direct
 * parse, then the first `[…]` block found in the text. Throws if none parse.
 */
export function parseJsonArray<T = any>(raw: string): T[] {
  const clean = stripFences(raw);
  try {
    return JSON.parse(clean);
  } catch {
    /* try next */
  }
  const match = clean.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      /* fall through */
    }
  }
  throw new Error("Could not parse JSON array from response");
}

/**
 * Parse a JSON object, repairing **truncated** output. Beyond fence-stripping
 * and trailing-comma tolerance, this rebuilds a balanced object when the model
 * was cut off mid-value: it closes any open string and appends the missing
 * `}`/`]` closers (tracking brace nesting while ignoring braces inside strings).
 * May still throw if the surviving text isn't recoverable — callers handle that.
 */
export function parseLooseJsonObject(raw: string): any {
  let t = stripFences(raw);
  const start = t.indexOf("{");
  if (start < 0) throw new Error("No JSON object found in response");
  t = t.slice(start);

  // Fast paths: as-is, and with a dangling trailing comma removed.
  for (const cand of [t, t.replace(/,\s*$/, "")]) {
    try {
      return JSON.parse(cand);
    } catch {
      /* fall through to repair */
    }
  }

  // Repair: rebuild a balanced object, ignoring braces inside strings.
  let inStr = false,
    esc = false;
  const stack: string[] = [];
  let out = "";
  for (const ch of t) {
    out += ch;
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inStr) out += '"'; // close an unterminated string value
  out = out.replace(/,\s*$/, ""); // drop a dangling comma at the cut point
  while (stack.length) out += stack.pop() === "{" ? "}" : "]";
  out = out.replace(/,\s*([}\]])/g, "$1"); // strip trailing commas before closers
  return JSON.parse(out); // may still throw → caller handles
}
