/**
 * Server-side Gemini client for the blog pipeline. Mirrors the production Edge
 * Function (supabase/functions/ai-generate/index.ts): same @google/genai call
 * shape, same Google-Search grounding, same grounding-source extraction.
 *
 * This runs in CI with GEMINI_API_KEY (a server-side secret) — the same key the
 * Edge Function uses. The "all Gemini calls go through the gateway" rule governs
 * FRONTEND code; backend scripts holding the key directly is the existing
 * precedent (the Edge Function + seed-company-research).
 */
import { GoogleGenAI } from "@google/genai";
import type { BlogSource } from "../../src/types/blogPost.ts";

/** Search-grounded model, matching MODELS.RESEARCH in src/config/models.ts. */
export const BLOG_MODEL = process.env.BLOG_MODEL || "gemini-2.5-flash";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/** Pull real source URLs from Gemini's Google-Search grounding metadata. */
export function extractGroundingSources(response: unknown): BlogSource[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chunks = (response as any)?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const out: BlogSource[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of chunks as any[]) {
    const uri = c?.web?.uri;
    if (typeof uri === "string" && uri) out.push({ label: c?.web?.title ?? uri, url: uri });
  }
  return out.filter((s, i) => out.findIndex((o) => o.url === s.url) === i);
}

export interface AgentCall {
  system: string;
  prompt: string;
  /** Attach the Google Search tool for grounded, citable output. */
  search?: boolean;
  model?: string;
  maxOutputTokens?: number;
}

export interface AgentResult {
  text: string;
  sources: BlogSource[];
}

/** One Gemini turn for an agent. Throws on API failure (the caller decides). */
export async function callAgent(opts: AgentCall): Promise<AgentResult> {
  const model = opts.model ?? BLOG_MODEL;
  const ai = getClient();
  const tools = opts.search ? [{ googleSearch: {} }] : undefined;
  const response = await ai.models.generateContent({
    model,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      maxOutputTokens: opts.maxOutputTokens ?? 8096,
      ...(tools ? { tools } : {}),
      // Reserve the whole budget for the answer when grounding a structured call
      // (thinking tokens count against maxOutputTokens and can truncate JSON).
      ...(opts.search ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  });
  return { text: response.text ?? "", sources: extractGroundingSources(response) };
}

/**
 * Parse a JSON object/array from a model response, tolerating ```json fences and
 * surrounding prose. Returns null instead of throwing so callers can degrade.
 */
export function parseJsonResponse<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  // Fall back to the outermost {...} / [...] span if there's leading prose.
  const trimmed = candidate.trim();
  const tryParse = (s: string): T | null => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  };
  const direct = tryParse(trimmed);
  if (direct !== null) return direct;
  const firstObj = trimmed.indexOf("{");
  const firstArr = trimmed.indexOf("[");
  const start =
    firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
  if (start === -1) return null;
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (end <= start) return null;
  return tryParse(trimmed.slice(start, end + 1));
}
