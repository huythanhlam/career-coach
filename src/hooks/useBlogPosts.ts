import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { BlogPost } from "@/types/blogPost";

// Public blog data hooks. Posts are auto-curated by the editorial pipeline and
// published into `blog_posts` (RLS: anon + authenticated can read published
// rows), so these work for logged-out visitors too.

function rowToPost(row: Record<string, unknown>): BlogPost {
  return {
    slug: row.slug as string,
    title: row.title as string,
    excerpt: (row.excerpt as string) ?? "",
    category: (row.category as string) ?? "general",
    tags: (row.tags as string[]) ?? [],
    content: (row.content as string) ?? "",
    sources: (row.sources as BlogPost["sources"]) ?? [],
    heroEmoji: (row.hero_emoji as string) ?? undefined,
    model: (row.model as string) ?? undefined,
    readingMinutes: (row.reading_minutes as number) ?? 1,
    editorScore: (row.editor_score as number) ?? undefined,
    editorRounds: (row.editor_rounds as number) ?? undefined,
    generatedAt: (row.generated_at as string) ?? "",
    publishedAt: (row.published_at as string) ?? undefined,
    status: (row.status as BlogPost["status"]) ?? undefined,
    published: (row.published as boolean) ?? undefined,
  };
}

/** List published posts, newest first. Card fields only (no full body). */
export function useBlogPosts() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from("blog_posts")
      .select("slug,title,excerpt,category,tags,hero_emoji,reading_minutes,published_at,generated_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        setPosts(data ? data.map(rowToPost) : []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { posts, loading };
}

/** Fetch a single published post (full body) by slug. */
export function useBlogPost(slug: string | null) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setPost(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setPost(data ? rowToPost(data) : null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return { post, loading };
}

/**
 * Admin-only overview: every post, split into queued (in-review, not public) and
 * published. Relies on the `blog_posts_admin_select` RLS policy — non-admins get
 * only published rows back, so `queued` is empty for them. `refreshKey` lets the
 * caller force a re-fetch.
 */
export function useBlogAdminPosts(refreshKey = 0) {
  const [queued, setQueued] = useState<BlogPost[]>([]);
  const [published, setPublished] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from("blog_posts")
      .select("slug,title,excerpt,category,tags,hero_emoji,model,reading_minutes,editor_score,editor_rounds,status,published,published_at,generated_at")
      .order("generated_at", { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        const posts = data ? data.map(rowToPost) : [];
        setPublished(posts.filter((p) => p.published));
        setQueued(posts.filter((p) => !p.published));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  return { queued, published, loading };
}
