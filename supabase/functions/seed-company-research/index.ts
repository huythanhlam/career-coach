import { GoogleGenAI } from "npm:@google/genai";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── Pre-warm Research Company data for popular employers ───────────────────
// Operator / cron-triggered. For each popular company that isn't already fresh
// in `company_research_cache`, run the SAME grounded research the browser does
// (profile + news, Google-Search grounded) server-to-server and upsert it via
// the controlled RPC. Result: looking up a Fortune-100 / popular company is an
// instant cache hit for every user — no AI call on the hot path.
//
// The two system prompts below are intentionally kept identical to
// `COMPANY_PROFILE_SYSTEM` / `COMPANY_NEWS_SYSTEM` in
// `src/services/geminiService.ts`. Update both together if either changes.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const MODEL = "gemini-2.5-flash";
// Slow/fast TTLs mirror src/config/companyResearchCache.ts so we re-seed on the
// same cadence the client treats data as stale.
const TTL_MS = { profile: 45 * 24 * 60 * 60 * 1000, news: 2 * 24 * 60 * 60 * 1000 } as const;
// Bound cost/runtime per invocation; the cron runs weekly and chips away.
const MAX_PER_RUN = 12;

// Canonical names to pre-warm. Keep in sync with src/data/popularCompanies.ts
// (canonical `name` values). Aliases are resolved client-side at lookup time, so
// only the canonical identity needs seeding.
const COMPANIES: string[] = [
  "Alphabet (Google)", "Meta", "Amazon", "Apple", "Microsoft", "Twitter / X", "NVIDIA", "Tesla",
  "OpenAI", "Anthropic", "Databricks", "Stripe", "Canva", "Notion", "Figma", "Discord", "Reddit",
  "Plaid", "Ramp", "Brex", "Rippling", "Scale AI", "SpaceX", "Epic Games", "Chime", "Instacart",
  "DoorDash", "Coinbase", "Palantir", "Shopify", "Block", "Atlassian", "Datadog", "Cloudflare",
  "MongoDB", "Roblox", "Pinterest", "Lyft", "Robinhood",
  "3M", "Abbott Laboratories", "Adobe", "Advanced Micro Devices", "Airbnb", "American Express",
  "AT&T", "Bank of America", "Berkshire Hathaway", "BlackRock", "Boeing", "Broadcom", "Capital One",
  "Caterpillar", "Chevron", "Cisco Systems", "Citigroup", "Coca-Cola", "Comcast", "Costco",
  "CVS Health", "Dell Technologies", "Eli Lilly", "ExxonMobil", "FedEx", "Ford Motor",
  "General Electric", "General Motors", "Goldman Sachs", "Honeywell", "HP", "IBM", "Intel", "Intuit",
  "Johnson & Johnson", "JPMorgan Chase", "Lockheed Martin", "Lowe's", "Mastercard", "McDonald's",
  "Merck", "Morgan Stanley", "Netflix", "Nike", "Oracle", "Palo Alto Networks", "PayPal", "PepsiCo",
  "Pfizer", "Procter & Gamble", "Qualcomm", "Salesforce", "ServiceNow", "Snap", "Snowflake",
  "Spotify", "Starbucks", "Target", "Texas Instruments", "The Home Depot", "T-Mobile", "Uber",
  "UPS", "Verizon", "Visa", "Walmart", "Walt Disney", "Wells Fargo", "Workday", "Zoom",
];

const COMPANY_PROFILE_SYSTEM = `You research a company to help a candidate interview well. A live web search tool IS available — use it for anything time-sensitive and cite the real URLs you retrieve; never invent URLs or figures. You are given JOB POSTING TEXT — use it directly for benefits/values where present and only search for what it doesn't cover.

Produce, searching where needed:
- hiringValues: what the company values when hiring (careers/jobs/culture pages — traits, principles, competencies).
- benefits: key benefits & perks (comp philosophy, health/leave, equity, remote/flexibility, learning budget).
- financials: most recent quarterly earnings, revenue/growth, guidance, stock; private → latest funding/valuation. Date-stamp every figure. If unknown, say so in the summary and leave bullets sparse.
Do NOT output employee ratings or review scores — those are shown from verified sources elsewhere, not from you.

Output ONLY a compact JSON object, no markdown fences:
{"overview":"2-3 sentences + recency note","hiringValues":{"summary":"1-2 sentences","bullets":["..."],"sources":[{"label":"...","url":"https://..."}]},"benefits":{"summary":"...","bullets":["..."],"sources":[...]},"financials":{"summary":"...","bullets":["metric — value — period"],"sources":[...]},"sources":[{"label":"...","url":"..."}]}
At most 4 bullets/section (≤25 words each) and 3 sources/section. Begin with "{" and end with "}".`;

