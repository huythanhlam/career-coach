/**
 * Admin-only CRUD for blog posts, used by the in-app authoring/editing UI.
 *
 * All calls run under the caller's session and rely on the admin RLS policies
 * (current_user_is_admin()) added in 20260624000000_blog_admin_authoring.sql:
 * admins can select every post and insert/update/delete. Generation of the AI
 * draft itself lives in geminiService.generateBlogDraft (it goes through the AI
 * gateway); this module only persists and mutates rows.
 */
import { supabase } from "@/lib/supabaseClient";
import { rowToPost } from "@/hooks/useBlogPosts";
import { generateBlogDraft } from "@/services/geminiService";
import { readingMinutes } from "@/lib/blogDraft";
import type { BlogPost } from "@/types/blogPost";

/** Fields an admin may edit in the editor. */
export interface EditablePost {
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  content: string;
  heroEmoji?: string;
  sources: BlogPost["sources"];
}

/** Outcome of trying to create a draft from a backlog topic. */
export type CreateDraftResult =
  { kind: "created"; slug: string } | { kind: "exists"; slug: string };

/**
 * Generate a draft for a topic and persist it as an unpublished `draft` row.
 * If a post with the same slug already exists (queued or published), returns
 * `exists` so the caller can open it instead of overwriting.
 */
export async function createDraftFromTopic(topic: {
  title: string;
  category: string;
}): Promise<CreateDraftResult> {
  const draft = await generateBlogDraft(topic);

  const { data: existing } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("slug", draft.slug)
    .maybeSingle();
  if (existing) return { kind: "exists", slug: draft.slug };

  const now = new Date().toISOString();
  const { error } = await supabase.from("blog_posts").insert({
    slug: draft.slug,
    title: draft.title,
    excerpt: draft.excerpt,
    category: draft.category,
    tags: draft.tags,
    content: draft.content,
    sources: draft.sources,
    hero_emoji: draft.heroEmoji ?? null,
    model: draft.model,
    editor_score: draft.editorScore,
    editor_rounds: draft.editorRounds,
    reading_minutes: draft.readingMinutes,
    status: "draft",
    published: false,
    generated_at: now,
  });
  if (error) throw new Error(error.message);
  return { kind: "created", slug: draft.slug };
}

/** Load any post by slug for editing (admins see unpublished rows via RLS). */
export async function loadAdminPost(slug: string): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToPost(data) : null;
}

/** Persist edits to the editable fields. Recomputes reading time from content. */
export async function savePost(slug: string, patch: EditablePost): Promise<void> {
  const { error } = await supabase
    .from("blog_posts")
    .update({
      title: patch.title,
      excerpt: patch.excerpt,
      category: patch.category,
      tags: patch.tags,
      content: patch.content,
      hero_emoji: patch.heroEmoji ?? null,
      sources: patch.sources,
      reading_minutes: readingMinutes(patch.content),
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug);
  if (error) throw new Error(error.message);
}

/**
 * Publish or unpublish a post. Publishing flips it live and stamps published_at
 * the first time; unpublishing returns it to the queued ("review") state. Either
 * way the post is no longer scheduled, so scheduled_for is cleared.
 */
export async function setPublished(slug: string, published: boolean): Promise<void> {
  const patch: Record<string, unknown> = {
    published,
    status: published ? "published" : "review",
    scheduled_for: null,
    updated_at: new Date().toISOString(),
  };
  if (published) patch.published_at = new Date().toISOString();
  const { error } = await supabase.from("blog_posts").update(patch).eq("slug", slug);
  if (error) throw new Error(error.message);
}

/**
 * Schedule (or reschedule) a post to auto-publish at `whenISO`. Marks it
 * status='scheduled', not yet public; the publisher cron flips it live once
 * scheduled_for passes. Caller validates that whenISO is in the future.
 */
export async function schedulePost(slug: string, whenISO: string): Promise<void> {
  const { error } = await supabase
    .from("blog_posts")
    .update({
      status: "scheduled",
      scheduled_for: whenISO,
      published: false,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", slug);
  if (error) throw new Error(error.message);
}

/** Cancel a post's schedule, returning it to the queued ("review") state. */
export async function cancelSchedule(slug: string): Promise<void> {
  const { error } = await supabase
    .from("blog_posts")
    .update({ status: "review", scheduled_for: null, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) throw new Error(error.message);
}

/** Permanently delete a post (used to discard a draft). */
export async function deletePost(slug: string): Promise<void> {
  const { error } = await supabase.from("blog_posts").delete().eq("slug", slug);
  if (error) throw new Error(error.message);
}
