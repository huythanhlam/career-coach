# Landing Page Rebuild — Design

**Date:** 2026-07-03
**Status:** Approved

## Goal

Rebuild the pre-auth landing page (`src/components/LandingPage.tsx`) into a
**modern, high-converting marketing page** whose centerpiece is an **auto-playing
scripted product demo** in the hero — a framed "app window" that loops through
recreations of the real product UI (Resume Analyzer, Mock Interview, Market Data,
Salary Negotiator) so a visitor _sees_ the product before signing up. Supporting
upgrades: a **bento feature layout** grouped by journey stage, **scroll-reveal
animations**, a **scroll-aware sticky-nav CTA**, a **horizontal how-it-works
timeline**, a **subordinated employer band**, and **outcome-led copy**. All within
the existing warm **Mentor theme**, with **no new dependencies**, honoring
**`prefers-reduced-motion`**, and leaving **auth and routing untouched**.

## Why (problem with the current approach)

`LandingPage.tsx` today (1,151 lines) tells but never shows. Every visual is a
`lucide-react` icon in a tinted square — there is not a single screenshot, mockup,
or motion cue anywhere in the repo (`public/` and `src/assets/` hold no media). A
visitor reads "Resume Analyzer — get a match score" but never sees a score, a
chart, or a streamed answer, so the page reads like a feature list rather than a
product. Secondary problems:

- **Flat feature grid.** Nine identical cards in a 3-col grid give every tool equal
  weight and no sense of the candidate journey (Plan → Apply → Practice → Research)
  that the app's own sidebar is organized around.
- **Static, no motion.** Nothing animates on scroll or hover beyond a card lift, so
  the page feels dated next to modern SaaS landing pages.
- **Hero stat wall.** Three hero stats plus an "About" stat block assert unverified
  numbers ("$40k+ avg. comp increase", "10k+ resume analyses") that read as
  invented and add above-the-fold clutter competing with the CTA.
- **Nav CTA always present but never adapts** — no re-surfacing of the primary CTA
  as the hero scrolls away, a standard conversion pattern.

## Design

All work is confined to the landing experience. `App.tsx`'s `AuthGate` still renders
`<LandingPage onSignIn={...} />` exactly as today; the `AuthModal`, its sign-in /
sign-up / forgot-password modes, the candidate/employer intent toggle, `pendingTab`
routing, and `setPendingAccountType` flow are **moved verbatim, not modified**.

### 1. Extract the landing page into a folder

New directory `src/components/LandingPage/` so the page can be composed from focused,
independently reviewable pieces instead of one 1,151-line file:

- `src/components/LandingPage/index.tsx` — the `LandingPage` export (same props:
  `{ onSignIn?: () => void }`), owns `authOpen`/`pendingTab`/`authIntent`/
  `mobileMenuOpen`/contact state and the `openAuth()` helper, composes the sections.
  `App.tsx`'s import path (`@/components/LandingPage`) resolves to the folder's
  `index.tsx` unchanged — **no App.tsx edit required.**
- `src/components/LandingPage/AuthModal.tsx` — the existing `AuthModal` verbatim.
- `src/components/LandingPage/content.ts` — the `features`, `testimonials`, and
  `steps` data, re-grouped by journey stage (see §3) and with copy rewritten (§7).
- Section components: `Nav.tsx`, `Hero.tsx`, `HowItWorks.tsx`, `Features.tsx`,
  `Employers.tsx`, `Testimonials.tsx`, `About.tsx`, `Pricing.tsx`, `Contact.tsx`,
  `Footer.tsx`. Each keeps the existing section's `id` anchor (`#features`,
  `#how-it-works`, `#testimonials`, `#about`, `#for-employers`, `#pricing`,
  `#contact`) so nav links and the mobile menu keep working.

This is a mechanical decomposition of existing markup; behavior is preserved section
by section, which keeps the diff reviewable and the demo/animation work isolated.

### 2. `ProductDemo` — the scripted hero demo (the headline feature)

`src/components/LandingPage/ProductDemo.tsx` — a self-contained, dependency-free
component that simulates a screen recording of the app.

- **Frame.** A rounded "app window" with a title bar (three traffic-light dots + a
  faux address chip reading `app.techcoach.ai`), rendered with theme tokens
  (`--card`, `--border`, `.paper` shadow). The frame reserves a fixed
  `aspect-ratio` box (16:10 desktop, taller on mobile) so there is **zero layout
  shift** while the demo mounts or scenes swap.
