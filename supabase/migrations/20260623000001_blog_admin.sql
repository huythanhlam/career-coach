-- Blog admin: a server-managed `is_admin` flag plus admin visibility into
-- blog_posts so the in-app Blog Admin view can show queued (unpublished) posts.
-- Models the existing `mfa_enrolled` pattern: the flag is set server-side only
-- (clients cannot self-promote), and a SECURITY DEFINER helper reads it
-- bypassing RLS.

-- 1. Admin flag on profiles. Like mfa_enrolled, this is denormalized for fast,
--    server-verified checks and is NOT client-settable (guarded below).
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- 2. Re-create the owner UPDATE policy with a guard that blocks a client from
--    flipping is_admin on itself (mirrors the existing mfa_enrolled guard).
drop policy if exists "profiles: owner can update" on public.profiles;
create policy "profiles: owner can update"
  on public.profiles for update
  using (
    auth.uid() = id
    and public.session_aal_ok(mfa_enrolled)
  )
  with check (
    auth.uid() = id
    and public.session_aal_ok(mfa_enrolled)
    and mfa_enrolled = (select mfa_enrolled from public.profiles where id = auth.uid())
    and is_admin    = (select is_admin    from public.profiles where id = auth.uid())
  );

-- 3. SECURITY DEFINER helper: read is_admin bypassing RLS (mirror of
--    current_user_mfa_enrolled() in 20260610000001_add_job_postings.sql).
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- 4. blog_posts lifecycle status + admin visibility.
alter table public.blog_posts
  add column if not exists status text not null default 'published';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'blog_posts_status_check') then
    alter table public.blog_posts
      add constraint blog_posts_status_check check (status in ('draft', 'review', 'published'));
  end if;
end$$;

-- Admins can read every post (published or not). The public policy
-- (published = true) from the previous migration stays in place.
drop policy if exists blog_posts_admin_select on public.blog_posts;
create policy blog_posts_admin_select on public.blog_posts
  for select to authenticated using (public.current_user_is_admin());

-- Admins may update posts from the app (e.g. publish/unpublish) in the future.
drop policy if exists blog_posts_admin_update on public.blog_posts;
create policy blog_posts_admin_update on public.blog_posts
  for update to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Enable an admin once after applying:
--   update public.profiles set is_admin = true where email = 'you@example.com';
