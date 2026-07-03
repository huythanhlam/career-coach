# TechCoach AI — 10x Value Roadmap

**Date:** July 2026
**Status:** Approved roadmap
**Companion doc:** [`DEVELOPMENT_PLAN.md`](./DEVELOPMENT_PLAN.md) — the rebuild foundation (Phases P0–P4) this roadmap depends on. Every feature below names its foundation dependency; per the house rule, each feature also gets a design spec in `docs/superpowers/specs/` (via the `/spec` skill) before implementation.

---

## 1. Thesis — what "10x more valuable" means

Today the product is **21 well-built but disconnected point tools**. A user tailors a resume, runs a mock interview, and researches a company — and no feature knows the others happened. The flagship coach chat forgets turn 1 by turn 2. Nothing happens between sessions. Nothing is monetized.

10x value = converting the toolbox into **an agent that runs your job search**:

1. **It remembers you** (F1) — every artifact and score feeds a coach with memory; a relationship, not a tool.
2. **It works while you're away** (F3, F5) — follow-ups drafted, matches found, progress digested weekly.
3. **It proves it works** (F8) — outcome tracking turns "coaching" into measurable conversion lift.
4. **It charges for it** (F4) — sustainable unit economics on metered AI usage.

This extends the three retention pillars of `docs/PRODUCT_DIFFERENTIATORS.md` (June 2026) onto the AI Core v2 substrate from the development plan.

## 2. North-star metrics

| # | Metric | Definition | Direction |
|---|---|---|---|
| 1 | **W4 retention of activated seekers** | Activated = generated ≥1 application package; retained = active in week 4 | 3x baseline |
| 2 | **Applications per active seeker per week** | Core-loop throughput | Up |
| 3 | **Interviews per 100 applications** | From F8 outcome tracking — proves the coaching works | Up |
| 4 | **AI TTFT p50 / workflow success rate** | From `ai_usage` telemetry (Plan P1) — experience-quality guardrail | <1.5s / >99% |
| 5 | **MRR + free→paid conversion** | Post-F4 | Up |

## 3. Priority table

| # | Feature | Pri | Effort | Depends on | Why |
|---|---|---|---|---|---|
| F1 | Coach OS: stateful coach + memory + nudges | **P0** | L | Plan P1 | The #1 product unlock; fixes the broken flagship surface; makes 21 features one product |
| F2 | Streaming UX everywhere | **P0** | M | Plan P1 | Perceived-quality multiplier on every AI feature; mostly falls out of AI Core v2 |
| F3 | Job-search agent: pipeline intelligence + follow-up drafts | **P0** | L | Plan P1, F1 | Turns the core loop from manual to agentic; drives metric #2 |
| F4 | Stripe billing + entitlements | **P0** | L | Plan P0–P2 | Nothing else is sustainable without it; metering already lands in Plan P1 |
| F5 | Career analytics + weekly digest | **P0** | M | Plan P2, F1 | The re-engagement channel; the digest is the retention hook |
| F6 | Technical & system-design interview modes | P1 | L | Plan P1 | Restores deliberately-cut breadth as premium anchor content |
| F7 | Employer marketplace + matching | P1 | XL | Plan P0, F4 | Second revenue side — **gated on R2 revenue data; default = defer** |
| F8 | Outcome tracking + salary contributions | P1 | M | F3 | Feeds metric #3; compounds the deterministic-data moat |
| F9 | Mobile PWA + a11y pass | P1 | M | Plan P3–P4 | Job seekers live on phones; a11y is table stakes |
| F10 | Email-forwarding application capture | P2 | M | F3 | Honest middle path; inbox OAuth rejected (§6) |
| F11 | Video interview practice | P2 | XL | F6 | High wow, high cost; needs media infra the stack lacks |
| F12 | i18n | P2 | L | Plan P4 | Expansion lever, not a 10x lever yet |
| F13 | Referral / share loops | P2 | S | F5 | Cheap growth experiment |

**Phasing:** **R1** = F1 + F2 (weeks 1–5, overlaps Plan P3–P4) → **R2** = F3 + F4 + F5 (weeks 5–12) → **R3** = F6 + F8 + F9 (weeks 12–18) → **R4** = F7 (if metrics justify) + P2 items.

