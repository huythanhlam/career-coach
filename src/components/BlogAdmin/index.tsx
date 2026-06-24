import { useMemo, useState } from "react";
import {
  CalendarClock,
  Clock,
  FileText,
  CheckCircle2,
  ListChecks,
  RefreshCw,
  ExternalLink,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { useBlogAdminPosts } from "@/hooks/useBlogPosts";
import { useUserProfile } from "@/context/UserProfileContext";
import { BLOG_SCHEDULE, nextRun, humanizeUntil } from "@/config/blogSchedule";
import type { BlogPost } from "@/types/blogPost";
import seedTopics from "../../../data/blog/_topics.json";

// Mirror the pipeline's slugify (scripts/blog/lib → company-profiles slugify) so
// we can best-effort match backlog topics against existing post slugs.
function slugify(s: string): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
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
const color = (c: string) => CATEGORY_COLORS[c] ?? CATEGORY_COLORS.general;
const pretty = (c: string) => c.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

function StatCard({ icon: Icon, label, value, tint }: { icon: React.ElementType; label: string; value: string | number; tint: string }) {
  return (
    <div className="rounded-2xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${tint}18` }}>
          <Icon className="w-4 h-4" style={{ color: tint }} />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="font-display text-2xl font-bold" style={{ color: "var(--foreground)" }}>{value}</div>
    </div>
  );
}

function CategoryTag({ category }: { category: string }) {
  const c = color(category);
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${c}18`, color: c }}>
      {pretty(category)}
    </span>
  );
}

function PostRow({ post, queued }: { post: BlogPost; queued: boolean }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border"
      style={{ background: "var(--paper)", borderColor: "var(--border)" }}
    >
      <span className="text-xl flex-shrink-0">{post.heroEmoji || "📝"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate" style={{ color: "var(--foreground)" }}>{post.title}</span>
          <CategoryTag category={post.category} />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readingMinutes} min</span>
          {typeof post.editorScore === "number" && <span>editor {post.editorScore}/100</span>}
          <span>{queued ? `drafted ${fmtDate(post.generatedAt)}` : `published ${fmtDate(post.publishedAt)}`}</span>
        </div>
      </div>
      {queued ? (
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: "rgba(232,185,72,0.15)", color: "#B7791F" }}>
          In review
        </span>
      ) : (
        <a
          href={`#/blog/${post.slug}`}
          className="text-xs font-semibold inline-flex items-center gap-1 flex-shrink-0 hover:underline"
          style={{ color: "var(--primary)" }}
        >
          View <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--foreground)" }}>
        {title}
        <span className="text-xs font-normal text-muted-foreground">({count})</span>
      </h2>
      {children}
    </section>
  );
}

export function BlogAdmin() {
  const { profile } = useUserProfile();
  const [refreshKey, setRefreshKey] = useState(0);
  const { queued, published, loading } = useBlogAdminPosts(refreshKey);

  const next = useMemo(() => nextRun(), []);
  const backlog = useMemo(() => {
    const covered = new Set([...queued, ...published].map((p) => p.slug));
    return (seedTopics as { title: string; category: string }[])
      .filter((t) => !covered.has(slugify(t.title)));
  }, [queued, published]);

  if (!profile.isAdmin) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center max-w-sm px-6">
          <ShieldAlert className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--muted-foreground)" }} />
          <h2 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>Not authorized</h2>
          <p className="text-sm text-muted-foreground">The Blog Admin area is restricted to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: "var(--background)" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <header className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold" style={{ color: "var(--foreground)" }}>Blog Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">Schedule, queued drafts, and published posts — all in one place.</p>
          </div>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border transition-colors hover:bg-muted flex-shrink-0"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </header>

        {/* Schedule */}
        <div className="rounded-2xl p-5 border mb-6 flex items-center gap-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(217,119,87,0.12)" }}>
            <CalendarClock className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Auto-curation schedule</div>
            <div className="text-sm text-muted-foreground">{BLOG_SCHEDULE.label}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-muted-foreground">Next run</div>
            <div className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{humanizeUntil(next)}</div>
            <div className="text-xs text-muted-foreground">{next.toUTCString().replace("GMT", "UTC")}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <StatCard icon={FileText} label="Queued (in review)" value={loading ? "—" : queued.length} tint="#E8B948" />
          <StatCard icon={CheckCircle2} label="Published" value={loading ? "—" : published.length} tint="#2F6B4F" />
          <StatCard icon={ListChecks} label="Backlog topics" value={backlog.length} tint="#3B82F6" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : (
          <>
            <Section title="Queued · awaiting review" count={queued.length}>
              {queued.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">
                  Nothing queued. The next scheduled run will draft new posts and open a review PR.
                </p>
              ) : (
                <div className="space-y-2">
                  {queued.map((p) => <PostRow key={p.slug} post={p} queued />)}
                </div>
              )}
            </Section>

            <Section title="Published" count={published.length}>
              {published.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">No published posts yet.</p>
              ) : (
                <div className="space-y-2">
                  {published.map((p) => <PostRow key={p.slug} post={p} queued={false} />)}
                </div>
              )}
            </Section>

            <Section title="Upcoming topic backlog" count={backlog.length}>
              <p className="text-xs text-muted-foreground mb-3 px-1">
                Evergreen seed topics not yet covered. Each run also discovers timely trending topics via web search.
              </p>
              <div className="flex flex-wrap gap-2">
                {backlog.map((t) => (
                  <span
                    key={t.title}
                    className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border"
                    style={{ background: "var(--paper)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    {t.title}
                    <CategoryTag category={t.category} />
                  </span>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
