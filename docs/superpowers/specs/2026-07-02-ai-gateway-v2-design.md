# AI Core v2 — Unified `ai-gateway` — Design

**Date:** 2026-07-02
**Status:** Approved (P1 of the rebuild — see `docs/rebuild/DEVELOPMENT_PLAN.md` §6, Phase 1). Confirmed decisions: thin schema-forwarding gateway; add `zod` ^4; recorded-fixture eval CI default; build in four vertical slices, Slice 1 shipped first for review.
**Companion docs:** `docs/rebuild/DEVELOPMENT_PLAN.md`, `docs/rebuild/ROADMAP.md`

## Goal

Replace the split AI layer with **one Gemini gateway that runs identically in dev and prod**, add **real SSE streaming**, **native `responseSchema` structured output**, a **typed workflow registry**, **conversation persistence**, **per-call usage metering with a hard monthly cap**, and a **golden-set eval suite**. At cutover, `src/services/geminiService.ts`, the AI path of `server.ts`, and `supabase/functions/ai-generate/` are deleted (Development Plan §8).

## Current state (verified in code)

- **Two AI backends, different vendors.**
  - Dev: `server.ts` `POST /api/ai/generate` shells out to the local **Claude CLI** (`spawn('claude', ['--print'])`), returns `{ text, sources: [] }`.
  - Prod: `supabase/functions/ai-generate/index.ts` calls **Gemini** but `toGeminiModel()` remaps *both* declared tiers (`sonnet`, `haiku`) to `gemini-3.1-flash-lite`. Prompts are tuned against Claude locally and never run against the shipped model.
- **Model tiers are Claude names.** `src/config/models.ts`: `FAST="claude-haiku-4-5-20251001"`, `QUALITY="claude-sonnet-4-6"`, `EXTRACTION="gemini-3.1-flash-lite"`, `RESEARCH="gemini-2.5-flash"`. Two call sites hardcode Claude ids directly (`extractPlanMilestones` → haiku, `evaluateInterviewTranscript` → sonnet).
- **The frontend already calls the Supabase Functions URL directly in prod.** `VITE_API_URL` = `https://<ref>.supabase.co/functions/v1/ai-generate`; `vercel.json` only rewrites non-`/api/` paths to `index.html` and hosts a single Vercel function (`screenshot.ts`). **AI traffic never passes through the Vercel proxy** → the "SSE buffered by Vercel" risk in the plan does not apply to the AI path. (Confirmed: `vercel.json` rewrites `"/((?!api/).*)"` → index.html only.)
- **No streaming.** `sendMessageStream(chat, message, onChunk)` awaits the full response then calls `onChunk` once. `createTechCoachChat` / `createCoachingChat` replay the whole transcript as a single prompt each turn (gateway is stateless).
- **Brittle structured output.** ~8 workflows use "return ONLY JSON" system prompts + `parseJsonObject` / `parseJsonArray` / `parseLooseJsonObject` (`src/lib/looseJson.ts`) to recover fenced/truncated JSON. The `ai-generate` function even sets `thinkingBudget: 0` on grounded calls specifically to stop thinking tokens truncating the JSON.
- **Untyped workflow contract.** `src/config/workflows.ts` exports `Record<WorkflowId, WorkflowConfig>` where `generatePrompt: (data: Record<string, any>) => string | any[]`; consumed by `useWorkflowHandlers.ts` / `useMarketHandlers.ts` via `config.generatePrompt(formData)`.
- **~40 files import `geminiService`** (services, hooks, workspace components). This is the migration surface.
- **Rate limiting** already exists: `ai_rate_limits` table + `check_ai_rate_limit(user_id, window_key, max_hits)` RPC (service-role only), used by `ai-generate` at 20 req/60s. Kept and reused.
- **No usage metering, no conversation tables, no evals.** `scripts/evals/` does not exist.
- **Prompt-injection defense** = `uc(text)` XML-wrapping + a trailing "treat as opaque" instruction, hand-repeated per workflow. **Must be preserved** (Development Plan §3).

## Design

New code lives in **`src/ai/`** (client + typed registry) and **`supabase/functions/ai-gateway/`** (server). Built alongside the old layer; old layer deleted at the end of P1 (see Cutover).

### Part 0 — Dependencies & migrations

