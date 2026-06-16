---
name: spec
description: Draft a design spec for a non-trivial feature into docs/superpowers/specs/ following the project's established format. Use before implementing any new workflow, schema change, or pipeline.
---

# Write a design spec

Draft a design doc for the feature described in the arguments (ask for a description if none given), then stop for approval — do **not** start implementing.

## Process

1. Research the relevant existing code first so the spec reflects reality (current services, types, migrations, configs it touches).
2. Write the spec to `docs/superpowers/specs/YYYY-MM-DD-<slug>-design.md` using today's date.
3. Present a short summary and ask for approval. Implementation begins only after the spec is approved (set Status to Approved when it is).

## Required format (matches existing specs in that directory)

```markdown
# <Feature Name> — Design

**Date:** YYYY-MM-DD
**Status:** Draft

## Goal
What we're building and the user-visible outcome. Bold the key nouns.

## Why (problem with the current approach)
What exists today and why it falls short.

## Design
Numbered components, each independently testable. For each: file path,
responsibility, and how it composes. Include data model changes (new
timestamped migration in supabase/migrations/, RLS policy) and any
GitHub workflow changes.

## Testing
Which parts get unit tests (vitest) and how external effects are injected/mocked.

## Out of scope
Explicit non-goals to prevent scope creep.
```

## Project constraints to respect in every spec

- All Gemini calls go through the gateway (`server.ts` dev, `ai-generate` Edge Function prod) — never direct from frontend.
- New tables need RLS policies; migrations are timestamped and never edited after application.
- Deterministic (non-AI) data work belongs in `scripts/company-profiles/`-style pipelines with injectable `httpGet` for testability.
- Secrets stay server-side; never propose a `VITE_`-prefixed secret.
