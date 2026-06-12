# CLAUDE.md

TechCoach AI — AI career-coaching platform. React 19 + TypeScript + Vite + Tailwind 4 frontend; Express AI gateway (`server.ts`); Supabase auth/DB/Edge Functions; Google Gemini for all AI features.

## Commands

```bash
npm ci             # install (NOT npm install — .npmrc sets ignore-scripts=true; lockfile-exact)
npm run dev        # Vite frontend on :3000 (requires gateway running in a 2nd process)
npm run server     # Express AI gateway on :4000 (required for any AI feature in dev)
npm run lint       # typecheck (tsc --noEmit) — there is no eslint; "lint" means types
npm test           # vitest run (full suite, ~2s)
npx vitest run <file>   # single test file — prefer this while iterating
npm run profiles:build  # company-profiles data pipeline (see scripts/company-profiles/README.md)
```

In remote/cloud sessions, run `npm ci` first — containers start without `node_modules`.

## Definition of done

A change is not done until `npm run lint` and `npm test` both pass. CI (`.github/workflows/ci.yml`) additionally runs `npm run build` and `npm audit --omit=dev --audit-level=high`; run those too if you touched dependencies or build config. The `/verify-ci` skill runs the full gauntlet.

## Workflow: spec first

For non-trivial features (new workflow, schema change, new pipeline), write a short design doc to `docs/superpowers/specs/YYYY-MM-DD-<slug>-design.md` and get it approved **before** implementing (the `/spec` skill does this). Small fixes and refactors don't need a spec. Schema changes: use the `/new-migration` skill.

## Architecture

- **All Gemini calls go through the gateway** — never call Gemini directly from frontend code. Dev: `server.ts` (:4000). Prod: Supabase Edge Function `supabase/functions/ai-generate`.
- AI system prompts and workflow field configs: `src/config/workflows.ts`. Model selection: `src/config/models.ts`.
- Frontend Gemini client: `src/services/geminiService.ts`.
- Supabase: RLS protects all user data. Migrations in `supabase/migrations/` are timestamped (`YYYYMMDDNNNNNN_name.sql`); never edit an already-applied migration — add a new one. Generated DB types: `supabase/types.ts`.
- Company-profiles pipeline (deterministic, non-AI data): `scripts/company-profiles/` with per-source fetchers in `sources/`.
- Sidebar view IDs/types live in `src/components/workflows.ts` — distinct file from `src/config/workflows.ts`.

## Environment variables

`.env.local` (template: `.env.example`). `VITE_`-prefixed vars are exposed to the browser — only Supabase URL/anon key belong there. `GEMINI_API_KEY` and `BLS_API_KEY` are server-side only; never add a `VITE_` prefix to a secret.

## Gotchas

- `.npmrc` enforces `ignore-scripts=true` for supply-chain hardening — if a new dependency needs its install script, that's a deliberate decision to discuss, not a flag to flip.
- README's "Multi-Agent Dev System" section is stale: `agents/` no longer exists and `npm run agents` fails.
- CI uses Node 22.
