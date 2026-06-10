# Career Coach AI

React 19 + Vite + Tailwind 4 SPA with a Supabase backend (auth, Postgres,
edge functions) and a local Express dev gateway (`server.ts`).

## Commands

- `npm run lint` — type-check (tsc --noEmit)
- `npm test` — vitest suite
- `npm run build` — production build; keep the entry chunk under ~150 KB gzip
- `npm run dev` / `npm run server` — app on :3000, AI gateway on :4000

## Current focus of this branch

`claude/remaining-improvements-fpefeq` works through the queued improvement
backlog. **Read `docs/REMAINING_WORK.md` before starting any task here** — it
defines the workstreams, their acceptance criteria, the ground rules (one
workstream per commit, checks before every commit, no bundle regressions),
and the shared utilities from PR #35 to reuse (`toast`, `MODELS`,
`useUnsavedChangesWarning`, `configurePdfWorker`, hash routing).