---

## 4. P0 features (full write-ups)

### F1 — Coach OS: a coach that remembers you (P0 · L · R1)

**Problem.** `src/components/GlobalChatPanel.tsx` is stateless — `createTechCoachChat` sends only the latest message, so the coach forgets turn 1 by turn 2, and it injects no user context even though resumes, pipeline, interview scores, and goals all live in Supabase. The flagship "AI career coach" surface is the weakest feature in the app.

**Description.** Persistent coach conversations; a per-user memory store (structured facts + episodic journal) written by an extraction pass after meaningful events (interview completed, package generated, milestone hit); a context assembler that injects profile baseline, pipeline summary, recent scores, and top-k memories into every coach turn; proactive nudges ("Your Stripe application has been quiet for 9 days — draft a follow-up?") generated nightly by pg_cron and surfaced on the Dashboard and in the digest (F5). A "What the coach knows about me" settings section where users view, edit, and delete memories.

**Implementation notes.** Builds on Plan P1's `ai_conversations`/`ai_messages`. New tables (new migrations): `user_memories (user_id, kind: fact|episode|preference, content, source_feature, salience, created_at)` and `coach_nudges` — both owner-only RLS per the `job_postings` template. Memory-writer runs as a QUALITY-tier workflow post-event, hooked into `useInterviewSessions.ts`, `applicationAutopilot.ts`, and the goal planner. Context assembler at `src/ai/coach/context.ts` (new), reusing `buildProfileBaseline` from `src/lib/careerBaseline.ts`. Nudge cron follows the `20260610000002_suggested_postings_cron.sql` pattern. `GlobalChatPanel.tsx` is **rebuilt** on streaming + persistence, not refactored.

**Run cost.** Highest-token feature: memory/context injection multiplies chat-turn input 3–5x. Mitigate with Gemini context caching (stable prefix), memory summarization, and the Plan-P1 hard cap; QUALITY tier for coach turns, FAST for memory extraction.

**Acceptance criteria.**
- [ ] Given a user who completed a mock interview yesterday, when they open the coach and ask "how am I doing?", the reply references that interview and its rubric scores without the user restating them.
- [ ] Given a closed and reopened browser, when the coach panel opens, the last conversation renders with full history in <500ms with no AI call.
- [ ] Given a user deletes a memory in settings, subsequent coach turns no longer reflect it (verified with an injected canary fact in an E2E test).
- [ ] Given an application untouched for N days (configurable), the nightly cron creates exactly one nudge (idempotent across re-runs); dismissing suppresses re-creation for that application.
- [ ] RLS: user A can never read user B's memories, conversations, or nudges (automated policy test).
- [ ] All coach turns stream (TTFT <1.5s p50) and are metered in `ai_usage`.

### F2 — Streaming UX everywhere (P0 · M · R1)

**Problem.** Time-to-first-token equals total generation time (10–30s of spinner) on every AI surface, because streaming was faked (`sendMessageStream` awaited the full response).

**Description.** Consume the Plan-P1 SSE pipeline in the six highest-traffic surfaces: coach chat, Goal Planner chat, mock-interview turns, negotiation turns, resume/cover-letter drafting (progressive section rendering in `DocumentEditor`), and company-research summaries. Skeleton → stream → settle pattern; an abort button on every generation; structured outputs stream their prose fields progressively and finalize the object on close.

**Implementation notes.** Mostly integration work over `src/ai/client.ts` (`streamWorkflow()`); per-surface rendering states. Live-region announcements for streamed content (a11y, coordinates with Plan P4).

**Run cost.** Neutral — same tokens, delivered sooner.

**Acceptance criteria.**
- [ ] First visible token <1.5s p50 / <3s p95 across all six surfaces, measured from `ai_usage.ttft_ms` in production telemetry.
- [ ] The user can abort mid-stream; the partial result is either preserved (chat) or cleanly discarded (structured drafts) — no orphaned spinners.
- [ ] A dropped connection mid-stream surfaces a retriable error state, never a silent hang.
- [ ] E2E test asserts ≥3 distinct paint updates during a single generation (proves real streaming, not buffering).