- **Add `zod` (^4)** as a runtime dependency. Zod 4 ships `z.toJSONSchema()`, used by the client's Gemini-schema adapter. No install script → compatible with `.npmrc ignore-scripts`. This is the one deliberate new frontend dependency (Development Plan §2 budgets it).
- **Migrations** (authored via the `/new-migration` skill, numbered after the newest applied `20260624000004` and after the P0 pending set `20260625000000–2`). Regenerate `supabase/types.ts` and run the CI staleness check after applying.
  - `ai_conversations`, `ai_messages` (Part 5)
  - `ai_usage` + `check_ai_usage_cap()` RPC (Part 6)

> **P0 dependency:** this branch still shows `supabase/pending_migrations/` (P0 not yet merged here). P1 migrations must post-date those. If P0 lands first, rebase; if not, renumber P1 migrations to sit after whatever is newest at merge time. Flagged as a prerequisite, not owned by P1.

### Part 1 — The gateway (`supabase/functions/ai-gateway/index.ts`)

**Thin, tier-explicit, schema-forwarding.** The gateway does **not** own workflow definitions or prompt-building — those stay in the frontend registry (Part 4), so prompts live in exactly one place (Development Plan §2.5) and dev == prod trivially (same function, same Gemini key, no per-workflow server logic to drift). The gateway is a generic, authenticated, metered Gemini proxy.