const COMPANY_NEWS_SYSTEM = `You find recent news about a company to help a candidate interview well. A live web search tool IS available — use it and cite the real URLs you retrieve; never invent URLs. Prioritize news tied to the candidate's role/team/department (launches, org changes, hiring in that area); if little role-specific news exists, fall back to the most important recent company news. Date-stamp each item.

Output ONLY a compact JSON object, no markdown fences:
{"news":{"summary":"1-2 sentences","bullets":["headline — date — why it matters"],"sources":[{"label":"...","url":"https://..."}]},"sources":[{"label":"...","url":"..."}]}
At most 5 bullets (≤25 words each) and 4 sources. Begin with "{" and end with "}".`;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// deno-lint-ignore no-explicit-any
function extractGroundingSources(response: any): { label: string; url: string }[] {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const out: { label: string; url: string }[] = [];
  // deno-lint-ignore no-explicit-any
  for (const c of chunks as any[]) {
    const uri = c?.web?.uri;
    if (typeof uri === "string" && uri) out.push({ label: c?.web?.title ?? uri, url: uri });
  }
  return out.filter((s, i) => out.findIndex((o) => o.url === s.url) === i);
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  if (start < 0) throw new Error("no JSON object");
  try {
    return JSON.parse(cleaned.slice(start));
  } catch {
    // Best-effort recovery of a truncated object: close at the last '}'.
    const end = cleaned.lastIndexOf("}");
    if (end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("unparseable JSON");
  }
}

async function ground(ai: GoogleGenAI, system: string, prompt: string) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: system,
      maxOutputTokens: 8096,
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  // deno-lint-ignore no-explicit-any
  return { text: (response as any).text ?? "", sources: extractGroundingSources(response) };
}

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const internal = req.headers.get("x-internal-key") ?? "";
  if (!CRON_SECRET || (auth !== `Bearer ${CRON_SECRET}` && internal !== CRON_SECRET)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), { status: 500 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // Which companies already have BOTH tiers fresh? Skip those.
  const { data: rows } = await admin
    .from("company_research_cache")
    .select("company, kind, updated_at");
  const freshByCompany = new Map<string, Set<string>>();
  for (const r of rows ?? []) {
    const kind = r.kind as keyof typeof TTL_MS;
    const ttl = TTL_MS[kind];
    if (ttl && Date.now() - new Date(r.updated_at).getTime() < ttl) {
      const set = freshByCompany.get(r.company) ?? new Set<string>();
      set.add(kind);
      freshByCompany.set(r.company, set);
    }
  }

  const pending = COMPANIES.filter((name) => {
    const fresh = freshByCompany.get(norm(name));
    return !(fresh && fresh.has("profile") && fresh.has("news"));
  }).slice(0, MAX_PER_RUN);

  let seeded = 0;
  const errors: string[] = [];

  for (const company of pending) {
    const identity = norm(company);
    try {
      // Profile tier (no JD context — seeding the generic company profile).
      const profilePrompt = `COMPANY: ${company}\nTARGET ROLE: (general)\n\nJOB POSTING TEXT (use for benefits/values where present): (none provided)\n\nReturn only the JSON object.`;
      const profile = await ground(ai, COMPANY_PROFILE_SYSTEM, profilePrompt);
      const profileObj = parseJsonObject(profile.text);
      await admin.rpc("upsert_company_research_cache", {
        p_cache_key: `profile:${identity}`,
        p_company: identity,
        p_kind: "profile",
        p_data: profileObj,
      });

      const newsPrompt = `COMPANY: ${company}\nTARGET ROLE: (general)\n\nFind recent news. Return only the JSON object.`;
      const news = await ground(ai, COMPANY_NEWS_SYSTEM, newsPrompt);
      const newsObj = parseJsonObject(news.text);
      await admin.rpc("upsert_company_research_cache", {
        p_cache_key: `news:${identity}`,
        p_company: identity,
        p_kind: "news",
        p_data: newsObj,
      });

      seeded++;
    } catch (err) {
      errors.push(`${company}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, candidates: pending.length, seeded, remaining: Math.max(0, pending.length - seeded), errors }),
    { headers: { "Content-Type": "application/json" } },
  );
});