### F3 — Job-search agent: pipeline intelligence + follow-up sequencing (P0 · L · R2)

**Problem.** Autopilot generates packages, then abandons the user: no next actions, no follow-ups, no learning from what got responses. The Dashboard pipeline is manual bookkeeping.

**Description.** For every tracked application: auto-drafted next-best-actions on a cadence (follow-up emails, post-interview thank-yous, withdraw suggestions), stale detection, and response-rate analytics per resume variant ("packages using resume v3 got 2x replies"). A daily **agenda** view: today's top 3 actions. **Drafts only — the product never sends anything automatically** (stated in the UI; see §6).

**Implementation notes.** New migration `application_events` (status-change event log) extending `application_packages` (`20260624000002`); a deterministic sequencing-rules engine run by pg_cron; drafting workflows on the AI core. Builds on `src/services/applicationAutopilot.ts`, `jobRecommendation.ts`, `src/hooks/useApplicationPackages.ts`, and the existing weekly `refresh-suggestions` edge function. Variant attribution uses the existing `applied_resume_id` linkage on `job_postings`.

**Run cost.** Low — drafts are FAST-tier and generated on demand or in small nightly batches (batch API eligible, ~50% price).

**Acceptance criteria.**
- [ ] Given an application marked applied 7 days ago with no status change, when the user opens the Dashboard, a drafted follow-up email is one click away, personalized from that package's JD + resume.
- [ ] Given the user marks "interview scheduled", prep actions (company-research link, mock-interview CTA seeded with the JD) appear on the agenda within one refresh.
- [ ] Given ≥10 applications across ≥2 resume variants, the analytics card shows response rate per variant with unit-tested arithmetic.
- [ ] The agenda never shows more than 3 actions per day; completing or snoozing persists across devices (server-side state).
- [ ] No email is ever sent by the system — only draft + copy/`mailto:`; asserted in an E2E test and stated in the UI.

### F4 — Monetization: Stripe billing + entitlements (P0 · L · R2)

**Problem.** Zero revenue path. Employer "Boost" checkout is simulated (`BoostCheckoutModal` processes no payment); seeker AI usage is unmetered against anything but a flat 20 req/min.

**Description.** Seeker **Free / Pro** tiers and a **real** employer Boost via Stripe hosted Checkout (no card data ever touches our servers). Entitlements enforced server-side in the AI gateway: Free = N generations/month, 1 resume, behavioral interviews only, browser voice; Pro = high limits, F6 interview modes, QUALITY-tier priority, premium cloud voice, digest.

**Implementation notes.** New migrations: `billing_customers`, `subscriptions`, `entitlements`; monthly quotas computed from Plan-P1's `ai_usage` (that metering is the hard prerequisite). Two new edge functions: `stripe-checkout` (creates sessions) and `stripe-webhook` (signature-verified, idempotent). The gateway checks entitlements **before** calling the provider and returns a typed `QuotaExceeded` the client turns into an upgrade sheet. Replaces the simulated flow in `src/components/EmployerStudio/` + `src/types/boostOrder.ts`, using the `employer_boost_orders` table landed by Plan P0. **Vercel must move to Pro the day this ships** (Hobby prohibits payment processing — see the plan's cost model).

**Run cost.** Stripe is percentage-only (no fixed fee); entitlement checks are a DB read, no AI cost.

**Acceptance criteria.**
- [ ] Given a Free user at quota, any AI workflow returns a typed 402-style error **before any provider call** (zero AI cost incurred, asserted via `ai_usage`), and the UI shows the upgrade sheet.
- [ ] Given a Stripe test-mode subscription created or canceled, entitlements flip within 60s via webhook; replayed webhooks cause no double-grant (idempotency test).
- [ ] Given an employer completes Boost checkout, the listing gains featured placement and the `employer_boost_orders` row references a real payment intent; a refund in Stripe reverts placement.
- [ ] The webhook endpoint rejects unsigned or invalid-signature payloads (test).
- [ ] E2E in CI: Free→Pro upgrade completes in Stripe test mode; downgrade at period end restores Free limits.

