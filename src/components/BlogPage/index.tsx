import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { ArrowLeft, Clock, Tag, ExternalLink, BookOpen, Loader2 } from "lucide-react";
import { useBlogPosts, useBlogPost } from "@/hooks/useBlogPosts";
import type { BlogPost } from "@/types/blogPost";

/** Parse the post slug from the URL hash. `#/blog` → null; `#/blog/<slug>` → slug. */
export function blogSlugFromHash(): string | null {
  const h = decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
  if (!h.startsWith("blog")) return null;
  const rest = h.slice("blog".length).replace(/^\//, "");
  return rest || null;
}

/** True when the current hash points at any blog route. Used to route public visitors. */
export function isBlogRoute(): boolean {
  const h = decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
  return h === "blog" || h.startsWith("blog/");
}

function goToList() {
  window.location.hash = "/blog";
}
function goToPost(slug: string) {
  window.location.hash = `/blog/${slug}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  resume: "#D97757",
  interview: "#8B5CF6",
  "job-search": "#3B82F6",
  "career-growth": "#2F6B4F",
  salary: "#2F6B4F",
  networking: "#E8B948",
  linkedin: "#0A66C2",
  "job-market": "#D97757",
  general: "#6B7280",
};
function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.general;
}
function prettyCategory(category: string): string {
  return category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
    </div>
  );
}

function PostCard({ post }: { post: BlogPost }) {
  const color = categoryColor(post.category);
  return (
    <button
      onClick={() => goToPost(post.slug)}
      className="text-left rounded-2xl p-6 border transition-all hover:shadow-lg hover:-translate-y-0.5 group flex flex-col"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${color}18` }}
        >
          {post.heroEmoji || "📝"}
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `${color}18`, color }}
        >
          {prettyCategory(post.category)}
        </span>
      </div>
      <h3
        className="font-semibold text-base mb-2 leading-snug"
        style={{ color: "var(--foreground)" }}
      >
        {post.title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{post.excerpt}</p>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5" /> {post.readingMinutes} min read
      </div>
    </button>
  );
}

function BlogList() {
  const { posts, loading } = useBlogPosts();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="mb-10 text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
          style={{
            background: "rgba(217,119,87,0.1)",
            color: "var(--primary)",
            border: "1px solid rgba(217,119,87,0.2)",
          }}
        >
          <BookOpen className="w-3.5 h-3.5" /> Career Insights
        </div>
        <h1
          className="font-display text-3xl sm:text-5xl font-semibold mb-3"
          style={{ color: "var(--foreground)" }}
        >
          The TechCoach AI Blog
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Practical, no-fluff guidance on resumes, interviews, salary negotiation, career pivots,
          and the job market.
        </p>
      </header>

      {loading ? (
        <Spinner />
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No posts published yet — check back soon.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function BlogDetail({ slug }: { slug: string }) {
  const { post, loading } = useBlogPost(slug);

  if (loading) return <Spinner />;

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-muted-foreground mb-4">This post couldn't be found.</p>
        <button
          onClick={goToList}
          className="text-sm font-semibold"
          style={{ color: "var(--primary)" }}
        >
          ← Back to all posts
        </button>
      </div>
    );
  }

  const color = categoryColor(post.category);
  return (
    <article className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <button
        onClick={goToList}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" /> All posts
      </button>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{post.heroEmoji || "📝"}</span>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `${color}18`, color }}
        >
          {prettyCategory(post.category)}
        </span>
      </div>

      <h1
        className="font-display text-3xl sm:text-4xl font-semibold leading-tight mb-4"
        style={{ color: "var(--foreground)" }}
      >
        {post.title}
      </h1>

      <div
        className="flex items-center gap-4 text-xs text-muted-foreground mb-8 pb-8 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> {post.readingMinutes} min read
        </span>
        {post.publishedAt && (
          <span>
            {new Date(post.publishedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        )}
      </div>

      <div
        className="prose prose-sm sm:prose-base max-w-none"
        style={{ color: "var(--foreground)" }}
      >
        <Markdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>{post.content}</Markdown>
      </div>

      {post.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-10">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          {post.tags.map((t) => (
            <span
              key={t}
              className="text-xs px-2.5 py-1 rounded-full"
              style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {post.sources.length > 0 && (
        <div className="mt-10 pt-8 border-t" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-semibold text-sm mb-3" style={{ color: "var(--foreground)" }}>
            Sources
          </h3>
          <ul className="space-y-2">
            {post.sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm hover:underline"
                  style={{ color: "var(--primary)" }}
                >
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" /> {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/**
 * The blog. Reads the URL hash to switch between the post list (`#/blog`) and a
 * single post (`#/blog/<slug>`). Self-contained and auth-agnostic, so it serves
 * both logged-in users (inside the app shell) and logged-out visitors (via
 * PublicBlogShell).
 */
export function BlogPage() {
  const [slug, setSlug] = useState<string | null>(() => blogSlugFromHash());

  useEffect(() => {
    const sync = () => setSlug(blogSlugFromHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "var(--background)" }}>
      {slug ? <BlogDetail slug={slug} /> : <BlogList />}
    </div>
  );
}
