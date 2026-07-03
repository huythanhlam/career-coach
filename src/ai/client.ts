import { supabase } from "@/lib/supabaseClient";
import { MODELS } from "@/config/models";
import { zodToResponseSchema } from "@/ai/schema";
import type { Workflow } from "@/ai/defineWorkflow";
import type { GatewayRequest, GatewayResponse, SourceLink, WorkflowResult } from "@/ai/types";

/**
 * The single client for the `ai-gateway` edge function. Replaces
 * `geminiService.ts`'s `postToGatewayRaw` / `generateWorkflowData`. Owns auth,
 * transient-failure retry, timeout, and Zod validation of the result.
 *
 * The gateway runs identically in dev (`supabase functions serve ai-gateway`)
 * and prod, so this URL points at the same code in both — no dev/prod fork.
 */
const GATEWAY_URL =
  (import.meta.env.VITE_AI_GATEWAY_URL as string) ||
  (import.meta.env.VITE_SUPABASE_URL
    ? `${(import.meta.env.VITE_SUPABASE_URL as string).replace(/\/+$/, "")}/functions/v1/ai-gateway`
    : "http://localhost:54321/functions/v1/ai-gateway");

const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

// Generations with web search can legitimately take a while, but a request
// should never hang the UI forever.
const GATEWAY_TIMEOUT_MS = 120_000;
const GATEWAY_MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const GATEWAY_DOWN_MESSAGE = import.meta.env.DEV
  ? "The local AI gateway is not running. Start it with 'npm run dev:functions' (supabase functions serve ai-gateway)."
  : "Could not reach the AI service. Check your connection and try again.";
const GATEWAY_TIMEOUT_MESSAGE = "The AI request timed out. Please try again.";

async function getAuthHeader(): Promise<string> {
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
function stripFences(raw: string): string {
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

export { MODELS };
export type { SourceLink, WorkflowResult };
