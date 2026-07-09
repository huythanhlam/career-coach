# F2: Streaming UX Everywhere — Design

**Date:** 2026-07-09
**Status:** Approved

## Goal

Every AI generation surface in TechCoach delivers **real, progressive output** instead of a spinner that resolves all at once, and every one of them can be **stopped mid-generation** and **announced to screen readers** as it streams. Concretely, for the two surfaces that don't already stream (resume/cover-letter drafting, company research) the user sees the document/summary fill in as it's written rather than waiting ~10-30s for a blank screen to complete; and across all six AI surfaces named in the roadmap (`docs/rebuild/ROADMAP.md` F2), a visible "Stop" control cancels an in-flight generation, and screen readers get sane (not per-token-spammy) announcements of streamed content.

## Why (problem with the current approach)

The earlier AI Core v2 rebuild already migrated 4 of F2's 6 named surfaces to real SSE streaming via `streamWorkflow()`/`createCoachingSession()`: coach chat (`GlobalChatPanel.tsx`), Goal Planner chat (`useGoalPlanningActions.ts`), Mock Interview (`MockInterviewWorkspace.tsx`), and Negotiation (`NegotiationRoleplayWorkspace.tsx`). Three gaps remain, none of which are "build streaming from scratch" — the SSE pipeline and gateway already support everything needed:

1. **Resume/cover-letter drafting and the DocumentEditor's revise-chat still fake-stream.** `ResumeGeneratorWorkspace.tsx`, `CoverLetterWorkspace.tsx`, and `DocumentEditor/index.tsx` all call `createTechCoachChat()` (`src/services/geminiService.ts:715-722`), whose `sendMessageStream` awaits the *entire* `generateWorkflowData()` response and hands it back as one fake "chunk". The `onChunk` plumbing that would render progressively already exists in all three call sites (`full += chunk; setContent(...)`) — it just never receives more than one chunk today.

2. **Company-research summaries (`researchCompanyProfile`/`researchCompanyNews`/`discoverCareerUrls` in `geminiService.ts:557-633`) are fully one-shot** — they call `runWorkflow()`, not `streamWorkflow()`. Unlike the free-text chat surfaces, these are grounded (`enableSearch: true`) structured-JSON workflows (`src/ai/workflows/companyResearch.ts`) whose shape is declared in the prompt (Gemini forbids `responseSchema` + search tools) and parsed client-side with permissive Zod schemas. The gateway's streaming branch (`supabase/functions/ai-gateway/index.ts:270-336`) already works with `enableSearch` — nothing server-side blocks this — but the client has no way to progressively reveal a **structured** object as it streams in as raw text.

3. **No surface has a visible "stop generating" control.** `GlobalChatPanel.tsx` is the only surface with an `AbortController` at all (`:73-74, 143-144`), and it's wired only to unmount/`clearConversation` — the clear button is `disabled={isGenerating}`, so there is no way to cancel an in-flight reply. Mock Interview, Negotiation, Goal Planner, and the document-drafting surfaces pass no `signal` to their generation calls at all.

4. **Live regions exist but don't serve their purpose.** `aria-live="polite"` is present in `GlobalChatPanel.tsx:244,282` and `MockInterviewWorkspace.tsx:1573,1677`, but only on typing-indicator/status text — and the message-list container itself is `role="log" aria-live="polite" aria-relevant="additions text"` (`GlobalChatPanel.tsx:~240`), which (once streaming is real, i.e. many small text mutations per second) would re-announce the growing bubble on every delta — a known anti-pattern that makes screen readers unusable during a stream, not an accessibility win.

## Design

### 1. `src/ai/workflows/documentDrafting.ts` (new)

