# Blog Admin Authoring — Design

**Date:** 2026-06-24
**Status:** Approved (autonomous build per `/goal` directive)

## Goal

Let an admin **click a backlog topic and start working on a blog post ahead of the scheduled build time, with full in-app editing capabilities.**

Concretely:

1. Backlog topics (and existing drafts/published posts) become clickable in the Blog Admin view.
2. Clicking a backlog topic **generates an AI draft now** (bypassing the weekly Monday cron), then drops the admin into an editor.
3. A full **in-app editor** lets the admin edit every post field (title, excerpt, category, tags, hero emoji, sources, markdown body) with live preview, **save** edits, and **publish/unpublish** directly.

Decisions locked in during brainstorming:

- **Authoring:** AI-generate, then edit.
- **Source of truth:** edits write directly to the `blog_posts` table (already the public source of truth).
- **Publishing:** admin can publish straight from the editor.
- **Generation depth:** trimmed **Writer + single Editor pass**, synchronous (option #1 below).
- **Editable scope:** *all* posts (backlog-generated drafts, queued/review drafts, and published posts) — not just new topics.
- **Slug:** immutable once created (it is the primary key and the public URL).

## Current state (what already exists)

- **Blog Admin view** `src/components/BlogAdmin/index.tsx` — read-only/monitoring only. Gated by `profile.isAdmin`. Renders the schedule card, stat cards, queued (in-review) drafts, published posts, and the **topic backlog** (static `<span>` badges, no click handler). Backlog = `data/blog/_topics.json` minus topics whose slug already exists as a queued/published post.
- **`blog_posts` table** (`supabase/migrations/20260623000000_add_blog_posts.sql`, `20260623000001_blog_admin.sql`):
  - Columns: `slug` (PK), `title`, `excerpt`, `category`, `tags` (jsonb), `content` (markdown), `sources` (jsonb `[{label,url}]`), `hero_emoji`, `model`, `editor_score`, `editor_rounds`, `reading_minutes`, `published` (bool), `status` (`'draft'|'review'|'published'`, check constraint), `generated_at`, `published_at`, `created_at`, `updated_at`.
  - RLS: `blog_posts_public_select` (anon+authenticated, `published = true`), `blog_posts_admin_select` + `blog_posts_admin_update` (authenticated, `current_user_is_admin()`). **No INSERT/DELETE policy** — the pipeline writes via service role.
  - Grants: `grant all … to service_role; grant select … to anon, authenticated`. **No insert/update/delete grant to `authenticated`** (RLS update policy exists but the table grant is missing — admins cannot actually write yet).
- **Editorial pipeline** `scripts/blog/` — Node/tsx, CI-only. `pipeline.ts` runs Writer↔Editor (≤2 rounds); `agents/{ideator,writer,editor}.ts`; `gemini.ts` calls Gemini directly with `GEMINI_API_KEY`. `build.ts` mirrors approved drafts to `blog_posts` as `status='review', published=false` via service role; `sync.ts` publishes committed markdown.
- **Public rendering** `src/components/BlogPage/` — fetches `blog_posts` (`published=true`), renders `content` with `react-markdown` + `rehype-raw` + `rehype-sanitize`. Hook `src/hooks/useBlogPosts.ts`, mapper `rowToPost`.
- **Schedule config** `src/config/blogSchedule.ts` — global weekly cron mirror (`Mondays 06:00 UTC`); `nextRun()`, `humanizeUntil()`. No per-topic scheduling.
- **Markdown:** `react-markdown` v10 + `rehype-raw` + `rehype-sanitize` already installed. No editor component exists.
- **AI access:** dev → Express gateway `server.ts` (:4000); prod → Supabase Edge Function `supabase/functions/ai-generate`. Frontend never calls Gemini directly. The blog agents are **not** reachable from the frontend today.

## Design

### Part 1 — Migration (built first)

New migration via `/new-migration`. Two concerns:

1. **RLS policies** mirroring the existing `blog_posts_admin_update`:
   - `blog_posts_admin_insert` — `for insert to authenticated with check (current_user_is_admin())`.
   - `blog_posts_admin_delete` — `for delete to authenticated using (current_user_is_admin())` (enables "Discard draft").
2. **Table grants** (RLS is necessary but not sufficient — this is the exact gap that broke `profiles` reads in prod):
   - `grant insert, update, delete on public.blog_posts to authenticated;`

After apply: `notify pgrst, 'reload schema';` (documented in the migration / rollout notes).

> Generation creates rows via the **service role** (see Part 2), so the admin INSERT policy is not strictly required for the chosen flow — but it is included so the editor can also create rows directly if generation is unavailable, and to keep the policy set coherent. Low cost, removes a future foot-gun.

### Part 2 — Generation endpoint (`blog-generate`)

A new server endpoint that turns `{ title, category }` into a draft row. **Option #1 (trimmed synchronous):** run **Writer once + Editor once**, skipping Ideator (topic is already chosen) and the multi-round loop. ~2 Gemini calls; comfortably within timeouts; the admin supplies further editorial judgment by editing.

- **Dev:** new route in `server.ts` (`POST /api/blog/generate`).
- **Prod:** new Supabase Edge Function `supabase/functions/blog-generate` (Deno).
- **Auth:** admin-only. The endpoint verifies the caller is an admin server-side via `current_user_is_admin()` (using the caller's JWT) before doing any work; generation/writes use the service role.
- **Shared prompts:** extract the Writer and Editor **prompt templates + response parsing** out of `scripts/blog/agents/` into a runtime-agnostic module (pure strings + pure parse functions, no Node/Deno APIs) that both the Node CI pipeline and the Deno Edge function import. The Gemini *call* stays per-runtime (CI keeps `scripts/blog/gemini.ts`; Edge uses `fetch` to the Gemini REST API). This avoids duplicating prompt logic.
- **Behavior:** slugify the title (reuse existing `slugify`); if the slug already exists, return a conflict the UI surfaces ("a post for this topic already exists — open it"). Otherwise insert a row: `status='draft'`, `published=false`, `model`, `generated_at=now()`, `editor_score`/`editor_rounds`/`reading_minutes` from the run. Return `{ slug }`.
- **Latency/UX:** synchronous request with a "Generating…" state on the clicked topic. If latency proves too high in practice, fall back to Writer-only (documented). Async/polling is explicitly out of scope (YAGNI for an admin-only, low-frequency action).

### Part 3 — Client service

`src/services/` gains a `generateBlogDraft(topic: { title; category })` method following the existing gateway-vs-Edge-function routing used by `geminiService` (dev → `server.ts`, prod → Edge function). Returns the new `slug` or a typed conflict. All subsequent CRUD (load/save/publish/delete) goes through the Supabase client directly under admin RLS — not through the gateway.

### Part 4 — Editor UI

New `src/components/BlogAdmin/BlogEditor.tsx` (plus small subcomponents if it grows): a form bound to one `blog_posts` row.

- **Fields:** `title`, `excerpt`, `category` (select from known categories), `tags` (chip input), `heroEmoji`, `sources` (list of `{label,url}`), and `content` — a **markdown textarea with a live preview** rendered by the *same* `react-markdown` + sanitize stack the public page uses (so what the admin sees matches what ships). `slug` shown read-only.
- **Controls:**
  - **Save** → `update` of editable columns + `updated_at`.
  - **Publish / Unpublish** toggle → sets `published` and `status` (`published`→`published=true,status='published',published_at=now()` if not set; unpublish→`published=false,status='review'`).
  - **Discard** (drafts only) → `delete` the row, return to the dashboard.
- **Validation:** require non-empty title and content before publish; surface Supabase errors inline (the editor is the first place admins exercise the new write grants, so error visibility matters).

### Part 5 — Wiring the dashboard

In `src/components/BlogAdmin/index.tsx`:

- Backlog topic badges → buttons. Click → call `generateBlogDraft`, show per-topic "Generating…", then route to the editor on success.
- Queued/review and published `PostRow`s → clickable into the editor for the same row (full editing of existing posts).
- **Routing:** add an editor route under the admin view, e.g. `#/blog_admin/edit/<slug>`, handled alongside the existing `#/blog_admin` (see `src/App.tsx` hash routing and `src/components/Sidebar.tsx` `ViewId`). The editor is itself admin-gated (defense in depth, like `BlogAdmin`).
- **"Ahead of schedule":** generating on click *is* the bypass — a draft is created immediately rather than waiting for the Monday cron. The schedule card stays informational; no per-topic scheduling is added.

## Data flow

```
Admin clicks backlog topic
  → client generateBlogDraft({title,category})
  → blog-generate endpoint (admin check) → Writer + Editor (shared prompts) → insert draft row (service role) → {slug}
  → route to #/blog_admin/edit/<slug>
  → BlogEditor loads row (admin RLS select) → admin edits → Save (admin RLS update)
  → Publish toggle (published=true, status='published') → public page now serves it
```

## Testing

- **Pure logic (vitest):** slugify/draft-row mapping, the shared prompt-assembly and response-parsing functions, `sources`/`tags` normalization, publish/unpublish state transitions, editor validation.
- **Service:** `generateBlogDraft` request shaping + conflict handling (mock fetch).
- **RLS/grants:** verified via SQL (insert/update/delete as `authenticated` admin vs non-admin) — documented, not unit-tested.
- `npm run lint` + `npm test` green (definition of done). Touching deps/build → also `npm run build` + `npm audit`.

## Rollout / prerequisites

- **Prod prerequisite (separate from this feature's code):** the deployed Supabase project (`odqotbyqxdyskoiuijah`) currently denies `authenticated` access to `profiles` (missing grant) and has a stale PostgREST schema cache — admins can't even load their profile, so `isAdmin` reads false. That must be fixed (grant + `notify pgrst, 'reload schema'`) for any admin feature to work in prod. This migration adds the analogous `blog_posts` grants so the same gap doesn't recur there.
- New Edge Function `blog-generate` must be deployed with `GEMINI_API_KEY` available server-side.

## Non-goals (YAGNI)

- Per-topic scheduling / scheduled publishing.
- Async generation jobs + polling.
- Syncing in-app edits back to the git markdown files (`data/blog/posts/`). The DB is the source of truth for manually authored/edited posts; the CI pipeline continues to commit markdown for its own generated content.
- WYSIWYG/rich-text editor (markdown textarea + live preview only).
- Image hosting (hero emoji only, as today).

## Open questions

- None blocking. If trimmed Writer+Editor latency is unacceptable in prod, drop to Writer-only (no design change, just fewer calls).
