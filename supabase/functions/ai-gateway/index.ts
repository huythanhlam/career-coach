import { GoogleGenAI } from "npm:@google/genai";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ─────────────────────────────────────────────────────────────────────────────
// ai-gateway — the single AI entry point for TechCoach AI (AI Core v2).
//
// Runs IDENTICALLY in dev (`supabase functions serve ai-gateway`) and prod: same
// Gemini key, same model ids, no name remapping. Replaces both the dev Express
// gateway (`server.ts` AI path, Claude CLI) and the prod `ai-generate` function
// (which remapped every tier to flash-lite). See
// `docs/rebuild/DEVELOPMENT_PLAN.md` §6 Phase 1 and
// `docs/superpowers/specs/2026-07-02-ai-gateway-v2-design.md`.
//
// Slice 1 scope: auth → monthly cap → rate limit → tier→model → Gemini
// (native responseSchema or grounded search) → usage metering. SSE streaming and
// conversation persistence land in Slice 3.
// ─────────────────────────────────────────────────────────────────────────────

/** Real Gemini model ids per tier. MUST mirror `src/config/models.ts` MODELS
 *  (a CI assertion keeps them in lockstep — dev == prod). All tiers point at
 *  gemini-2.5-flash for now: the 3.x flash family 429s "quota exceeded" on this
 *  Gemini plan (PR #76). The eval suite gates any bump back to 3.x. */
const TIER_MODELS: Record<string, string> = {
  FAST: "gemini-2.5-flash",
  QUALITY: "gemini-2.5-flash",
  RESEARCH: "gemini-2.5-flash",
};

/** Gemini list prices (USD per 1M tokens, in/out) — see DEVELOPMENT_PLAN §9. */
const PRICES: Record<string, { in: number; out: number }> = {
  "gemini-3.1-flash-lite": { in: 0.25, out: 1.5 },
  "gemini-3.5-flash": { in: 1.5, out: 9 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 20;
// Hard monthly per-user token cap (input+output), overridable via secret.
const MONTHLY_TOKEN_CAP = Number(Deno.env.get("AI_MONTHLY_TOKEN_CAP") ?? "2000000");

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Pull real source URLs from Gemini's Google-Search grounding metadata so the
// client can render verifiable links. Returns [] when search wasn't used.
function extractGroundingSources(response: unknown): { label: string; url: string }[] {
  // deno-lint-ignore no-explicit-any
  const chunks = (response as any)?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const out: { label: string; url: string }[] = [];
  // deno-lint-ignore no-explicit-any
  for (const c of chunks as any[]) {
    const uri = c?.web?.uri;
    if (typeof uri === "string" && uri) out.push({ label: c?.web?.title ?? uri, url: uri });
  }
  return out.filter((s, i) => out.findIndex((o) => o.url === s.url) === i);
}

async function verifyUser(authHeader: string | null) {
  if (!authHeader) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : user;
}

// Service-role client for the DB-counter rate limit + usage cap + metering.
const serviceClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function isRateLimited(userId: string): Promise<boolean> {
  const windowKey = Math.floor(Date.now() / RATE_WINDOW_MS);
  const { data, error } = await serviceClient.rpc("check_ai_rate_limit", {
    p_user_id: userId,
    p_window_key: windowKey,
    p_max_hits: RATE_MAX_PER_WINDOW,
  });
  if (error) {
    console.warn("Rate limit check failed:", error.message);
    return false; // fail open on DB hiccups
  }
  return data === true;
}

async function isOverMonthlyCap(userId: string): Promise<boolean> {
  const { data, error } = await serviceClient.rpc("check_ai_usage_cap", {
    p_user_id: userId,
    p_cap: MONTHLY_TOKEN_CAP,
  });
  if (error) {
    console.warn("Usage cap check failed:", error.message);
    return false; // fail open — never lock a user out on infra errors
  }
  return data === true;
}

interface MeterRow {
  userId: string;
  workflowId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  ttftMs: number | null;
}

async function meter(row: MeterRow): Promise<void> {
  const price = PRICES[row.model] ?? { in: 0, out: 0 };
  const estCost =
    (row.inputTokens / 1_000_000) * price.in + (row.outputTokens / 1_000_000) * price.out;
  const { error } = await serviceClient.from("ai_usage").insert({
    user_id: row.userId,
    workflow_id: row.workflowId,
    model: row.model,
    input_tokens: row.inputTokens,
    output_tokens: row.outputTokens,
    latency_ms: row.latencyMs,
    ttft_ms: row.ttftMs,
    est_cost: Number(estCost.toFixed(6)),
  });
  if (error) console.warn("Usage metering insert failed:", error.message);
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const user = await verifyUser(req.headers.get("Authorization"));
  if (!user) return json({ error: "Unauthorized" }, 401, cors);

  // Hard cap BEFORE any provider call — cheap insurance until billing lands.
  if (await isOverMonthlyCap(user.id)) {
    return json({ error: "monthly_cap" }, 429, cors);
  }
  if (await isRateLimited(user.id)) {
    return json({ error: "Too many requests — please wait a moment and try again." }, 429, cors);
  }

  try {
    const {
      workflowId,
      prompt,
      systemInstruction,
      tier,
      model: legacyModel,
      enableSearch,
      responseSchema,
    } = await req.json();

    // Resolve the model: explicit tier wins; fall back to a passed-through
    // Gemini id for incremental migration; default FAST.
    const model =
      (typeof tier === "string" && TIER_MODELS[tier]) ||
      (typeof legacyModel === "string" && legacyModel.startsWith("gemini-") ? legacyModel : null) ||
      TIER_MODELS.FAST;

    const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });
    const tools = enableSearch ? [{ googleSearch: {} }] : undefined;

    // deno-lint-ignore no-explicit-any
    const config: Record<string, any> = {
      systemInstruction: systemInstruction || undefined,
      maxOutputTokens: 8096,
    };
    if (tools) {
      config.tools = tools;
      // "thinking" tokens count against maxOutputTokens and can truncate a
      // structured answer mid-string; disable for grounded structured calls.
      config.thinkingConfig = { thinkingBudget: 0 };
    }
    // Native structured output — Gemini forbids responseSchema together with
    // tools, so it is only attached to non-grounded calls.
    if (responseSchema && !enableSearch) {
      config.responseMimeType = "application/json";
      config.responseJsonSchema = responseSchema;
    }

    const started = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: prompt ?? "",
      config,
    });
    const latencyMs = Date.now() - started;

    // deno-lint-ignore no-explicit-any
    const usage = (response as any)?.usageMetadata ?? {};
    // Fire-and-forget metering — never block the response on the insert.
    meter({
      userId: user.id,
      workflowId: typeof workflowId === "string" ? workflowId : "unknown",
      model,
      inputTokens: Number(usage.promptTokenCount ?? 0),
      outputTokens: Number(usage.candidatesTokenCount ?? 0),
      latencyMs,
      ttftMs: null, // non-streaming: no separate time-to-first-token
    }).catch(() => {});

    return json({ text: response.text, sources: extractGroundingSources(response) }, 200, cors);
  } catch (err: unknown) {
    // Log server-side; never echo provider error details (can leak key/config
    // hints) to the client.
    console.error("ai-gateway error:", err);
    return json({ error: "AI generation failed. Please try again." }, 500, cors);
  }
});
