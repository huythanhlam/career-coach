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
function baseRow(p: BlogPost) {
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
    generated_at: p.generatedAt ?? null,
    updated_at: new Date().toISOString(),
  };
}

/** Published row — used by sync after a post's PR merges. */
export function toRow(p: BlogPost) {
  return { ...baseRow(p), published: true, status: "published" as const };
}

/** Queued/in-review row — used by build so drafts surface in the admin view
 *  before the PR merges. Not publicly visible (published = false). */
export function toDraftRow(p: BlogPost) {
  return { ...baseRow(p), published: false, status: "review" as const };
}

/**
 * Slugs already in the DB. By default returns every slug (published or queued)
 * so the Ideator never re-pitches an existing topic. Pass `onlyPublished` to
 * restrict to live posts (used when deciding which drafts are safe to upsert).
 */
export async function loadPublishedSlugs(admin: AdminClient, onlyPublished = false): Promise<string[]> {
  let query = admin.from("blog_posts").select("slug");
  if (onlyPublished) query = query.eq("published", true);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as { slug: string }[]).map((r) => r.slug);
}

async function upsertRows(admin: AdminClient, rows: Record<string, unknown>[], chunk: number): Promise<number> {
  let synced = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const batch = rows.slice(i, i + chunk);
    const { error } = await admin.from("blog_posts").upsert(batch, { onConflict: "slug" });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
    synced += batch.length;
  }
  return synced;
}

/** Upsert posts as PUBLISHED into blog_posts in bounded chunks (sync). */
export async function upsertPosts(admin: AdminClient, posts: BlogPost[], chunk = 50): Promise<number> {
  return upsertRows(admin, posts.map(toRow), chunk);
}

/** Upsert posts as QUEUED drafts (published = false) so they appear in the
 *  admin view immediately after a build, before the review PR merges. Skips
 *  slugs already published so a re-build never un-publishes a live post. */
export async function upsertDrafts(admin: AdminClient, posts: BlogPost[], chunk = 50): Promise<number> {
  const published = new Set(await loadPublishedSlugs(admin, true));
  const fresh = posts.filter((p) => !published.has(p.slug));
  return upsertRows(admin, fresh.map(toDraftRow), chunk);
}
