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
  /** When set, the gateway appends this turn to `ai_messages` (Slice 3). */
  conversationId?: string;
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
