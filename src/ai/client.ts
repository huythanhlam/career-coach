import { supabase } from "@/lib/supabaseClient";
import { MODELS } from "@/config/models";
import { zodToResponseSchema } from "@/ai/schema";
import { parseSseBuffer } from "@/ai/sse";
import type { Workflow } from "@/ai/defineWorkflow";
import type {
  GatewayRequest,
  GatewayResponse,
  SourceLink,
  StreamOptions,
  StreamResult,
  StreamUsage,
  WorkflowResult,
} from "@/ai/types";

/**
 * The single client for the `ai-gateway` edge function. Replaces
 * `geminiService.ts`'s `postToGatewayRaw` / `generateWorkflowData`. Owns auth,
 * transient-failure retry, timeout, and Zod validation of the result.
 *
 * The gateway runs identically in dev (`supabase functions serve ai-gateway`)
 * and prod, so this URL points at the same code in both — no dev/prod fork.
 */
export const GATEWAY_URL =
  (import.meta.env.VITE_AI_GATEWAY_URL as string) ||
  (import.meta.env.VITE_SUPABASE_URL
    ? `${(import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, "")}/functions/v1/ai-gateway`
    : "http://localhost:54321/functions/v1/ai-gateway");

export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

// Generations with web search can legitimately take a while, but a request
// should never hang the UI forever.
const GATEWAY_TIMEOUT_MS = 120_000;
const GATEWAY_MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const GATEWAY_DOWN_MESSAGE = import.meta.env.DEV
  ? "The local AI gateway is not running. Start it with 'npm run dev:functions' (supabase functions serve ai-gateway)."
  : "Could not reach the AI service. Check your connection and try again.";
const GATEWAY_TIMEOUT_MESSAGE = "The AI request timed out. Please try again.";

export async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return `Bearer ${data.session?.access_token ?? ""}`;
}

/** Map a failed gateway call to a message a user can act on. */
export function describeGatewayError(error: unknown, timedOut: boolean): string {
  if (timedOut) return GATEWAY_TIMEOUT_MESSAGE;
  const msg = error instanceof Error ? error.message : "";
  const status = Number(/^Gateway (\d{3})/.exec(msg)?.[1] ?? NaN);
  if (status === 401 || status === 403)
    return "Your session has expired. Please refresh the page and sign in again.";
  if (status === 429)
    return "The AI service is handling too many requests right now. Please wait a minute and try again.";
  if (status >= 500) return "The AI service hit a temporary error. Please try again.";
  if (Number.isFinite(status)) return `The AI request failed (HTTP ${status}). Please try again.`;
  return GATEWAY_DOWN_MESSAGE;
}

/**
 * Low-level POST to the gateway. Times out after GATEWAY_TIMEOUT_MS and retries
 * transient failures (network errors, 408/429/5xx) with exponential backoff.
 * Timeouts are not retried — the user has already waited long enough. Throws on
 * terminal failure (callers decide how to surface it).
 */
export async function callGateway(
  body: GatewayRequest,
  signal?: AbortSignal,
): Promise<GatewayResponse> {
  const authHeader = await getAuthHeader();
  let lastError: unknown;
  for (let attempt = 0; attempt < GATEWAY_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    // Combine the caller's abort signal with our per-attempt timeout.
    const timeout = AbortSignal.timeout(GATEWAY_TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: authHeader,
        },
        body: JSON.stringify(body),
        signal: combined,
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => "(no body)");
        lastError = new Error(`Gateway ${response.status}: ${errBody}`);
        if (RETRYABLE_STATUS.has(response.status)) continue;
        throw lastError;
      }
      const data = (await response.json()) as GatewayResponse;
      return { text: data.text ?? "", sources: Array.isArray(data.sources) ? data.sources : [] };
    } catch (error) {
      // Caller-initiated abort: propagate immediately, no retry.
      if (signal?.aborted) throw error;
      if (error instanceof DOMException && error.name === "TimeoutError") throw error;
      if (error === lastError) throw error; // non-retryable HTTP status
      lastError = error; // network hiccup — retry
    }
  }
  throw lastError;
}

