import { GoogleGenAI } from "npm:@google/genai";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Map Claude model names (sent by the frontend) to Gemini equivalents
function toGeminiModel(model: string): string {
  if (model.includes("sonnet")) return "gemini-1.5-pro";
  if (model.includes("haiku")) return "gemini-2.0-flash";
  // Already a Gemini model name (e.g. "gemini-1.5-pro")
  return model;
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Pull the real source URLs from Gemini's Google-Search grounding metadata so
// the client can render verifiable links. Returns [] when search wasn't used.
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
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : user;
}

// Best-effort per-user rate limit. Module scope persists across warm invocations
// (so it meaningfully throttles abuse of the paid Gemini quota); a hard global
// limit would need a shared store (e.g. Upstash).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();
function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const user = await verifyUser(req.headers.get("Authorization"));
  if (!user) return json({ error: "Unauthorized" }, 401, cors);
  if (isRateLimited(user.id)) {
    return json({ error: "Too many requests — please wait a moment and try again." }, 429, cors);
  }

  try {
    const { prompt, systemInstruction, model, enableSearch } = await req.json();

    const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });

    const geminiModel = toGeminiModel(model ?? "claude-haiku-4-5-20251001");
    // Google Search grounding: 3.x / 2.0 flash use `googleSearch`; legacy 1.5
    // uses `googleSearchRetrieval`. Only attach when the caller opts in.
    const tools = enableSearch
      ? [geminiModel.includes("1.5") ? { googleSearchRetrieval: {} } : { googleSearch: {} }]
      : undefined;

    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: prompt ?? "",
      config: {
        systemInstruction: systemInstruction || undefined,
        maxOutputTokens: 8096,
        ...(tools ? { tools } : {}),
        // 2.5/3.x-flash "thinking" tokens count against maxOutputTokens and can
        // truncate a structured JSON answer mid-string. Disable thinking for the
        // search-grounded structured call so the full budget goes to the output.
        ...(enableSearch ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    });

    return json({ text: response.text, sources: extractGroundingSources(response) }, 200, cors);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500, cors);
  }
});
