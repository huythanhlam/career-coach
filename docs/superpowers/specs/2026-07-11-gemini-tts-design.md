# Gemini TTS — replace Kokoro + Hugging Face — Design

**Date:** 2026-07-11
**Status:** Approved — implemented

## Goal

Give the mock-interview and negotiation-roleplay voice features a single, simple
**Gemini-native** text-to-speech backend, replacing today's three-tier stack
(in-browser Kokoro ONNX model → optional Hugging Face/custom remote proxy →
browser `SpeechSynthesis`) with **Gemini TTS → browser `SpeechSynthesis`**.
User-visible outcome: same spoken-interview experience, but voice quality no
longer depends on a self-hosted ONNX model or a Hugging Face token, and — new —
**production gets a real neural voice for the first time** (today prod has none;
only dev's Express proxy could reach an HF/custom backend). One fewer external
service (Hugging Face), one fewer heavy client-side dependency (`kokoro-js` +
~86MB–326MB of ONNX/WASM artifacts), one fewer set of env vars.

## Why (problem with the current approach)

- **Three moving parts for one feature.** `src/services/kokoroTts.ts` +
  `kokoroWorker.ts` + `kokoroShared.ts` run a whole ONNX runtime in a Web
  Worker (WebGPU/multi-thread-WASM/single-thread-WASM fallback chain, a 30s
  GPU-probe deadline, forced-CPU respawn logic) purely to avoid paying for
  neural TTS. `server.ts`'s `/api/tts` then adds a *second* independent neural
  backend (Hugging Face Inference or a self-hosted `TTS_API_URL`) as a
  secondary tier. Three fallback layers, two of which need their own
  infra/tokens, for a feature that already has `GEMINI_API_KEY` available
  everywhere else in the app.
- **Prod has no neural voice at all.** `ttsService.ts` only points at a TTS
  URL in dev (`http://localhost:4000/api/tts`); there is no Edge Function
  equivalent. Production users only ever get Kokoro (if it loads) or the
  browser voice — Hugging Face/custom backends are dev-only today.
- **Cross-origin isolation exists solely for Kokoro.** `vite.config.ts` and
  `vercel.json` set `COOP: same-origin` / `COEP: credentialless` app-wide, and
  ship a Vite plugin that copies ONNX Runtime WASM artifacts into
  `public/ort/`, purely so Kokoro can get a `SharedArrayBuffer` for
  multi-threaded WASM. Removing Kokoro removes the reason for all of it.
- **Fragile audio decoding.** Kokoro emits 32-bit float WAV that sounds
  "scratchy/distorted" in some browsers, requiring a hand-rolled 16-bit PCM
  re-encode (`kokoroShared.ts: encodePcm16Wav`). Gemini TTS returns 16-bit PCM
  directly — no float-to-int conversion needed, just a WAV header.
- **Two consumers, one migration.** `MockInterviewWorkspace.tsx` and
  `NegotiationRoleplayWorkspace.tsx` both import from `kokoroTts.ts` — both
  need to move to the new backend together, or the negotiation feature is left
  half-migrated.

## Design

### 1. `server.ts` — dev `/api/tts` calls Gemini directly

Replace the current HF/custom-backend branch in `app.post('/api/tts', ...)`
with a call to `@google/genai` (already a project dependency, already used
identically in `supabase/functions/ai-gateway/index.ts`):

```ts
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: 'gemini-3.1-flash-tts-preview',
  contents: [{ parts: [{ text }] }],
  config: {
    responseModalities: ['AUDIO'],
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice ?? DEFAULT_VOICE } } },
  },
});
const b64 = response.candidates[0].content.parts[0].inlineData.data; // 16-bit PCM, 24kHz, mono
```

Wrap the decoded PCM bytes in a WAV header (44-byte RIFF header, same layout as
`kokoroShared.ts: encodePcm16Wav`, but simpler — Gemini's samples are already
int16, so no float→int conversion, just `Buffer.concat([header, pcmBytes])`)
and return `audio/wav` bytes, same response contract the frontend already
expects. No `text.length > 8000` cap change needed (Gemini's 8192-token input
limit is comparable). 501 semantics stay: if `GEMINI_API_KEY` is unset, the
frontend falls back to the browser voice, same as today.

### 2. `supabase/functions/ai-gateway/index.ts` — prod gets TTS for the first time

Extend the existing gateway (not a new Edge Function) with an optional
`modality: "audio"` request field, reusing the auth → monthly-cap →
rate-limit pipeline already in place (lines ~200–260) instead of building an
unauthenticated parallel path:

- When `modality === "audio"`: skip `responseSchema`/`tools`/`thinkingConfig`
  handling, set `responseModalities: ['AUDIO']` + `speechConfig`, and return
  `{ audio: <base64 PCM>, sampleRateHz: 24000 }` instead of `{ text }`. WAV
  wrapping happens client-side (browser `AudioContext`/manual header, same
  logic as the dev path) to avoid base64-decoding+re-encoding server-side
  twice.
- Token accounting: Gemini bills TTS output as audio tokens. Metering already
  reads `usageMetadata` off the response — confirm during implementation
  whether `usageMetadata` is populated for audio responses the same way, and
  whether audio tokens should count against `AI_MONTHLY_TOKEN_CAP` (open
  question, see Out of scope).
- This means the frontend's TTS client becomes an authenticated call (needs
  the Supabase session token), unlike today's anonymous `fetch(TTS_URL)` in
  `ttsService.ts`. It should reuse `src/ai/client.ts`'s existing
  auth-header/session plumbing rather than duplicating it.

