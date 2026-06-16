# Remaining Improvement Work

Instructions for the workstreams deliberately left out of PR #35
(*Performance, UX, and hardening improvements from codebase review*). That PR
landed Phases 1–3: code-splitting and vendor chunking, hash routing, chat
persistence, gateway timeout/retry with classified errors, the toast system,
context/memoization fixes, CORS fail-closed, and assorted server hardening.
This branch (`claude/remaining-improvements-fpefeq`) is for everything below.

## Ground rules

- Work one workstream per commit (or per PR if a workstream grows large).
  Several of these are wide refactors — keep them reviewable.
- Before every commit: `npm run lint` (tsc), `npm test`, `npm run build`.
  Do not regress the entry bundle: it must stay under ~150 KB gzipped
  (`dist/assets/index-*.js`); heavy vendors stay in their `pdf` / `charts` /
  `markdown` / `docs` chunks (see `vite.config.ts` `manualChunks`).
- Reuse what Phases 1–3 introduced rather than re-inventing:
  - `toast()` / `<Toaster />` — `src/components/ui/toast.tsx`
  - `useUnsavedChangesWarning(isDirty)` — `src/hooks/useUnsavedChangesWarning.ts`
  - `MODELS` — `src/config/models.ts` (never hardcode model ids)
  - `configurePdfWorker` — `src/lib/pdfWorker.ts`
  - Hash routing (`#/view_id`) — see `viewFromHash` / `handleSelectView` in `src/App.tsx`
- Behavior-preserving refactors only, unless the item says otherwise. When a
  workstream changes visible behavior, say so in the commit message.

---

## 1. Decompose the oversized components

Largest first; each is its own commit. Target: no component file over ~400
lines, child sections wrapped in `React.memo` where props allow.

| File | Lines | Suggested extraction |
|---|---|---|
| `src/components/DocumentEditor.tsx` | ~1,470 | `EditorToolbar`, `AiSuggestionsPanel`, `ExportMenu` (docx/pdf logic → `src/lib/export/`), theme/style injection → hook |
| `src/components/ResumeGenerationForm.tsx` | ~1,430 | `PersonalInfoSection`, `WorkHistorySection`, `EducationSection`, `SkillsSection`, `TemplatePicker`; collapse the ~33 `useState` hooks into a `useReducer` per section |
| `src/components/JobPostingsWorkspace.tsx` | ~1,100 | `PostingList`, `PostingDetail`, `ScanControls`, draft-generation actions → `src/hooks/usePostingDrafts.ts` |
| `src/components/GoalPlanningWorkspace.tsx` | ~1,050 | `IntakeFlow`, `PlanView`, `MilestoneList` |
| `src/components/WorkflowView.tsx` | ~1,000 | One file per workflow body (market, company research, mock interview, …) under `src/components/workflows/`; keep `WorkflowView` as a thin dispatcher |

Acceptance: identical behavior, all checks green, files under target size.

## 2. Migrate inline styles to Tailwind tokens

~1,900 `style={{ … }}` objects reference CSS vars by hand. The palette in
`src/index.css` is already exposed to Tailwind 4 via `--color-*` aliases in
`@theme` — extend that mapping if a var is missing.

