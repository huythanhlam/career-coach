# Blog Post Scheduling — Design

**Date:** 2026-06-24
**Status:** Approved (autonomous build per `/goal` directive)

## Goal

Let an admin **schedule a blog post to publish at a specific date/time**, **modify or delete** that schedule on any scheduled post, and **see all scheduled posts in both a list and a calendar view** so it's easy to find when each post goes live.

Builds on the in-app authoring feature (`2026-06-24-blog-admin-authoring-design.md`).

## Current state

- `blog_posts` (per `20260623000000` + `20260623000001`): `status text` in `('draft','review','published')`, `published bool`, `published_at`, `generated_at`, … No per-post scheduled time.
- `src/config/blogSchedule.ts` — a single **global** weekly cron mirror (Mondays 06:00 UTC); not per-post.
- `src/components/BlogAdmin/` — dashboard (queued / published / backlog) + `BlogEditor` (Save / Publish-Unpublish / Delete). Admin RLS: select/insert/update/delete via `current_user_is_admin()` (+ table grants).
- Repo uses **pg_cron** for scheduled DB jobs (`20260610000002_suggested_postings_cron.sql`, `20260611000002_seed_company_research_cron.sql`).
- No date/calendar npm dep; `.npmrc` discourages adding one → build the calendar from `Date`.

## Design

### Part 1 — Migration (`20260624000001_blog_post_scheduling.sql`)

> Provided as SQL for the user to add+apply (assistant is permission-blocked from writing `supabase/migrations/**`).

- `alter table public.blog_posts add column if not exists scheduled_for timestamptz;`
- Extend the status check to include `'scheduled'` (drop + re-add the constraint with `('draft','review','published','scheduled')`).
- `create index if not exists blog_posts_scheduled_for_idx on public.blog_posts (scheduled_for) where scheduled_for is not null;` (the publisher cron filters on it).
- **Auto-publisher**: a SECURITY DEFINER function `publish_due_scheduled_posts()` that flips every row with `status='scheduled' and scheduled_for <= now()` to `published=true, status='published', published_at=now()` (clearing `scheduled_for`). Scheduled via pg_cron every 5 minutes (`cron.schedule('publish-due-blog-posts', '*/5 * * * *', $$ select public.publish_due_scheduled_posts(); $$)`), mirroring the existing cron migrations.
- Admin RLS already covers update; no new policy needed (scheduling is an update). The existing `authenticated` grants (from the authoring migration) apply.

A "scheduled" post is: `status='scheduled'`, `scheduled_for` set, `published=false`. It becomes public only when the cron (or a manual Publish) flips it.

### Part 2 — Types & service

- `BlogPost` gains `scheduledFor?: string`; `status` union adds `'scheduled'`. `rowToPost` maps `scheduled_for`.
- `blogAdminService`:
  - `schedulePost(slug, whenISO)` → `update { status:'scheduled', scheduled_for: whenISO, published:false }`.
  - `cancelSchedule(slug)` → `update { status:'review', scheduled_for: null }` (back to queued, not deleted).
  - `useScheduledPosts` (or extend `useBlogAdminPosts`) to return `scheduled` posts ordered by `scheduled_for asc`.
- Guard: scheduling requires a future time and a saved (non-empty) post.

### Part 3 — Pure scheduling/calendar helpers (`src/lib/blogSchedule*` or `src/lib/calendar.ts`)

- `groupByLocalDay(posts) → Map<'YYYY-MM-DD', BlogPost[]>` keyed by the local date of `scheduledFor`.
- `buildMonthGrid(year, month) → { date: Date, inMonth: boolean }[][]` — 6×7 weeks incl. leading/trailing days.
- `formatScheduleDate` / `formatScheduleTime` helpers. All pure + unit-tested.

### Part 4 — UI

- **Editor** (`BlogEditor`): a "Schedule" panel — `datetime-local` input + **Schedule** button (calls `schedulePost`); if already scheduled, show the time with **Reschedule** + **Cancel schedule**. Distinct from immediate **Publish** (publish-now still works).
- **BlogAdmin dashboard**: a new **Scheduled** section with a **List ⇄ Calendar** toggle:
  - **List**: rows grouped by day, each showing time · title · category · actions (Edit → editor, Reschedule inline via `datetime-local`, Cancel). Sorted by `scheduled_for`.
  - **Calendar**: month grid (prev/next nav), each scheduled post shown as a chip on its day; clicking a chip opens the editor. "Today" highlighted.
- Stat card count for "Scheduled".

### Part 5 — "Ahead of schedule" coherence

The global weekly cron card stays (auto-curation). Per-post scheduling is independent: an admin can schedule any draft/queued post for a precise time regardless of the weekly run.

## Data flow

```
Admin sets a date/time on a post → schedulePost(slug, when) → row {status:'scheduled', scheduled_for, published:false}
  → appears in Scheduled list + calendar
  → pg_cron publish_due_scheduled_posts() runs every 5 min → when scheduled_for <= now(): published=true, status='published'
  → public blog serves it
Admin can Reschedule (update scheduled_for) or Cancel (clear → back to 'review') any time before it fires.
```

## Testing

- Pure (vitest): `buildMonthGrid` (week count, leading offset, month boundaries), `groupByLocalDay`, date/time formatters, future-time guard.
- Service (vitest, mocked supabase): `schedulePost` / `cancelSchedule` write the right columns; scheduled query ordering.
- `npm run lint` + `npm test` green.

## Non-goals (YAGNI)

- Recurring per-post schedules; timezone pickers (use the browser's local tz, store UTC).
- Drag-to-reschedule on the calendar (click-to-open + inline reschedule input only).
- Sub-5-minute publish precision (cron granularity is 5 min).
- Editing the global weekly cron from the UI.

## Prerequisites

- Migration `20260624000001_blog_post_scheduling.sql` applied; `notify pgrst, 'reload schema';`. pg_cron extension enabled on the project (the existing cron migrations imply it is).
- Regenerate `supabase/types.ts` after applying.