- **Scenes.** A `SCENES` array of 4 scripted moments, each a small React subtree
  built from real theme tokens so it genuinely resembles the product:
  1. **Resume Analyzer** — a match-score dial animating 0→86, three gap chips
     fading in.
  2. **Mock Interview** — an AI question bubble, then a typed/streamed answer using
     a typewriter effect, then a STAR rating.
  3. **Market Data** — a horizontal salary-band bar chart whose bars grow on enter,
     with a p50 marker.
  4. **Salary Negotiator** — a counter-offer script streaming in line by line.
  Each scene has a `caption` ("Analyze your resume in seconds") rendered in a
  caption bar under the frame, and a stage label.
- **Playback engine.** A single `requestAnimationFrame` loop (cleaned up on unmount)
  drives an elapsed-time clock; scene index and per-scene progress derive from it.
  Scenes auto-advance and loop. Controls: a play/pause button and a row of chapter
  dots (one per scene) that are real `<button>`s with `aria-label`s to jump scenes.
  A thin progress bar reflects intra-scene progress. All controls are keyboard
  reachable with `focus-visible` rings.
- **`prefers-reduced-motion`.** On mount, read
  `window.matchMedia('(prefers-reduced-motion: reduce)')`. When reduced: do **not**
  start the RAF loop; render the first scene in its final/resolved state (score at
  86, chart fully drawn) with a centered play button overlay; typewriter effects
  render full strings instantly. Playback is still available on explicit click.
- **Real-video swap path.** The frame is a presentational shell
  (`<DemoFrame caption={…}>{children}</DemoFrame>`). `ProductDemo` passes the
  scripted scenes as children today; a real recording later becomes
  `<DemoFrame><video src="/demo.mp4" … /></DemoFrame>`. A code comment at the top of
  `ProductDemo.tsx` documents this substitution point.

### 3. `Features` — bento layout grouped by journey stage

`src/components/LandingPage/Features.tsx`. Replaces the flat 9-card grid.

- **Data** (`content.ts`): the nine features re-tagged with a `stage` of
  `"Plan" | "Apply" | "Practice" | "Research"`, mirroring the app sidebar. Marquee
  tools get a `vignette` id.
- **Layout.** A CSS-grid bento: 3–4 large tiles (Resume Analyzer, Mock Interview,
  Market Compensation, Salary Negotiation) each containing a **mini animated
  vignette** — a small, static-friendly reduction of that tool's UI (a scoped
  variant of the same primitives the demo scenes use) — plus a compact row of
  smaller tiles for the remaining tools grouped under their stage label. Tiles are
  `<button>`s that call `openAuth(f.tab)` exactly as today (behavior preserved).
- **Vignettes are decorative:** `aria-hidden`, and they render their resolved state
  under reduced motion.

### 4. `useReveal` — scroll-triggered reveal animations

`src/components/LandingPage/useReveal.ts` — a small hook wrapping
`IntersectionObserver`: returns a `ref` and an `isVisible` flag; adds a
`data-revealed` attribute when the element crosses ~12% into view (once, then
unobserves). Sections apply a base `.reveal` class (opacity 0, `translateY(16px)`)
transitioning to visible on `[data-revealed]`. Staggering is done with a
per-child `transition-delay` via inline style or a `--i` custom property. When
`prefers-reduced-motion` is set (checked once in the hook), the hook returns
`isVisible: true` immediately and skips the observer so content is shown with no
transform. Reveal CSS lives in `src/index.css` under `@layer utilities` (new
`.reveal` / `[data-revealed]` rules) — the only edit to `index.css`.

### 5. `Nav` — scroll-aware sticky CTA

`src/components/LandingPage/Nav.tsx`. Keeps the sticky blurred bar. Adds an
`IntersectionObserver` (or a scroll listener throttled via `requestAnimationFrame`)
watching a sentinel placed at the hero's primary CTA. While the hero CTA is in view
the nav shows the normal links; once it scrolls out, a compact "Get Started Free"
button animates into the nav (fade + slight slide). Under reduced motion the button
still appears/disappears but without the slide transition. Mobile menu behavior is
unchanged.

### 6. `HowItWorks` — horizontal timeline

`src/components/LandingPage/HowItWorks.tsx`. The three steps become a horizontal
timeline: a connecting line with three numbered node markers (terracotta rings),
each with title + description below. Collapses to a vertical timeline on mobile
(<`sm`). Uses `useReveal` for staggered entrance.

### 7. Copy & credibility pass (`content.ts` + section markup)