**Request body** (superset of today's shape, so migration is incremental):
```ts
{
  workflowId: string;          // for metering/labeling only
  systemInstruction?: string;
  prompt: string | Part[];     // Part[] preserves the inlineData (PDF) path used by salary/cover_letter
  tier: "FAST" | "QUALITY" | "RESEARCH";   // explicit — no name remapping
  enableSearch?: boolean;
  responseSchema?: object;     // Gemini OpenAPI-subset schema (client-converted from Zod); omitted for grounded calls
  stream?: boolean;
  conversationId?: string;     // when set, gateway appends the turn to ai_messages
}
```

**Pipeline** (fail-closed):
1. CORS via `_shared/cors.ts` (reuse; fail-closed unchanged).
2. Auth: verify the Supabase JWT (`verifyUser`, ported from `ai-generate`). 401 on failure.
3. **Usage cap** (Part 6): `check_ai_usage_cap(user_id, monthly_token_cap)` → 429 `{ error: "monthly_cap" }` **before any provider call**.
4. Rate limit: existing `check_ai_rate_limit` (20/60s) → 429.
5. Resolve `tier → model id` via a **server-side tier map** that mirrors `src/config/models.ts` (single constant, asserted equal in CI — see "dev==prod assertion").
6. Call Gemini (`@google/genai`), streaming or not:
   - **Structured, non-grounded:** `config.responseSchema` + `responseMimeType: "application/json"`. (Native structured output — replaces the loose parser.)
   - **Grounded (`enableSearch`):** `tools:[{googleSearch:{}}]` + `thinkingConfig.thinkingBudget: 0`. **Gemini forbids `responseSchema` together with tools**, so grounded workflows keep prompt-declared JSON and are validated client-side with their Zod schema (still no *loose recovery* — strict `JSON.parse` + `schema.parse`). This limitation is called out per-workflow in Part 4.
7. Meter: write one `ai_usage` row (`input_tokens`, `output_tokens`, `latency_ms`, `ttft_ms`, `est_cost`, `model`, `workflow_id`) from `response.usageMetadata`.
8. Persist: if `conversationId` set, append user + model messages to `ai_messages`.

**Streaming response.** `stream:true` → `Content-Type: text/event-stream`, body driven by `ai.models.generateContentStream`. Event lines:
- `event: token\ndata: {"delta":"…"}` per chunk
- `event: sources\ndata: [{label,url}]` once (grounding metadata, when present)
- `event: done\ndata: {"usage":{…}}` at end
- `event: error\ndata: {"message":"…"}` on failure (generic; provider details logged server-side only, never echoed — preserves the `ai-generate` posture).

`ttft_ms` = time to first `token` event.

**Dev == prod.** `npm run dev:functions` → `supabase functions serve ai-gateway --env-file supabase/functions/.env` (localhost:54321). `VITE_API_URL` points at that in dev, at the deployed function in prod. `server.ts`'s `/api/ai/generate` is deleted; its non-AI proxies (`/api/tts`, `/api/fetch-url`, `/api/stock-history`, `/api/bls`, `/api/screenshot`) are **out of scope for P1** and stay in `server.ts` (their consolidation into `proxy` is a later phase, Development Plan §8).

### Part 2 — Real model tiers (`src/config/models.ts`)

```ts
export const MODELS = {
  FAST: "gemini-3.1-flash-lite",   // was claude-haiku; also absorbs the old EXTRACTION tier
  QUALITY: "gemini-3.5-flash",     // was claude-sonnet
  RESEARCH: "gemini-3.5-flash",    // grounded (googleSearch) — exact id re-verified at build (see note)
} as const;
export type ModelTier = keyof typeof MODELS;
```
- Drop `EXTRACTION` (fold into `FAST`) and every Claude id. The two hardcoded Claude call sites move to `tier: "FAST"` (milestones) and `tier: "QUALITY"` (interview eval).
- **RESEARCH id is re-verified at build.** `geminiService.ts` documents that 3.x-flash *preview* models return HTTP 429 on grounding for the current key while `gemini-2.5-flash` is verified working. If 3.5-flash grounding isn't enabled on the project's billing tier at build time, RESEARCH stays `gemini-2.5-flash`. The eval suite (Part 7) gates the choice.
- The **server tier map** in the gateway imports/mirrors this; a CI check asserts the two are identical (Part "dev==prod assertion").

### Part 3 — Client (`src/ai/client.ts`)

Single entry point to the gateway; replaces `postToGatewayRaw`/`postToGateway`/`generateWorkflowData`.

```ts
runWorkflow<TOut>(wf, input, opts?): Promise<{ data: TOut; sources: SourceLink[]; raw: string }>
streamWorkflow(wf, input, { onToken, onSources, signal }): Promise<{ text; sources; usage }>
```
- `runWorkflow` — non-streaming. Builds prompt + system from the workflow, attaches `responseSchema` (non-grounded) or not (grounded), POSTs, then **validates with the workflow's Zod `outputSchema`** (`schema.safeParse`). On parse failure returns a typed error the caller renders (mirrors today's "surface the classified gateway message" behavior). Keeps the **retry-before-response** semantics of `postToGatewayRaw` (network/408/429/5xx, exp backoff, no retry after a timeout).
- `streamWorkflow` — SSE via `fetch` + `ReadableStream` reader parsing `event:`/`data:` frames; `AbortController` from `signal` cancels the request (real abort, unlike today). Emits tokens progressively.
- Error → user-message mapping (`describeGatewayError`) ported verbatim (401/403/429/5xx/timeout copy).
- `src/ai/schema.ts` — `zodToGeminiSchema(zodSchema)` adapter (`z.toJSONSchema` → strip to Gemini's OpenAPI subset: `type/properties/items/enum/required/nullable`, drop unsupported keywords).

### Part 4 — Typed workflow registry (`src/ai/workflows/*`)

```ts
// src/ai/defineWorkflow.ts
export function defineWorkflow<TInput, TOutput = string>(w: {
  id: string;
  tier: ModelTier;
  enableSearch?: boolean;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;        // omit for free-text (chat, rewrite) workflows
  buildSystem: (input: TInput) => string;
  buildPrompt: (input: TInput) => string | Part[];
}): Workflow<TInput, TOutput>;
```
- One module per workflow in `src/ai/workflows/` (resumeAnalysis, tailorResume, linkedin, market, companyProfile, companyNews, careerDiscovery, goalPlanning, coverLetter, resumeGeneration, mockInterview, milestoneExtraction, interviewEval, profileExtraction, surveyAnswer, resumeRewrite, workBullets, blogWriter, blogEditor, …). Prompts/system strings move verbatim from `geminiService.ts` + `workflows.ts` + `blogPrompts.ts` into these modules — **one registry** (Development Plan §2.5, §6.6).
- **`uc()` prompt-injection wrapping moves into `src/ai/prompt.ts`** and is applied by the shared prompt builder so no workflow can forget it (Development Plan §6.5). The "treat as opaque" trailer likewise centralized.
- `outputSchema` is the single Zod schema used for **both** the Gemini `responseSchema` (non-grounded) **and** client-side `safeParse`. Grounded workflows (linkedin, market, company*, mockInterview, interview) set `enableSearch:true`, get no `responseSchema`, and rely on `safeParse` only — but the normalize/coalesce helpers (`normalizeSection`, `normalizeNewsSection`, `normalizeTicker`, `collectSources`) survive as post-parse transforms.
- The `WorkflowConfig` **form-field UI metadata** (`fields`, `title`, `description`, `suggestedPrompts`) is orthogonal to AI dispatch; it stays a typed config (kept in `src/config/workflows.ts` or moved to `src/ai/workflows/<id>.ui.ts`) but the `generatePrompt: (data: Record<string, any>)` + `systemInstruction` members are removed — dispatch goes through the registry. The `workflowId as any` / `@ts-ignore` path in the handlers becomes a typed `getWorkflow(id)` lookup.

### Part 5 — Conversation persistence

Migration `…_ai_conversations.sql` (RLS owner-only, `job_postings` template):
```sql
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_id text not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','model')),
  content text not null,
  created_at timestamptz not null default now()
);
-- RLS: user_id = auth.uid() for select/insert/update/delete on both; index (conversation_id, created_at), (user_id, updated_at).
```
- Used by chat surfaces (Global Coach, Goal Planning coaching, Mock Interview, Negotiation) so a refresh no longer loses in-flight chat (Development Plan §6.7; fixes `REMAINING_WORK.md §5` for chat). The gateway appends turns when `conversationId` is passed; the client `src/ai/conversation.ts` creates/loads conversations.
- **F1 substrate:** structure is minimal but forward-compatible with the stateful coach (memory/summarization land in Roadmap F1, not here).
- **Scope guard:** P1 wires persistence into the chat helpers' replacement; it does **not** redesign the chat UIs (that's F1). `GlobalChatPanel.tsx` is rebuilt in F1, so P1 only swaps its `geminiService` calls for the new client without restructuring it.

