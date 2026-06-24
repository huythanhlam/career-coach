-- Per-post blog scheduling: a scheduled_for time + a 'scheduled' status, and a
-- pg_cron job that auto-publishes posts when their scheduled time arrives.

alter table public.blog_posts add column if not exists scheduled_for timestamptz;

-- Extend the lifecycle status to include 'scheduled'.
alter table public.blog_posts drop constraint if exists blog_posts_status_check;
alter table public.blog_posts
  add constraint blog_posts_status_check
  check (status in ('draft', 'review', 'published', 'scheduled'));

-- The publisher cron filters on due scheduled posts.
create index if not exists blog_posts_scheduled_for_idx
  on public.blog_posts (scheduled_for) where scheduled_for is not null;

-- Flip every due scheduled post live. SECURITY DEFINER so the cron (no JWT) can update.
create or replace function public.publish_due_scheduled_posts()
returns integer
language sql
security definer set search_path = public
as $$
  with due as (
    update public.blog_posts
       set published = true,
           status = 'published',
           published_at = now(),
           scheduled_for = null,
           updated_at = now()
     where status = 'scheduled'
       and scheduled_for is not null
       and scheduled_for <= now()
    returning slug
  )
  select count(*)::int from due;
$$;

-- Run every 5 minutes via pg_cron (mirrors the repo's existing cron migrations).
create extension if not exists pg_cron;
select cron.unschedule('publish-due-blog-posts')
where exists (select 1 from cron.job where jobname = 'publish-due-blog-posts');
select cron.schedule('publish-due-blog-posts', '*/5 * * * *',
  $$ select public.publish_due_scheduled_posts(); $$);
