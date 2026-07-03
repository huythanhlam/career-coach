# AI Core v2 — Slice 3 (SSE streaming + conversation persistence) — manual verification

**What's automated vs. what needs a live deploy.** The sandbox has no
`supabase functions serve` + real Gemini key, so the TTFT exit criterion (p50
< 1.5s on chat) cannot be measured here. Everything below the "Unit-verified"
line is proven by `npm test`; everything under "Needs a live deploy" is for a
human to run against a real Gemini key.

## Unit-verified (CI, no network)

- **SSE frame parser** (`src/ai/sse.ts`) — `src/ai/sse.test.ts`: event/data
  parsing, one-leading-space stripping, multi-line `data:`, comments, CRLF,
  partial frames reassembled across buffer feeds.
- **`streamWorkflow`** (`src/ai/client.ts`) — `src/ai/streamWorkflow.test.ts`:
  token ordering + assembled text, `sources`/`done`/`error` frames, malformed
  frame tolerance, request body carries `stream:true` + `conversationId` +
  `userMessage`, caller-abort short-circuits retry, retry-before-first-token on
  a transient 503, and **no** retry once a token has streamed.
- **Coach workflow** (`src/ai/workflows/coachingChat.ts`) —
  `coachingChat.test.ts`: free-text QUALITY tier, transcript replay ending on
  `Coach:`, role-enum validation.

Full gauntlet green on this branch: `npm run lint`, `npm run typecheck:strict`
(16/16 baseline), `npm run lint:eslint` (222/222 baseline), `npm run
format:check`, `npm test` (465 passing), `npm run build`.

## Needs a live deploy (human)

### 1. Apply the migrations
`supabase/migrations/**` is write-protected, so the new tables are staged:

```bash
git mv supabase/pending_migrations/20260703000000_add_ai_usage.sql          supabase/migrations/
git mv supabase/pending_migrations/20260703000001_add_ai_conversations.sql  supabase/migrations/
supabase db push
supabase gen types typescript --linked > supabase/types.ts   # do not hand-edit
```

### 2. Run the gateway locally
There is no `npm run dev:functions` script yet (the spec names one; add it when
convenient). Run the function directly:

```bash
supabase functions serve ai-gateway --env-file supabase/functions/.env
# .env needs: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY,
#             SUPABASE_SERVICE_ROLE_KEY, (optional) AI_MONTHLY_TOKEN_CAP
```

Point the frontend at it: set `VITE_AI_GATEWAY_URL` (or `VITE_SUPABASE_URL`) so
`GATEWAY_URL` in `src/ai/client.ts` resolves to the served function, then
`npm run dev`.

### 3. Exercise a chat surface
Open the **Global Coach** (sidebar chat panel) and send a message.

- **Streaming:** tokens should render progressively (not appear all at once).
- **Persistence:** a `user` then a `model` row should appear in `ai_messages`
  under a header in `ai_conversations`:
  ```sql
  select role, left(content, 60), created_at
    from ai_messages
   where conversation_id = (select id from ai_conversations
                             order by updated_at desc limit 1)
   order by created_at;
  ```
- **Reload:** the conversation id persists in `localStorage.coachConversationId`,
  so a new turn after refresh appends to the same conversation.
- **Metering:** each turn writes one `ai_usage` row with a non-null `ttft_ms`:
  ```sql
  select workflow_id, ttft_ms, latency_ms, input_tokens, output_tokens
    from ai_usage order by created_at desc limit 3;
  ```

Also spot-check **Goal Planning** coaching (generate a plan, ask a follow-up):
tokens should stream. (Goal Planning keeps its existing storage-based transcript
persistence — it does not yet write to `ai_conversations`; see Remaining.)

### 4. Measure TTFT (exit criterion: p50 < 1.5s)
Read it straight from the meter after ~10 chat turns:

```sql
select percentile_disc(0.5) within group (order by ttft_ms) as p50_ttft_ms
  from ai_usage
 where workflow_id = 'coaching_chat' and created_at > now() - interval '15 min';
```

Or in the browser DevTools Network tab: the `ai-gateway` request's "TTFB"
approximates time-to-first-token for the SSE response.

## Remaining after this slice

- **Other chat surfaces:** Mock Interview (`MockInterviewWorkspace.tsx`) and
  Negotiation (`NegotiationRoleplayWorkspace.tsx`) still use the retained
  fake-streaming helpers (`createCoachingChat` / `sendMessageStream` in
  `geminiService.ts`). Migrate them to `streamWorkflow` in a follow-up.
- **Goal Planning DB persistence:** streams for real but still persists its
  transcript to storage blobs; wiring it to `ai_conversations` is deferred.
- **Slice 2b / Slice 4:** cutover — deleting `geminiService.ts`, the `server.ts`
  AI path, `ai-generate`, and `looseJson.ts` — is Slice 4 and intentionally not
  done here (the app stays green with both layers present).