### Part 6 — Usage metering + hard cap

Migration `…_ai_usage.sql`:
```sql
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_id text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  latency_ms int,
  ttft_ms int,
  est_cost numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);
-- RLS: owner-only select; inserts are service-role (gateway) only. Index (user_id, created_at).

create or replace function public.check_ai_usage_cap(p_user_id uuid, p_cap bigint)
returns boolean language sql security definer set search_path = public as $$
  select coalesce(sum(input_tokens + output_tokens), 0) >= p_cap
    from public.ai_usage
   where user_id = p_user_id and created_at >= date_trunc('month', now());
$$;
-- execute granted to service_role only (mirrors check_ai_rate_limit).
```
- Gateway calls `check_ai_usage_cap` in step 3 (before provider) and writes an `ai_usage` row in step 7. Cap value from a gateway env var (`AI_MONTHLY_TOKEN_CAP`, default generous, e.g. 2_000_000) — configurable insurance until billing (Roadmap F4).
- `est_cost` from the Gemini list prices in Development Plan §9 (flash-lite $0.25/$1.50, 3.5-flash $1.50/$9 per M in/out), computed in the gateway from token counts + model.

### Part 7 — Golden-set eval suite (`scripts/evals/`)

- `scripts/evals/fixtures/<workflow>.json` — input fixtures + rubric expectations per workflow.
- `scripts/evals/<workflow>.eval.test.ts` — vitest suite that runs the workflow through the gateway (or a recorded-response harness for offline CI) and asserts: **(a) output passes the Zod `outputSchema`**, **(b) rubric-level checks** (e.g. resume analysis returns 6–15 improvements with `originalText` substrings present in the source; market returns 1–2 locations with histogram buckets summing to 100).
- **Live vs offline:** live calls use the **Gemini free tier for dev/CI only** (Development Plan §9 — never prod user data). CI default runs against **committed recorded fixtures** (deterministic, no network/key); a `--live` opt-in re-records. Evals **gate any tier/prompt change** (run before/after, diff).
- `npm run evals` script added.

### dev == prod assertion (CI)

A tiny CI step (Development Plan Phase 1 exit "dev and prod provably run the same models") asserts:
1. The gateway's server tier map === `src/config/models.ts` `MODELS` (shared JSON or a test that imports both).
2. No Claude model id string remains in `src/` or `supabase/functions/` (grep gate).
3. `parseLooseJsonObject` / `parseJsonObject` / `parseJsonArray` have zero references outside their own (to-be-deleted) module.

