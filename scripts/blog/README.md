# Blog content pipeline

Auto-curates the careers blog with a **3-agent editorial team** (LLM role-agents,
each a Gemini call with its own system prompt — not Claude Code subagents):

1. **Ideator** (`agents/ideator.ts`) — sources topic *briefs* by blending the
   evergreen seed list (`data/blog/_topics.json`) with live, web-search-discovered
   trends, deduped against posts we've already published.
2. **Writer** (`agents/writer.ts`) — drafts a full post from one brief, with
   search grounding so claims carry real citations.
3. **Editor** (`agents/editor.ts`) — reviews like a managing editor and returns a
   structured verdict (`approve` / `revise` / `reject`) with a score and issues.

`pipeline.ts` orchestrates them per brief: Writer → Editor → (revise loop, max 2
rounds) → finalize on approve / skip on reject. The human PR review is the final
gate on top of the Editor.

## Flow (mirrors the company-profiles pipeline)

```
schedule → build.ts → data/blog/posts/*.md → PR (review) → merge → sync.ts → blog_posts table → public blog UI
```

- **build** opens a PR (`blog-content-build.yml`, weekly + manual dispatch).
- **sync** publishes on merge (`blog-content-sync.yml`, push to main).

## Commands

```bash
GEMINI_API_KEY=… npm run blog:build                      # ~3 posts (seed + trending)
npm run blog:build -- --limit 5                          # cap posts this run
npm run blog:build -- --seed-only --limit 2              # evergreen only
npm run blog:build -- --trending-only                    # web-search trends only
npm run blog:build -- --limit 1 --dry-run                # generate, don't write files

SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run blog:sync
npm run blog:sync -- --dry-run                           # print, don't write DB
```

## Environment

- `GEMINI_API_KEY` — required for `build` (server-side, same key as the Edge
  Function). Add it as a GitHub Actions secret.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — required for `sync`; optional for
  `build` (used only to dedupe against already-published slugs).
- `BLOG_MODEL` — optional override of the default `gemini-2.5-flash`.

## On-disk format

Each post is `data/blog/posts/<slug>.md`: a markdown body with a leading
`<!-- blog-meta … -->` JSON comment. The comment is hidden when GitHub renders the
file (reviewers read clean markdown), and it parses with no extra dependencies.
See `serializePost` / `parsePostFile` in `lib.ts`.

## Tests

`lib.test.ts` covers the file round-trip + row mapping; `pipeline.test.ts` covers
the editorial loop and ideator parsing with the agents mocked (no network).
