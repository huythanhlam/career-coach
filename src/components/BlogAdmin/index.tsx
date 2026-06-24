import { useEffect, useMemo, useState } from "react";
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
  PenLine,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { useBlogAdminPosts } from "@/hooks/useBlogPosts";
import { useUserProfile } from "@/context/UserProfileContext";
import { BLOG_SCHEDULE, nextRun, humanizeUntil } from "@/config/blogSchedule";
import { slugify } from "@/lib/blogDraft";
import { createDraftFromTopic, schedulePost, cancelSchedule } from "@/services/blogAdminService";
import type { BlogPost } from "@/types/blogPost";
import seedTopics from "../../../data/blog/_topics.json";
import { BlogEditor } from "./BlogEditor";
import { ScheduledView } from "./ScheduledView";

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

/** Read the `blog_admin/edit/<slug>` sub-route from the hash, live across navigation. */
function useEditSlug(): string | null {
  const read = () => {
    const h = decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
    const m = /^blog_admin\/edit\/(.+)$/.exec(h);
    return m ? m[1] : null;
  };
  const [slug, setSlug] = useState<string | null>(read);
  useEffect(() => {
    const on = () => setSlug(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return slug;
}

const goToEditor = (slug: string) => {
  window.location.hash = `/blog_admin/edit/${slug}`;
};
const goToDashboard = () => {
  window.location.hash = `/blog_admin`;
};

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

function PostRow({ post, queued, onEdit }: { post: BlogPost; queued: boolean; onEdit: (slug: string) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(post.slug)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(post.slug);
        }
      }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors hover:border-[var(--primary)]"
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
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 inline-flex items-center gap-1" style={{ background: "rgba(232,185,72,0.15)", color: "#B7791F" }}>
          <PenLine className="w-3 h-3" /> Edit
        </span>
      ) : (
        <a
          href={`#/blog/${post.slug}`}
          onClick={(e) => e.stopPropagation()}
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
  const editSlug = useEditSlug();
  const [refreshKey, setRefreshKey] = useState(0);
  const { scheduled, queued, published, loading } = useBlogAdminPosts(refreshKey);

  // Generating a draft from a backlog topic, ahead of the scheduled run.
  const [genTitle, setGenTitle] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

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

  if (editSlug) {
    return (
      <BlogEditor
        slug={editSlug}
        onClose={goToDashboard}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
    );
  }

  const handleTopic = async (t: { title: string; category: string }) => {
    setGenTitle(t.title);
    setGenError(null);
    try {
      const res = await createDraftFromTopic(t);
      setRefreshKey((k) => k + 1);
      goToEditor(res.slug);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Couldn't draft this topic. Please try again.");
    } finally {
      setGenTitle(null);
    }
  };

  const handleReschedule = async (slug: string, whenISO: string) => {
    await schedulePost(slug, whenISO);
    setRefreshKey((k) => k + 1);
  };
  const handleCancelSchedule = async (slug: string) => {
    await cancelSchedule(slug);
    setRefreshKey((k) => k + 1);
  };

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <StatCard icon={CalendarClock} label="Scheduled" value={loading ? "—" : scheduled.length} tint="#8B5CF6" />
          <StatCard icon={FileText} label="Queued (in review)" value={loading ? "—" : queued.length} tint="#E8B948" />
          <StatCard icon={CheckCircle2} label="Published" value={loading ? "—" : published.length} tint="#2F6B4F" />
          <StatCard icon={ListChecks} label="Backlog topics" value={backlog.length} tint="#3B82F6" />
        </div>

        {genError && (
          <div
            className="rounded-xl border px-4 py-3 mb-6 text-sm flex items-start gap-2"
            style={{ background: "rgba(220,38,38,0.08)", borderColor: "rgba(220,38,38,0.3)", color: "#B91C1C" }}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{genError}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : (
          <>
            <Section title="Scheduled · auto-publishing" count={scheduled.length}>
              <p className="text-xs text-muted-foreground mb-3 px-1">
                Posts set to publish automatically at a specific time. Switch between list and calendar to find when each goes live; reschedule or cancel any of them.
              </p>
              <ScheduledView
                posts={scheduled}
                onEdit={goToEditor}
                onReschedule={handleReschedule}
                onCancel={handleCancelSchedule}
              />
            </Section>

            <Section title="Queued · awaiting review" count={queued.length}>
              {queued.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">
                  Nothing queued. Draft a topic below now, or wait for the next scheduled run.
                </p>
              ) : (
                <div className="space-y-2">
                  {queued.map((p) => <PostRow key={p.slug} post={p} queued onEdit={goToEditor} />)}
                </div>
              )}
            </Section>

            <Section title="Published" count={published.length}>
              {published.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">No published posts yet.</p>
              ) : (
                <div className="space-y-2">
                  {published.map((p) => <PostRow key={p.slug} post={p} queued={false} onEdit={goToEditor} />)}
                </div>
              )}
            </Section>

            <Section title="Upcoming topic backlog" count={backlog.length}>
              <p className="text-xs text-muted-foreground mb-3 px-1">
                Evergreen seed topics not yet covered. Click one to draft it with AI now — ahead of the schedule —
                then edit and publish it yourself. Each scheduled run also discovers timely trending topics via web search.
              </p>
              <div className="flex flex-wrap gap-2">
                {backlog.map((t) => {
                  const isGenerating = genTitle === t.title;
                  return (
                    <button
                      key={t.title}
                      onClick={() => handleTopic(t)}
                      disabled={genTitle !== null}
                      className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors hover:border-[var(--primary)] disabled:opacity-50"
                      style={{ background: "var(--paper)", borderColor: "var(--border)", color: "var(--foreground)" }}
                      title="Draft this topic now"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--primary)" }} />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                      )}
                      {isGenerating ? "Drafting…" : t.title}
                      {!isGenerating && <CategoryTag category={t.category} />}
                    </button>
                  );
                })}
              </div>
              {genTitle && (
                <p className="text-xs text-muted-foreground mt-3 px-1">
                  Researching and drafting “{genTitle}” — this takes a moment. You'll drop into the editor when it's ready.
                </p>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