### 3. `src/services/ttsService.ts` — dev/prod URL + auth unification

Today: dev hits `server.ts` unauthenticated, prod has no URL configured at
all. New: both dev and prod go through the same authenticated path used by
`src/ai/client.ts` (which already resolves `VITE_AI_GATEWAY_URL` and attaches
the Supabase auth header). `synthesizeSpeech` changes from a bare `fetch` to
using that client's request helper with `modality: "audio"`. Dev keeps working
without a Supabase login prompt because local dev already authenticates
against the local/linked Supabase project for other AI Core v2 workflows.

Env vars removed entirely from `.env.example`: `HF_API_TOKEN`, `HF_TTS_MODEL`,
`TTS_API_URL`, `TTS_API_KEY`, `TTS_VOICE`, `VITE_TTS_URL`. No new secret is
needed — `GEMINI_API_KEY` already exists dev + prod.

### 4. `src/hooks/useSpeech.ts` — drop Kokoro tier, keep pipelining

Voice priority becomes: **1. Gemini TTS (via `ttsService.ts`) → 2. browser
`SpeechSynthesis`.** Keep the existing per-sentence pipelining pattern
(`splitForSpeech` + prefetch-next-while-current-plays) — swap
`speakKokoroStreaming`'s generator function from `kokoroGenerate` to
`synthesizeSpeech`, since Gemini's REST endpoint is not confirmed to support
server-sent streaming on the model this design targets (see Out of scope).
Per-sentence `generateContent` calls are short (one sentence of text in, one
short audio clip out), so this keeps today's time-to-first-audio behavior
without betting on an unverified streaming API.

Remove: `remoteDownRef` fallback semantics stay (still useful — if Gemini TTS
fails for a request, fall back to browser voice for that turn, retry next
turn), but the `isKokoroVoice`/`kokoroFailed` branch and its imports are
deleted.

### 5. Delete Kokoro entirely

- `src/services/kokoroTts.ts`, `src/services/kokoroWorker.ts`,
  `src/services/kokoroShared.ts` (WAV-encoding logic gets ported into
  `server.ts`/the Edge Function first, per §1).
- `kokoro-js` dependency removed from `package.json`.
- `vite.config.ts`: remove the ORT-WASM-artifact-copy plugin and the
  `COOP`/`COEP` headers (dev + preview) — no other feature in the app needs
  cross-origin isolation today (confirmed: only Kokoro's
  `SharedArrayBuffer`-based multi-threading required it).
- `vercel.json`: remove the matching `COOP`/`COEP` header block.
- `public/ort/` build output and the emit-file logic that populates it.

### 6. Voice selection UI

`MockInterviewWorkspace.tsx`'s setup-screen voice picker currently offers 5
Kokoro voices persisted to `localStorage["interviewVoice"]`
(`af_heart`/`af_bella`/`af_nicole`/`bf_emma`/`am_michael`). Replace with 4
Gemini prebuilt voices, chosen from Google's official style-descriptor table
(`ai.google.dev/gemini-api/docs/speech-generation`) to span firm/informative
→ upbeat/energetic:

| Voice | Descriptor | Interviewer feel |
|---|---|---|
| `Charon` | Informative | Firm, neutral, professional — straightforward interviewer |
| `Aoede` | Breezy | Light, easygoing, still professional |
| `Achird` | Friendly | Warm, encouraging |
| `Puck` | Upbeat | Energetic, enthusiastic |

