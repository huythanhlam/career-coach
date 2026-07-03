-- ─────────────────────────────────────────────────────────
-- Blog scheduling: queue a post for future publication.
--
-- The in-app Blog Admin already reads and writes these, but no migration
-- ever created them, so the writes fail today:
--   • src/services/blogAdminService.ts  schedulePost()  → status='scheduled',
--     scheduled_for=<iso>;  cancelSchedule() → status='review', scheduled_for=null
--   • src/hooks/useBlogPosts.ts          selects `scheduled_for`, filters the
--     admin "scheduled" lane on status='scheduled' ordered by scheduled_for
--
-- Without this migration, schedulePost() violates blog_posts_status_check
-- (which only allows draft/review/published) and the SELECT of a missing
-- `scheduled_for` column errors.
-- ─────────────────────────────────────────────────────────

alter table public.blog_posts
  add column if not exists scheduled_for timestamptz;

-- Expand the status check to allow 'scheduled'. The value set is changing,
-- so drop-and-recreate; guarded so a re-run is safe.
alter table public.blog_posts drop constraint if exists blog_posts_status_check;
alter table public.blog_posts
  add constraint blog_posts_status_check
  check (status in ('draft', 'review', 'published', 'scheduled'));

-- Partial index supporting the admin scheduled-lane query
-- (useBlogPosts: status='scheduled' order by scheduled_for) and the
-- future publisher cron's "due posts" scan.
create index if not exists blog_posts_scheduled_idx
  on public.blog_posts (scheduled_for)
  where status = 'scheduled';

-- FOLLOW-UP (separate migration, not included here): a publisher job that
-- flips due scheduled posts live — `update blog_posts set status='published',
-- published=true, published_at=now() where status='scheduled' and
-- scheduled_for <= now()`. Model it on the existing pg_cron + Vault-secret
-- jobs (20260610000002_suggested_postings_cron.sql,
-- 20260611000002_seed_company_research_cron.sql). Until it exists, scheduled
-- posts are staged correctly but a human/admin must publish them.
