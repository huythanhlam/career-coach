/**
 * DB helpers for the blog pipeline. Reuses the company-profiles service-role
 * client factory so there's one place that builds the admin client. Importing
 * this module has no side effects.
 */
import type { BlogPost } from "../../src/types/blogPost.ts";

// Reuse the existing service-role client factory + loose admin handle type.
export { getAdmin, type AdminClient } from "../company-profiles/db.ts";
import type { AdminClient } from "../company-profiles/db.ts";

/** Row shape for the blog_posts table (camelCase → snake_case). */
export function toRow(p: BlogPost) {
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt ?? null,
    category: p.category,
    tags: p.tags,
    content: p.content,
    sources: p.sources,
    hero_emoji: p.heroEmoji ?? null,
    model: p.model ?? null,
    editor_score: p.editorScore ?? null,
    editor_rounds: p.editorRounds ?? null,
    reading_minutes: p.readingMinutes ?? null,
    published: true,
    generated_at: p.generatedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

/** Slugs already published in the DB (so the Ideator skips them). */
export async function loadPublishedSlugs(admin: AdminClient): Promise<string[]> {
  const { data, error } = await admin.from("blog_posts").select("slug");
  if (error || !data) return [];
  return (data as { slug: string }[]).map((r) => r.slug);
}

/** Upsert posts into blog_posts in bounded chunks. */
export async function upsertPosts(admin: AdminClient, posts: BlogPost[], chunk = 50): Promise<number> {
  const rows = posts.map(toRow);
  let synced = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const batch = rows.slice(i, i + chunk);
    const { error } = await admin.from("blog_posts").upsert(batch, { onConflict: "slug" });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
    synced += batch.length;
  }
  return synced;
}