## Data flow (chat, streaming)

```
UI → streamWorkflow(coachChat, {message, conversationId})
  → POST /functions/v1/ai-gateway {tier:QUALITY, stream:true, conversationId}
  → auth → cap → rate-limit → gemini.generateContentStream
  → SSE: token* → sources? → done{usage}
  → client renders tokens progressively (abortable)
  → gateway writes ai_usage row + appends user/model rows to ai_messages
```

## Testing

- **Unit (vitest):** `zodToGeminiSchema`, `client.ts` SSE frame parser + abort, `describeGatewayError` mapping, each workflow's `buildPrompt`/`buildSystem` (snapshot the prompt incl. `uc()` wrapping), normalize helpers (kept).
- **Gateway:** Deno-testable handler units for tier resolution, cap/rate-limit branching (mocked RPCs), SSE framing.
- **Evals (Part 7):** schema + rubric per workflow.
- **CI additions:** `npm run evals`, the dev==prod assertion, the no-loose-parser / no-Claude-id greps. `npm run lint` + `npm test` + `npm run build` green.

## Cutover & deletion (P1 exit — Development Plan §8)

Delete only after all 21 features run on the new core:
- [ ] `src/services/geminiService.ts`
- [ ] `server.ts` `POST /api/ai/generate` + `callClaude` (keep the non-AI proxies)
- [ ] `supabase/functions/ai-generate/`
- [ ] `src/lib/looseJson.ts` and every loose-parse call site
- [ ] `generatePrompt: Record<string, any>` contract + `workflowId as any` cast
- [ ] Claude model ids everywhere

**Exit criteria (Development Plan §6, Phase 1):** unified gateway dev==prod (CI-asserted); native `responseSchema` on all non-grounded structured workflows, zero JSON-recovery paths; SSE end-to-end with abort, **TTFT p50 < 1.5s on chat**; typed `defineWorkflow` registry; `ai_conversations`/`ai_messages` live; every call metered + hard cap enforced; eval suite green.

## Proposed build order (vertical slices, app stays shippable)

1. **Slice 1 — Gateway + client skeleton.** New `ai-gateway` (non-stream first) accepting today's body shape + `tier`; `src/config/models.ts` → real Gemini ids; `src/ai/client.ts`. `ai-generate` still present. Prove one workflow (resume analysis) end-to-end with native `responseSchema` + Zod validate. Migrations for `ai_usage` + metering + cap land here.
2. **Slice 2 — Registry migration.** Move all non-chat workflows into `src/ai/workflows/*` behind `defineWorkflow`; repoint their call sites; delete their loose-parse paths.
3. **Slice 3 — Streaming + conversations.** SSE in gateway + `streamWorkflow`; `ai_conversations`/`ai_messages`; migrate chat surfaces (coach, goal planning, mock interview, negotiation). Hit TTFT target.
4. **Slice 4 — Evals + cutover.** `scripts/evals/`, dev==prod CI assertion, then delete `geminiService.ts` / `ai-generate` / `server.ts` AI path / `looseJson.ts`.

## Non-goals (P1)

- TanStack Router/Query, PostHog, component/E2E tests (Phases 2–3).
- Consolidating the non-AI proxies (`bls`/`stock-history`/`fetch-url` → `proxy`) — separate §8 item.
- Kokoro/TTS deletion (Phase 4).
- Rebuilding chat UIs / coach memory (Roadmap F1) — P1 only ports their AI calls and adds the persistence substrate.
- Billing/quotas UI (Roadmap F4) — P1 ships only the hard cap + metering.

## Open questions for confirmation

1. **Thin schema-forwarding gateway** (client owns the registry; gateway is a generic metered proxy) vs a fat gateway that re-hosts the registry server-side. Recommendation: **thin** (prompts in one place, dev==prod trivial, no cross-runtime prompt duplication).
2. **Add `zod` ^4** as the schema library (needed for `responseSchema` + validation). Recommendation: **yes** (the plan's chosen approach; one budgeted dependency).
3. **Eval CI mode:** recorded-fixtures by default (deterministic, keyless) with a `--live` re-record opt-in. Recommendation: **recorded default**.
4. **Session scope:** land P1 as the four vertical slices above across iterations, or a narrower first PR (Slice 1 only) for review before the rest?