A second free-text streaming workflow, structurally identical to `coachingChatWorkflow` (`src/ai/workflows/coachingChat.ts`) — reuses its `chatTurnSchema`/`ChatTurn` — but with its own workflow id `document_drafting` so `ai_usage` metering keeps document generation separate from coach-chat metering. Tier `QUALITY` (matches today's `generateWorkflowData` default for these surfaces). No `enableSearch` — confirmed neither `resume_generation` nor `cover_letter` configs in `src/config/workflows.ts` set `enableSearch: true`.

```ts
export const documentDraftingWorkflow = defineWorkflow({
  id: "document_drafting",
  tier: "QUALITY",
  inputSchema: z.object({
    systemInstruction: z.string(),
    history: z.array(chatTurnSchema),
    message: z.string(),
  }),
  buildSystem: ({ systemInstruction }) => systemInstruction,
  buildPrompt: ({ history, message }) => /* same transcript-replay shape as coachingChatWorkflow */,
});
```

### 2. Generalize `createCoachingSession` to take a workflow

`src/ai/coachingSession.ts` currently hardcodes `coachingChatWorkflow`. Add an optional second parameter:

```ts
export function createCoachingSession(
  systemInstruction: string,
  workflow: Workflow<{ systemInstruction: string; history: ChatTurn[]; message: string }, unknown> = coachingChatWorkflow,
): CoachingSession
```

No behavior change for existing callers (Mock Interview, Negotiation); document-drafting callers pass `documentDraftingWorkflow`.

### 3. Migrate the three document-drafting call sites off `createTechCoachChat`

`ResumeGeneratorWorkspace.tsx:135,156`, `CoverLetterWorkspace.tsx` (equivalent), `DocumentEditor/index.tsx:346` all replace `createTechCoachChat(...)` + `sendMessageStream(chat, prompt, onChunk)` with `createCoachingSession(systemPrompt, documentDraftingWorkflow)` + `session.send(prompt, onFullText, signal)`.

**One adaptation required at each call site:** `CoachingSession.send`'s callback delivers the *running full text* (already accumulated), whereas today's `onChunk` callback pattern does `full += chunk` (correct today only because `createTechCoachChat` always delivers exactly one chunk containing the whole reply). Each call site's accumulator changes from `full += chunk` to `full = fullTextSoFar` — a one-line change, three places. `extractDocument()` (`src/lib/aiDocFormat.ts:29`) already tolerates partial/streaming buffers (returns the body after `DOC_START` even before `DOC_END` arrives) — no change needed there, so the resume/letter body now visibly grows in the editor pane as it streams, exactly like the chat bubble.

`chatInstance`/`aiChat` (currently typed `any` in `DocumentEditor/types.ts:29`) becomes a `CoachingSession` — tightens that type as a side effect.

### 4. Progressive reveal for company research (structured, grounded output)

New `src/ai/partialJson.ts`: `extractCompleteStringFields(buffer: string, keys: string[]): Record<string, string>`. Scans the accumulating raw JSON-shaped text buffer with a small quote/escape-aware state machine (same spirit as `extractDocument`'s tolerance for partial input) and returns only the **top-level string fields, and each named section's `.summary` sub-field**, that have fully closed (closing unescaped quote reached, not just "string started"). Bullets/items/sources arrays are intentionally *not* streamed incrementally — v1 scope is prose fields only, matching the roadmap wording ("structured outputs stream their **prose fields** progressively and finalize the object on close"); arrays render only once the full object parses on stream close, same as today.

`researchCompanyProfile`/`researchCompanyNews` (`geminiService.ts:571-633`) gain streaming variants that call `streamWorkflow(companyProfileWorkflow, ...)` (gateway already supports `stream: true` + `enableSearch: true` together — confirmed in `ai-gateway/index.ts:238,270`), feed each token into `extractCompleteStringFields` against the known keys (`overview`, `hiringValues.summary`, `benefits.summary`, `interviewTips.summary`, `financials.summary`), and call an `onSection(partial)` callback so `useCompanyResearchHandlers.ts` can render each section's prose the moment it closes. On stream close, the full accumulated text is parsed and Zod-validated exactly as `runWorkflow` does today (fence-strip → `safeParse`) so the final object (with bullets/sources) is unchanged from today's behavior — this is a pure UX layer on top of the existing validated result, not a new data path.

### 5. Visible "Stop generating" control on all six surfaces

Small shared component `src/components/ui/stop-generating-button.tsx` (icon button, `aria-label="Stop generating"`, only rendered while `isGenerating`). Each surface already has (or, per §3, now has) a per-turn `AbortController`; wire the button to `controller.abort()` without clearing any other state (contrast with `GlobalChatPanel`'s existing "Clear conversation", which stays a separate, always-available action). Partial content is preserved everywhere, mirroring `GlobalChatPanel.streamReply`'s existing `if (controller.signal.aborted) return;` pattern (no error message shown for a user-initiated stop).

Concretely: `GlobalChatPanel.tsx` gets the button enabled *during* generation (today `Clear` is `disabled={isGenerating}` and nothing else exists); Mock Interview / Negotiation / Goal Planner / document-drafting each start passing a `signal` to `.send()`/`streamWorkflow()` for the first time and add the same button.

### 6. Fix live-region behavior: throttled announcer, not per-token spam

New hook `src/hooks/useStreamAnnouncer.ts`: takes the streamed text ref and returns a string to render in an off-screen `aria-live="polite" aria-atomic="true"` node, updated only (a) on a natural pause in tokens (~1.2s of no new delta) or (b) when the stream settles — never on every delta. Applied to the six surfaces' message regions, replacing the current always-on `aria-relevant="additions text"` on the full message log (`GlobalChatPanel.tsx`, `MockInterviewWorkspace.tsx`) which would otherwise re-announce the growing bubble continuously once these surfaces stream token-by-token. The visual bubble still updates every token as it does today — only the screen-reader announcement is throttled.

## Testing

- `src/ai/workflows/documentDrafting.test.ts` — mirrors `coachingChat.test.ts`: `buildSystem`/`buildPrompt` shape, transcript replay format.
- `src/ai/coachingSession.test.ts` — extend existing tests to cover passing a non-default workflow through to `streamWorkflow`.
- `src/ai/partialJson.test.ts` — pure-function unit tests: feed progressively-growing buffer fixtures (mid-string, string just closed, nested section closed, malformed/truncated tail) and assert exactly which keys are extractable at each point; no network/gateway involved.
- `src/hooks/useStreamAnnouncer.test.ts` — fake-timer test asserting no announcement fires before the pause threshold, one fires after it, and a final flush fires on stream-settle even if the pause threshold wasn't reached.
- Component-level: `ResumeGeneratorWorkspace`/`CoverLetterWorkspace`/`DocumentEditor` tests (if present) updated to mock `createCoachingSession` instead of `createTechCoachChat`, asserting the `full = fullTextSoFar` accumulation (not `+=`) renders correctly across multiple simulated token calls.
- Stop-button: a small render test per surface asserting the button is absent when not generating, present and calling `abort()` when generating.

## Out of scope

- Deleting `createTechCoachChat`/`sendMessageStream`/`geminiService.ts`'s legacy chat helpers, or the `WorkflowConfig.generatePrompt` config-dispatch pattern itself — that's the separately-tracked "Slice 4 cutover" (see `[[ai-core-v2-rebuild]]` memory), not named in F2's roadmap acceptance criteria. This spec only swaps the **transport** under `resume_generation`/`cover_letter`, not the prompt-building/config layer.
- Streaming arrays/bullets/sources progressively within company research — v1 streams prose fields only (`overview`, section `.summary`s); bullets and citations still appear on final settle.
- TTFT telemetry dashboards / `ai_usage.ttft_ms` production monitoring — the gateway already records `ttftMs` for every streaming call (`ai-gateway/index.ts` `done` event); this spec doesn't add new dashboards, just makes more surfaces emit real (not synthetic) TTFT values.
- A dropped-connection retry UI beyond what `streamWorkflow` already throws (pre-first-token retry is already handled by the client; this spec doesn't change that contract).