- **Outcome-led rewrites** for hero headline/subhead, feature descriptions, and
  section headers (e.g. hero: "Walk into your next negotiation with a script backed
  by real market data" style; features framed as results, not tool names).
- **Remove invented statistics.** Delete the hero stat trio ("10+", "$40k+",
  "100%") and the About stat block ("10k+ resume analyses", etc.). Replace the hero
  stats with a thin, honest social-proof strip (e.g. "Powered by Gemini · Free while
  in beta · Private by default").
- **Remove the fake testimonials.** The Sarah K. / Marcus L. / Priya M. quotes are
  fabricated, so the entire Testimonials section, its `#testimonials` anchor, and the
  "Testimonials" nav link (desktop + mobile) are deleted rather than reframed. No
  `Testimonials.tsx` is created. Credibility is carried instead by the product demo,
  the honest social-proof strip, and the About section's principle bullets.
- **Employer section subordinated** (`Employers.tsx`): collapse the current
  two-column feature-competing block into a single banner-style band (one row: short
  headline + 3 inline bullets + the two existing employer CTAs), visually lighter
  than the candidate sections. Employer `openAuth(undefined, "employer")` calls
  preserved.
- Keep only claims already on the page and consistent with reality (free while in
  beta, powered by Gemini, privacy-first). Add no new user counts or salary figures.

### 8. Accessibility, responsiveness, performance

- Semantic landmarks: `<header>` (nav), `<main>` wrapping the sections, `<footer>`;
  exactly one `<h1>` (hero). Demo controls get `aria-label`s; decorative vignettes
  are `aria-hidden`. All interactive elements get `focus-visible` rings using
  `--ring`.
- Mobile-first: demo frame and bento grid collapse to a single column; verified at
  375px with no horizontal scroll.
- Performance: demo reserves its aspect-ratio box (no CLS); below-the-fold sections
  lazy-mount via `React.lazy` + `Suspense`, or simpler, gate their heavy inner
  content on `useReveal` visibility. No new npm dependencies — RAF, CSS, and
  `IntersectionObserver` only.

### Data model / migrations / workflows

**None.** This is a presentational, frontend-only change. No Supabase tables, no
migrations, no RLS changes, no Gemini calls, no `server.ts` / Edge Function edits,
no GitHub workflow changes, no new environment variables. The contact form keeps its
current client-only behavior (sets `contactSent`, no network call), unchanged.

## Testing

**Constraint discovered during research:** this repo's vitest runs in the `node`
environment, `include` is `src/**/*.test.ts` (not `.tsx`), and there is no
`@testing-library/react` / `jsdom` installed. All 47 existing tests cover pure
logic. Adding a DOM-rendering stack would violate the "no new dependencies" rule, so
the demo/animation logic is **extracted into pure, framework-free helpers** and those
get `.test.ts` coverage in the node environment — matching the repo's actual
convention. React components themselves are verified in the browser (see Definition
of Done), not in vitest.

- **`src/components/LandingPage/demoTimeline.ts`** (pure): given a `SCENES` array
  (each with a `durationMs`) and an elapsed-milliseconds clock, returns
  `{ sceneIndex, sceneProgress (0..1), totalProgress }` and loops. Tested for:
  first-frame state at `t=0`, mid-scene progress, exact boundary handoff between
  scenes, wrap-around past total duration, and a `jumpToScene(index)` offset helper.
  This is the component's playback brain, tested without React.
- **`src/components/LandingPage/content.ts`** grouping helper
  (`featuresByStage(features)`): asserts all nine features are present exactly once,
  grouped under the four stages in canonical `Plan → Apply → Practice → Research`
  order, and that the marquee (`vignette`-bearing) tiles are the expected four.
- **`typewriter(full, progress)`** pure helper used by streamed scenes: returns the
  visibly-typed substring for a given 0..1 progress, `''` at 0 and the full string at
  1 — so reduced-motion (progress forced to 1) yields complete text.

The React components (`ProductDemo`, `useReveal`, `Nav`, `LandingPage`) consume these
tested helpers and are validated by browser verification rather than unit tests, since
the repo has no component-testing harness and this change adds none.

## Out of scope

- Producing a real MP4 recording of the app (the component only leaves the documented
  swap path for one).
- Any change to `AuthModal` logic, Supabase auth, onboarding, `pendingTab` routing,
  or hash routing.
- Dark mode (theme remains light-only per current CSS).
- Wiring the contact form to a real backend / email service.
- New product features, workflows, or copy claims requiring data we don't have.
- Changes to the public blog (`#/blog`) shell or any authenticated view.