- Migrate per component, starting with the files in workstream 1 *as they are
  decomposed* (don't restyle a 1,400-line file in place).
- Keep inline styles only for genuinely dynamic values (computed widths,
  user-chosen colors).
- While there, standardize control heights to the existing implicit scale
  (36 / 44 / 52 px) instead of one-off values.

Acceptance: no visual change (compare screenshots of each migrated view).

## 3. Stream AI responses end to end

Today the gateway buffers the full LLM response (`server.ts
/api/ai/generate`, `supabase/functions/ai-generate`), so time-to-first-token
equals total generation time.

- Server: emit SSE (`text/event-stream`) chunks from both gateways. The
  Supabase function uses `@google/genai` — switch to
  `ai.models.generateContentStream`.
- Client: add `postToGatewayStream(body, onChunk)` in
  `src/services/geminiService.ts` next to `postToGatewayRaw`. Keep the
  non-streaming path for structured-JSON calls; stream only prose surfaces
  first: `GlobalChatPanel`, cover-letter/resume drafting in
  `JobPostingsWorkspace`, `DocumentEditor` AI chat.
- Respect the existing 120 s timeout/retry semantics: retries only before the
  first byte arrives.

Acceptance: coach chat shows first tokens in < 2 s on a normal connection.

## 4. Persistent rate limiting for edge functions

`supabase/functions/ai-generate/index.ts` uses a module-scope Map that resets
on cold start. Replace with Upstash Redis (REST):

- Secrets: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- `INCR` + `EXPIRE 60` on `ratelimit:{user.id}`; reject over-limit with 429
  (the client already classifies 429 into a friendly message and retries with
  backoff).
- Fail open if Redis is unreachable (log loudly), so an Upstash outage doesn't
  take down AI features.
- Apply the same helper to `fetch-url` and `screenshot` functions.

## 5. Persist in-flight workflow results

A refresh mid-analysis currently loses everything held in React state.

- `UnifiedWorkspace`: persist `marketData` / `companyIntel` / `resumeFit` /
  `interviewStrategy` as each one resolves (the `useSavedAnalyses` hook and
  table already exist — write incrementally instead of only on "Save").
- `WorkflowView` company research already has `companyResearchCache`
  (localStorage); extend the same pattern to resume/LinkedIn analysis results.
- On mount, offer to restore: a small banner ("Resume your last analysis?")
  rather than silently rehydrating.

## 6. Mobile pass on the top three flows

PRD says desktop-first, but the app is web-deployed. Scope: Dashboard,
coach chat, Job Postings. Use the existing `useIsMobile` hook and Tailwind
responsive classes.

- `GlobalChatPanel` is already `fixed inset-0` on mobile — verify the input
  isn't covered by the keyboard (use `dvh` units).
- `JobPostingsWorkspace`: list/detail must stack; detail opens as a
  full-screen layer with a back button.
- Charts (`MarketCompensationViz`): recharts `ResponsiveContainer` everywhere;
  verify legends wrap.
- Everything else: add an unobtrusive "best experienced on desktop" note on
  first mobile visit rather than half-fixing each view.

## 7. Inline form validation

Forms validate only on submit. For `GoalPlanIntakeForm`,
`ResumeGenerationForm`, `CurrentStateSurvey`, `CoverLetterForm`:

- Mark required fields visually (`*`), validate on blur, show field-level
  error text below the input (red border + message, design tokens).
- Never use `alert()`; errors that aren't field-specific go through `toast()`.
- Disable submit while invalid or in-flight (pattern: `isAddingApp` in
  `Dashboard.tsx`).

## 8. Smaller items (batch into one "polish" commit each)

- **Supabase over-fetching:** replace `.select("*")` with explicit column
  lists in `src/context/UserProfileContext.tsx`, `src/hooks/useJobPostings.ts`,
  `src/hooks/useSavedAnalyses.ts`. Audit `src/lib/profileMapper.ts` first for
  the full set of columns actually consumed.
- **BLS batching:** `enrichWithBls` fires one request per location; batch
  series ids across locations into a single BLS call (≤ 50 series/request).
- **Screenshot browser reuse:** cache the Chromium instance across warm
  invocations in `api/_lib/capture.ts` (verify `browser.isConnected()` before
  reuse).
- **Focus traps:** the add-application modal has Escape/autofocus but not a
  real trap; add a `useFocusTrap` hook and apply to it and `ConsentModal`.
  Restore focus to the trigger on close.
- **Loading skeletons:** shimmer placeholders for Dashboard cards and posting
  lists instead of blank space.
- **Session expiry:** on a classified 401 from the gateway, show a "Sign in
  again" dialog that triggers `supabase.auth.signInWithPassword` flow rather
  than only a text message.
- **MFA recovery UX:** `MFAChallengePage` — keep the error visible ≥ 5 s, add
  an attempts-remaining hint, and link to a recovery path.
- **Chat suggested prompts:** keep a "prompt ideas" affordance available after
  the conversation starts (currently the chips vanish after 2 messages).
- **Request correlation:** generate a request id in the client gateway call,
  send as `x-request-id`, log it in `server.ts` and the edge functions.

---

## Suggested order

1 → 2 are intertwined (decompose, then restyle each extracted piece).
3, 4, 5 are independent of each other and of 1–2. 6–8 are independent
cleanups; pick them up between larger reviews.