/** Strip a leading/trailing markdown fence. Grounded calls (no responseSchema) may fence. */
export function stripFences(raw: string): string {
  return raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

/**
 * Run a workflow end-to-end: validate input, build the prompt, call the gateway
 * with a native `responseSchema` (non-grounded) or grounded search, then parse
 * the result with the workflow's Zod `outputSchema`. Returns a discriminated
 * result rather than throwing on a bad model response, so callers render a
 * message instead of crashing.
 */
export async function runWorkflow<TInput, TOutput>(
  wf: Workflow<TInput, TOutput>,
  input: TInput,
  opts: { signal?: AbortSignal } = {},
): Promise<WorkflowResult<TOutput>> {
  const parsedInput = wf.inputSchema.parse(input);
  // Gemini forbids responseSchema together with search tools, so grounded
  // workflows rely on prompt-declared JSON + client-side validation only.
  const responseSchema =
    wf.outputSchema && !wf.enableSearch ? zodToResponseSchema(wf.outputSchema) : undefined;

  const body: GatewayRequest = {
    workflowId: wf.id,
    systemInstruction: wf.buildSystem(parsedInput),
    prompt: wf.buildPrompt(parsedInput),
    tier: wf.tier,
    enableSearch: wf.enableSearch,
    responseSchema,
  };

  let raw = "";
  try {
    const res = await callGateway(body, opts.signal);
    raw = res.text;
    if (!wf.outputSchema) {
      // Free-text workflow — return the text as-is.
      return { status: "ok", data: raw as unknown as TOutput, sources: res.sources, raw };
    }
    const jsonText = responseSchema ? raw : stripFences(raw);
    const value = wf.outputSchema.safeParse(JSON.parse(jsonText));
    if (!value.success) {
      console.error(`Workflow ${wf.id} output failed schema validation:`, value.error.message);
      return { status: "error", error: describeParseFailure(raw), raw };
    }
    return { status: "ok", data: value.data, sources: res.sources, raw };
  } catch (error) {
    if (opts.signal?.aborted) throw error;
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    if (raw && !timedOut) {
      // Response arrived but wasn't parseable JSON — surface a parse failure.
      return { status: "error", error: describeParseFailure(raw), raw };
    }
    console.error(`Workflow ${wf.id} gateway error:`, error);
    return { status: "error", error: describeGatewayError(error, timedOut), raw };
  }
}

/**
 * A non-JSON body is usually a classified gateway error ("timed out", "rate
 * limited", …) rather than malformed JSON — surface that text so the user sees
 * an actionable message instead of a generic parse error.
 */
function describeParseFailure(raw: string): string {
  const looksLikeMessage =
    raw && !raw.trimStart().startsWith("{") && !raw.trimStart().startsWith("[");
  return looksLikeMessage
    ? raw.slice(0, 300)
    : "The AI response couldn't be read. Please try again.";
}

// ─── Streaming (SSE) ─────────────────────────────────────────────────────────

// A stream that never delivers a first token shouldn't hang the UI forever, but
// an actively-streaming reply must not be cut off. So instead of one blanket
// timeout we run a watchdog: abort if the first token doesn't arrive within
// STREAM_CONNECT_TIMEOUT_MS, then abort if the gap between tokens exceeds
// STREAM_IDLE_TIMEOUT_MS.
const STREAM_CONNECT_TIMEOUT_MS = 30_000;
const STREAM_IDLE_TIMEOUT_MS = 60_000;

/** Errors we may retry — but only before the first token has streamed. */
function isRetryable(error: unknown): boolean {
  return error instanceof Error && (error as { retryable?: boolean }).retryable === true;
}

function retryable(error: Error): Error {
  (error as { retryable?: boolean }).retryable = true;
  return error;
}

/**
 * Stream a free-text workflow (chat, plan generation) from the gateway,
 * delivering tokens progressively via `onToken`. Consumes the gateway's SSE
 * frames (`token` / `sources` / `done` / `error`), supports real cancellation
 * through `signal`, and — when `conversationId` is set — the gateway persists
 * the turn to `ai_messages`.
 *
 * Retries only transient connection failures that occur BEFORE the first token
 * (a partially-streamed reply must never be silently restarted). Throws on
 * terminal failure or caller abort so the UI can render a message / stop.
 */
export async function streamWorkflow<TInput>(
  wf: Workflow<TInput, unknown>,
  input: TInput,
  opts: StreamOptions = {},
): Promise<StreamResult> {
  const parsedInput = wf.inputSchema.parse(input);
  const body: GatewayRequest = {
    workflowId: wf.id,
    systemInstruction: wf.buildSystem(parsedInput),
    prompt: wf.buildPrompt(parsedInput),
    tier: wf.tier,
    enableSearch: wf.enableSearch,
    stream: true,
    conversationId: opts.conversationId,
    userMessage: opts.userMessage,
  };

  const authHeader = await getAuthHeader();
  let firstTokenSeen = false;
  const markFirstToken = () => {
    firstTokenSeen = true;
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < GATEWAY_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    try {
      return await streamOnce(body, authHeader, opts, markFirstToken);
    } catch (error) {
      lastError = error;
      // Caller-initiated abort: propagate immediately, never retry.
      if (opts.signal?.aborted) throw error;
      // Once tokens have flowed we cannot safely restart the reply.
      if (firstTokenSeen) throw error;
      if (!isRetryable(error)) throw error;
    }
  }
  throw lastError;
}

/** One SSE connection attempt. Resolves when the stream completes cleanly. */
async function streamOnce(
  body: GatewayRequest,
  authHeader: string,
  opts: StreamOptions,
  markFirstToken: () => void,
): Promise<StreamResult> {
  // Watchdog: an internal controller we trip on inactivity, combined with the
  // caller's signal so either can cancel the fetch/reader.
  const watchdogController = new AbortController();
  const combined = opts.signal
    ? AbortSignal.any([opts.signal, watchdogController.signal])
    : watchdogController.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(
      () => watchdogController.abort(new DOMException("Stream timed out", "TimeoutError")),
      ms,
    );
  };
  const disarm = () => {
    if (timer) clearTimeout(timer);
  };

  arm(STREAM_CONNECT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
      signal: combined,
    });
  } catch (error) {
    disarm();
    if (opts.signal?.aborted) throw error; // caller abort — propagate
    // Network-level failure before any byte: safe to retry.
    throw retryable(error instanceof Error ? error : new Error(String(error)));
  }

  if (!response.ok || !response.body) {
    disarm();
    const errBody = await response.text().catch(() => "(no body)");
    const error = new Error(`Gateway ${response.status}: ${errBody}`);
    // Same transient statuses runWorkflow retries — but only pre-first-token.
    if (RETRYABLE_STATUS.has(response.status)) throw retryable(error);
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let sources: SourceLink[] = [];
  let usage: StreamUsage | null = null;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseBuffer(buffer);
      buffer = parsed.rest;
      for (const evt of parsed.events) {
        const data = safeJsonParse(evt.data);
        switch (evt.event) {
          case "token": {
            const delta = typeof data?.delta === "string" ? data.delta : "";
            if (delta) {
              if (!text) markFirstToken();
              text += delta;
              arm(STREAM_IDLE_TIMEOUT_MS);
              opts.onToken?.(delta);
            }
            break;
          }
          case "sources": {
            if (Array.isArray(data)) {
              sources = data as SourceLink[];
              opts.onSources?.(sources);
            }
            break;
          }
          case "done": {
            const u = data?.usage;
            if (u && typeof u === "object") {
              usage = {
                inputTokens: Number(u.inputTokens ?? 0),
                outputTokens: Number(u.outputTokens ?? 0),
                ttftMs: u.ttftMs == null ? null : Number(u.ttftMs),
              };
            }
            break;
          }
          case "error": {
            // Server signalled failure mid-stream — generic message only, never
            // retried (the gateway already gave up).
            const message = typeof data?.message === "string" ? data.message : "";
            throw new Error(message || "The AI service hit a temporary error. Please try again.");
          }
        }
      }
    }
  } finally {
    disarm();
    reader.cancel().catch(() => {});
  }

  return { text, sources, usage };
}

/** Parse an SSE `data:` payload, tolerating the occasional malformed frame. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeJsonParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export { MODELS };
export type { SourceLink, StreamOptions, StreamResult, StreamUsage, WorkflowResult };