Picked from descriptors, not by ear — do one real listening pass during
implementation and swap any voice that doesn't land right (e.g. `Charon` for
`Kore`/`Orus`, both also "Firm", if `Charon` sounds off). `isKokoroVoice`-style
validation becomes `isGeminiVoice`, checking membership in this 4-voice list;
an old `localStorage` value that doesn't match (e.g. a stale `af_heart`) falls
back to the default (`Charon`) — no real migration needed, it's just a client
preference key.

`NegotiationRoleplayWorkspace.tsx`'s three `kokoroTts` imports
(`DEFAULT_KOKORO_VOICE`, `preloadKokoro`, `isKokoroVoice`) move to the
equivalent Gemini-voice constants/helpers; `preloadKokoro()` (which warmed the
ONNX model) has no Gemini equivalent and is simply dropped — there's nothing
to preload for a stateless HTTP TTS call.

### 7. Model choice — `gemini-3.1-flash-tts-preview`

Target model ID: **`gemini-3.1-flash-tts-preview`** ("Gemini 3.1 Flash TTS").
Confirmed via `ai.google.dev` docs to exist and support `generateContent` with
`responseModalities: ['AUDIO']`. This is Google's newest, lowest-latency TTS
model and matches the 3.1 family this app already standardized on for text
(`gemini-3.1-flash-lite`), which is some (not conclusive) signal it's more
likely to have quota on this account's plan than the 2.5 line — this plan
already hit an unexpected 429 on `gemini-2.5-flash` for text and moved off it
(see `src/config/models.ts`).

**Important caveat, called out explicitly per user decision:** as of this
writing, **every** Gemini TTS-capable model — including this one — is a
*preview* release; Google has not shipped a GA/stable TTS model. The model ID
literally contains `-preview`. The user has accepted this tradeoff (chosen
over `gemini-2.5-flash-preview-tts` and over holding off entirely) rather than
waiting for GA. Implementation risk this implies:
- Preview models can change behavior/be deprecated with less notice than GA
  models — no long-term API stability guarantee.
- **Before implementing, make one real API call with this project's
  `GEMINI_API_KEY` to confirm the account's plan actually has quota for
  `gemini-3.1-flash-tts-preview`** specifically (TTS quota is very likely a
  separate bucket from text-generation quota, so gemini-3.1-flash-lite having
  quota does not guarantee this model does).
- If `gemini-3.1-flash-tts-preview` turns out to be unavailable/unquota'd on
  this plan, the fallback target is `gemini-2.5-flash-preview-tts` (same
  `generateContent`/`speechConfig` shape, swap only the model ID string) —
  revisit with the user before silently substituting it.

## Testing

- `vitest`: `server.ts`'s WAV-wrapping helper (PCM bytes → valid WAV blob) —
  pure function, unit-testable without a real Gemini call (inject a fixed
  byte buffer).
- `vitest`: `useSpeech.ts`'s fallback logic (Gemini call throws →
  `speakBrowser` invoked) — mock `synthesizeSpeech` to reject, assert browser
  `SpeechSynthesis` path runs (existing test file `useSpeech.test.ts` already
  covers `splitForSpeech`; extend it, don't replace it).
- `vitest`: `ttsService.ts`'s auth-header attachment — mock the shared
  `ai/client.ts` request helper.
- Manual: one real Gemini TTS call per environment (dev `server.ts`, prod
  Edge Function) to confirm audio actually plays and the chosen model id has
  quota — cannot be meaningfully unit-tested.
- `npm audit --omit=dev` after removing `kokoro-js` (dependency removal, not
  addition, so this should only shrink the audit surface).

## Out of scope

- **Streaming audio** (Gemini's `stream: true` chunked-delta TTS, if
  available on this account's plan) — per-sentence `generateContent` calls
  already deliver the "first sentence plays while the rest generate" UX this
  app wants; revisit only if per-sentence latency turns out to be worse than
  Kokoro's local inference.
- **Whether TTS audio tokens count against `AI_MONTHLY_TOKEN_CAP`** — needs a
  product decision once real usage/cost data exists; ship without a TTS-
  specific cap for v1, rely on the existing per-user rate limiter
  (`RATE_MAX_PER_WINDOW`) to bound abuse.
- **Multi-speaker TTS** (Gemini supports it; not needed — the interviewer is
  always a single voice).
- Any change to the `interview` (doc-generator) workflow — it has no voice
  component and is untouched.