### F5 — Career analytics + weekly digest (P0 · M · R2)

**Problem.** All activity — interview rubric scores, resume/LinkedIn scores, goals, pipeline events — is write-only. Users can't see progress, and nothing pulls them back weekly.

**Description.** **Skill-gap analysis** vs. target role (profile/resume skills compared against JD requirements aggregated from the user's stored postings); **progress-over-time charts** (interview scores, ATS scores, response rates); a **weekly digest email** (new matches from the existing `refresh-suggestions` cron + agenda summary + one coach insight from F1 memory).

**Implementation notes.** Email infra: **Resend** via a new `send-digest` edge function + pg_cron (the only new vendor this roadmap adds; free tier initially). Analytics read existing tables — `interview_sessions` (`20260611000001`), profile scores (`profiles.resume_score` etc.), `job_postings` — charted with the existing recharts setup. Skill-gap is a structured-output workflow whose schema **requires** each claimed gap to cite stored posting ids. Start SPF/DKIM domain warmup in R2 week 1, before the code is done.

**Run cost.** Low — one skill-gap generation per user per week (FAST tier, batch-eligible); digest assembly is deterministic.

**Acceptance criteria.**
- [ ] Given ≥3 mock interviews over time, a trend chart renders rubric-dimension scores chronologically; empty and single-point states render sensibly.
- [ ] Given a target role, the skill-gap list contains only skills traceable to ≥1 stored job posting (schema-enforced citations — no hallucinated requirements; validated in evals).
- [ ] The digest sends Mondays to opted-in users only; unsubscribe is one click and checked before every send; no digest goes out if the user has zero matches AND zero agenda items.
- [ ] Digest opens/clicks land in PostHog; rendering verified on Gmail + Apple Mail (documented manual check).

---

## 5. P1 / P2 features (condensed)

### F6 — Technical & system-design interview modes (P1 · L · R3)
Restores the modes deliberately cut by `20260619000000` (behavioral-only), but properly: **system-design** as a structured dialogue with an architecture/tradeoffs/scaling rubric; **coding practice** via an embedded editor (CodeMirror) with AI review against a problem bank — explicitly **no code-execution sandbox** (no infra for it; the AI reviews the code as written). Sessions persist to `interview_sessions` with mode-specific rubrics; Pro-gated (F4).
**AC:** rubric scoring parity with behavioral mode (persisted, charted in F5); a Free user hitting the mode sees the upgrade sheet, not an error; problem bank content versioned in-repo; eval fixtures for both new rubrics.

### F7 — Employer marketplace + matching (P1 · XL · R4, **gated**)
Complete the employer side on the schema Plan P0 lands: listings → seeker apply → employer inbox first; **matching** (deterministic filters + rerank over consented seeker profiles) only after. New consent flag: seekers are invisible to employers unless they opt in. **Gate:** build only if R2 shows employer-side demand (Boost revenue, listing volume) — a two-sided marketplace roughly doubles permanent maintenance surface, and the default is defer.
**AC:** a seeker who has not opted in never appears in any employer query (RLS-tested); apply flow round-trips to the seeker pipeline; employer inbox actions notify the seeker; Boost placement (F4) honored in search ordering.

### F8 — Outcome tracking + salary contributions (P1 · M · R3)
Lightweight "did you get the interview/offer?" prompts at pipeline-stage transitions; anonymized, opt-in salary contributions cross-validated against the existing BLS bands (`src/services/blsService.ts`). Feeds metric #3 and compounds the deterministic-data moat.
**AC:** outcome prompts appear only on stage transitions and are dismissible forever per application; contributed salaries never render in any cohort with n<20 (k-anonymity, unit-tested); contribution is opt-in with plain-language consent; aggregate views cite sample size.

### F9 — Mobile PWA + a11y pass (P1 · M · R3)
Installable PWA (manifest + Workbox service worker) with offline read-only Dashboard and saved-resume viewing; complete the mobile pass `docs/REMAINING_WORK.md` §6 scoped (Dashboard, coach chat, job postings); full a11y pass on top of the Plan-P4 baseline.
**AC:** Lighthouse PWA installable on Android/iOS; airplane-mode reopen shows cached Dashboard + resumes with an offline banner; axe-core: 0 serious/critical violations on the 8 core routes (CI-gated); top 3 flows keyboard-complete; streaming output announced via live regions.

### F10 — Email-forwarding application capture (P2 · M)
Per-user forwarding address (`u+<token>@apply.<domain>`) via Resend/Postmark inbound webhook → parses ATS confirmation/rejection emails → creates/updates `job_postings` entries. The honest middle path — full inbox OAuth is rejected (§6).
**AC:** ≥90% correct pipeline actions on a 20-email fixture set of real ATS notification formats (Greenhouse, Lever, LinkedIn, Workday); unknown senders quarantined to a review list, never auto-applied; the address is revocable/rotatable.

### F11 — Video interview practice (P2 · XL)
Webcam-recorded answers with AI feedback on content (transcript) and delivery (pace, filler words). Deferred: needs media storage/processing infra the stack lacks; revisit after F6 proves practice-loop demand.
**AC (when built):** recording stays client-side until explicit save; transcript feedback reuses the STAR rubric pipeline; delivery metrics computed locally where feasible.

### F12 — i18n (P2 · L)
Extract strings post-Plan-P4 (react-i18next or lingui), locale-aware dates/currency; first target locale chosen by user data.
**AC:** no hardcoded user-facing strings in `src/` (lint rule); pseudo-locale renders without layout breakage; AI outputs respect the user's language preference via prompt parameter.

### F13 — Referral / share loops (P2 · S)
Shareable "win cards" (offer signed, score milestone) rendered as images + referral links with attribution.
**AC:** share card contains no PII beyond what the user explicitly toggles on; referral attribution lands in PostHog; share/dismiss both one tap.

---

## 6. Explicitly rejected / deferred

| Idea | Verdict | Why |
|---|---|---|
| Browser extension (job capture from any site) | Deferred to post-R2 | A second distribution surface with its own store review, release train, and breakage-on-every-site-redesign maintenance tax — not before F3 proves the loop it would feed. |
| Gmail/Outlook OAuth inbox integration | **Rejected** | Google OAuth restricted-scope review is a months-long process with annual re-audits, and reading a user's whole inbox is a privacy blast radius the product doesn't need. F10 forwarding captures ~70% of the value with none of it. |
| Auto-sending applications or emails | **Rejected (product stance)** | ATS terms-of-service risk, user-trust risk, and one bad auto-send destroys credibility. TechCoach drafts; the human sends. Stated in the UI (F3). |
| Self-hosted infra (Redis, vector DB, queues) | **Rejected** | Simplification principle: Supabase primitives only. Memory retrieval (F1) starts with recency + salience scoring — no embeddings until evals prove the need (pgvector is available *within* Supabase if that day comes). |
| Second AI vendor | **Rejected** | See development plan §2.1. Re-evaluate only if evals show a capability gap Gemini can't close. |

## 7. Sequencing risks

1. **Plan P0 is the tap-root:** F4 and F7 are hard-blocked on the migration-drift fix (timestamp collision in `supabase/pending_migrations/`). Do not start R2 before P0 merges.
2. **Cost before billing:** F1 + F2 multiply AI spend before F4 exists. The Plan-P1 hard per-user cap and `ai_usage` dashboards must be live before R1 ships to real users.
3. **Deliverability is an ops domain, not a code task:** start digest domain warmup (SPF/DKIM, Resend domain verification) in R2 week 1.
4. **Vercel plan flip:** F4 shipping = commercial use = Vercel Pro required that day (cost model in the development plan).
5. **Two-track file collisions:** R1 (coach/streaming) and Plan P3–P4 (router/state/UI) touch neighboring code; keep the §7 team split from the development plan and rebuild `GlobalChatPanel.tsx` rather than refactoring it.
6. **Eval-gated prompt changes:** every feature above adds workflows; each lands with eval fixtures, and tier assignments are validated against evals before merging (plan §6, Phase 1).
