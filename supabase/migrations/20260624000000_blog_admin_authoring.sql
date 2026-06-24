-- Blog admin authoring: let admins create, edit, publish, and discard posts
-- from inside the app. The previous migration (20260623000001_blog_admin.sql)
-- added admin SELECT/UPDATE policies, but RLS alone is not sufficient -- the
-- `authenticated` role also needs table-level INSERT/UPDATE/DELETE grants (the
-- same grant gap that left `profiles` unreadable in production). Add both the
-- missing policies and the matching grants here.

-- Admin INSERT -- create a draft row from the app.
drop policy if exists blog_posts_admin_insert on public.blog_posts;
create policy blog_posts_admin_insert on public.blog_posts
  for insert to authenticated
  with check (public.current_user_is_admin());

-- Admin DELETE -- discard a draft.
drop policy if exists blog_posts_admin_delete on public.blog_posts;
create policy blog_posts_admin_delete on public.blog_posts
  for delete to authenticated
  using (public.current_user_is_admin());

-- Table grants for the api role. RLS gates *which rows*; grants gate *whether
-- the verb is allowed at all*. Without these, an admin insert/update/delete is
-- rejected with 42501 before RLS is ever evaluated.
grant insert, update, delete on table public.blog_posts to authenticated;

-- After applying, reload the PostgREST schema cache:
--   notify pgrst, 'reload schema';
