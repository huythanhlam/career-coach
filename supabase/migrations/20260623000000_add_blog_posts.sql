-- Auto-curated blog posts. Drafted by the 3-agent editorial pipeline
-- (scripts/blog/*: Ideator → Writer → Editor), committed as markdown in
-- data/blog/posts/*.md, reviewed in a PR, then upserted here by
-- scripts/blog/sync.ts after the PR merges (see blog-content-sync.yml).
--
-- PUBLIC content: unlike the other reference tables, published posts are
-- readable by anon (logged-out) visitors too — the blog is a top-of-funnel
-- marketing surface. No client write policy; the pipeline writes with the
-- service role (which bypasses RLS).

create table if not exists public.blog_posts (
  slug            text primary key,
  title           text not null,
  excerpt         text,
  category        text not null default 'general',
  tags            jsonb not null default '[]'::jsonb,
  content         text not null,                        -- markdown body
  sources         jsonb not null default '[]'::jsonb,   -- [{label,url}] grounding cites
  hero_emoji      text,                                 -- lightweight visual; no image hosting
  model           text,                                 -- which model drafted it (provenance)
  editor_score    int,                                  -- editorial quality 0-100
  editor_rounds   int,                                  -- writer<->editor revision rounds
  reading_minutes int,
  published       boolean not null default true,
  generated_at    timestamptz,
  published_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.blog_posts enable row level security;

-- Public read of PUBLISHED posts (anon + authenticated). No INSERT/UPDATE/DELETE
-- policy -- the pipeline writes via the service role.
drop policy if exists blog_posts_public_select on public.blog_posts;
create policy blog_posts_public_select on public.blog_posts
  for select to anon, authenticated using (published = true);

create index if not exists blog_posts_published_idx
  on public.blog_posts (published, published_at desc);
create index if not exists blog_posts_category_idx
  on public.blog_posts (category, published_at desc);

-- Reuse the shared updated_at trigger function (defined in the profiles migration).
drop trigger if exists blog_posts_updated_at on public.blog_posts;
create trigger blog_posts_updated_at
  before update on public.blog_posts
  for each row execute procedure public.set_updated_at();

-- Grants
grant all privileges on table public.blog_posts to service_role;
grant select on table public.blog_posts to anon, authenticated;
