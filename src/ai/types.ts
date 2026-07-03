import type { ModelTier } from "@/config/models";

/** A verifiable source link returned by search-grounded generations. */
export interface SourceLink {
  label: string;
  url: string;
}

/** A single content part sent to the gateway. Mirrors the Gemini `Part` shape. */
export type GatewayPart = { text: string } | { inlineData: { data: string; mimeType: string } };

/** What the gateway is asked to generate — the wire contract of `ai-gateway`. */
export interface GatewayRequest {
  /** For metering/labeling only. */
  workflowId: string;
  systemInstruction?: string;
  prompt: string | GatewayPart[];
  tier: ModelTier;
  enableSearch?: boolean;
  /** Standard JSON Schema; the gateway forwards it as Gemini `responseJsonSchema`. */
  responseSchema?: unknown;
  /** Ask the gateway for a `text/event-stream` response (Slice 3). */
  stream?: boolean;
  /** When set, the gateway appends this turn to `ai_messages` (Slice 3). */
  conversationId?: string;
  /**
   * The raw user message for this turn, persisted to `ai_messages` when
   * `conversationId` is set. Distinct from `prompt`, which carries the full
   * replayed transcript the model needs but should not be stored verbatim.
   */
  userMessage?: string;
}

/** Token accounting the gateway reports in the streaming `done` event. */
export interface StreamUsage {
  inputTokens: number;
  outputTokens: number;
  ttftMs: number | null;
}

/** Result of a completed `streamWorkflow` call. */
export interface StreamResult {
  text: string;
  sources: SourceLink[];
  usage: StreamUsage | null;
}

/** Callbacks + options for `streamWorkflow`. */
export interface StreamOptions {
  /** Called with each token delta as it arrives. */
  onToken?: (delta: string) => void;
  /** Called once with grounding sources, when the model used search. */
  onSources?: (sources: SourceLink[]) => void;
  /** Aborts the request (real cancellation, propagated to the provider). */
  signal?: AbortSignal;
  /** When set, the gateway persists this turn to the conversation. */
  conversationId?: string;
  /** The raw user message to persist (see `GatewayRequest.userMessage`). */
  userMessage?: string;
}

/** The gateway's non-streaming response body. */
export interface GatewayResponse {
  text: string;
  sources: SourceLink[];
}

/**
 * Result of running a workflow: a validated value, or a user-facing error.
 * Uses a string discriminant (`status`) rather than a boolean `ok` so it narrows
 * correctly under this project's (not-yet-`strict`) tsconfig — truthiness
 * narrowing on a boolean-literal discriminant needs `strictNullChecks`.
 */
export type WorkflowResult<TOutput> =
  | { status: "ok"; data: TOutput; sources: SourceLink[]; raw: string }
  | { status: "error"; error: string; raw: string };

export type { ModelTier };
