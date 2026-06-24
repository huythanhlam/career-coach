import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import {
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  Globe,
  EyeOff,
  Plus,
  X,
  ShieldAlert,
  ExternalLink,
  CalendarClock,
  CalendarX,
} from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import {
  loadAdminPost,
  savePost,
  setPublished as setPublishedSvc,
  deletePost,
  schedulePost,
  cancelSchedule,
  type EditablePost,
} from "@/services/blogAdminService";
import {
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  isFutureISO,
  formatScheduleDateTime,
} from "@/lib/calendar";
import type { BlogPost, BlogSource } from "@/types/blogPost";

const CATEGORIES = [
  "resume",
  "interview",
  "job-search",
  "career-growth",
  "salary",
  "networking",
  "linkedin",
  "job-market",
  "general",
];

const inputStyle = {
  background: "var(--paper)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
} as const;

const labelCls = "block text-xs font-semibold mb-1.5 text-muted-foreground";
const fieldCls =
  "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]";

function StatusPill({ post }: { post: BlogPost }) {
  const live = !!post.published;
  return (
    <span
      className="text-xs font-semibold px-2.5 py-1 rounded-full"
      style={
        live
          ? { background: "rgba(47,107,79,0.15)", color: "#2F6B4F" }
          : { background: "rgba(232,185,72,0.15)", color: "#B7791F" }
      }
    >
      {live ? "Published · live" : "Draft · not public"}
    </span>
  );
}

export function BlogEditor({
  slug,
  onClose,
  onChanged,
}: {
  slug: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { profile } = useUserProfile();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Editable form state.
  const [form, setForm] = useState<EditablePost | null>(null);
  const [tagsText, setTagsText] = useState("");

  const [busy, setBusy] = useState<null | "save" | "publish" | "delete" | "schedule">(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Schedule panel: the datetime-local value being edited.
  const [scheduleValue, setScheduleValue] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setError(null);
    loadAdminPost(slug)
      .then((p) => {
        if (!active) return;
        if (!p) {
          setNotFound(true);
        } else {
          setPost(p);
          setForm({
            title: p.title,
            excerpt: p.excerpt,
            category: p.category,
            tags: p.tags,
            content: p.content,
            heroEmoji: p.heroEmoji,
            sources: p.sources,
          });
          setTagsText(p.tags.join(", "));
          setScheduleValue(toDatetimeLocalValue(p.scheduledFor));
        }
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load the post.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const patch = (p: Partial<EditablePost>) => {
    setForm((prev) => (prev ? { ...prev, ...p } : prev));
    setDirty(true);
    setError(null);
  };

  const updateSource = (i: number, key: keyof BlogSource, value: string) => {
    if (!form) return;
    const sources = form.sources.map((s, idx) => (idx === i ? { ...s, [key]: value } : s));
    patch({ sources });
  };
  const addSource = () => form && patch({ sources: [...form.sources, { label: "", url: "" }] });
  const removeSource = (i: number) =>
    form && patch({ sources: form.sources.filter((_, idx) => idx !== i) });

  const commitTags = () => {
    const tags = tagsText
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    patch({ tags });
  };

  const handleSave = async () => {
    if (!form) return;
    const tags = tagsText.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (!form.title.trim() || !form.content.trim()) {
      setError("A title and body are required.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      const cleanSources = form.sources.filter((s) => s.url.trim());
      await savePost(slug, { ...form, tags, sources: cleanSources });
      setForm((prev) => (prev ? { ...prev, tags, sources: cleanSources } : prev));
      setDirty(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setBusy(null);
    }
  };

  const handlePublishToggle = async () => {
    if (!post) return;
    const next = !post.published;
    if (dirty) {
      setError("Save your changes before publishing.");
      return;
    }
    setBusy("publish");
    setError(null);
    try {
      await setPublishedSvc(slug, next);
      setPost({ ...post, published: next, status: next ? "published" : "review" });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update publish state.");
    } finally {
      setBusy(null);
    }
  };

  const handleSchedule = async () => {
    if (!post) return;
    if (dirty) {
      setError("Save your changes before scheduling.");
      return;
    }
    const iso = fromDatetimeLocalValue(scheduleValue);
    if (!iso || !isFutureISO(iso)) {
      setError("Pick a future date and time to schedule.");
      return;
    }
    setBusy("schedule");
    setError(null);
    try {
      await schedulePost(slug, iso);
      setPost({ ...post, status: "scheduled", scheduledFor: iso, published: false });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule.");
    } finally {
      setBusy(null);
    }
  };

  const handleCancelSchedule = async () => {
    if (!post) return;
    setBusy("schedule");
    setError(null);
    try {
      await cancelSchedule(slug);
      setPost({ ...post, status: "review", scheduledFor: undefined });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel the schedule.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this post permanently? This cannot be undone.")) return;
    setBusy("delete");
    setError(null);
    try {
      await deletePost(slug);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
      setBusy(null);
    }
  };

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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-sm mb-6 hover:underline"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Blog Admin
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : notFound ? (
          <p className="text-sm text-muted-foreground">That post no longer exists.</p>
        ) : form && post ? (
          <>
            <header className="flex items-start justify-between gap-4 mb-6 flex-wrap">
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
                  Edit post
                </h1>
                <p className="text-xs text-muted-foreground mt-1 font-mono break-all">/{post.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill post={post} />
                {post.published && (
                  <a
                    href={`#/blog/${post.slug}`}
                    className="text-xs font-semibold inline-flex items-center gap-1 hover:underline"
                    style={{ color: "var(--primary)" }}
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </header>

            {error && (
              <div
                className="rounded-xl border px-4 py-3 mb-5 text-sm"
                style={{ background: "rgba(220,38,38,0.08)", borderColor: "rgba(220,38,38,0.3)", color: "#B91C1C" }}
              >
                {error}
              </div>
            )}

            {/* Metadata */}
            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div className="sm:col-span-2">
                <label className={labelCls}>Title</label>
                <input
                  className={fieldCls}
                  style={inputStyle}
                  value={form.title}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Excerpt (post card summary)</label>
                <textarea
                  className={fieldCls}
                  style={inputStyle}
                  rows={2}
                  value={form.excerpt}
                  onChange={(e) => patch({ excerpt: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select
                  className={fieldCls}
                  style={inputStyle}
                  value={form.category}
                  onChange={(e) => patch({ category: e.target.value })}
                >
                  {(CATEGORIES.includes(form.category) ? CATEGORIES : [form.category, ...CATEGORIES]).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Hero emoji</label>
                <input
                  className={fieldCls}
                  style={inputStyle}
                  value={form.heroEmoji ?? ""}
                  maxLength={4}
                  onChange={(e) => patch({ heroEmoji: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Tags (comma-separated)</label>
                <input
                  className={fieldCls}
                  style={inputStyle}
                  value={tagsText}
                  onChange={(e) => {
                    setTagsText(e.target.value);
                    setDirty(true);
                  }}
                  onBlur={commitTags}
                />
              </div>
            </div>

            {/* Sources */}
            <div className="mb-6">
              <label className={labelCls}>Sources</label>
              <div className="space-y-2">
                {form.sources.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className={`${fieldCls} flex-1`}
                      style={inputStyle}
                      placeholder="Label"
                      value={s.label}
                      onChange={(e) => updateSource(i, "label", e.target.value)}
                    />
                    <input
                      className={`${fieldCls} flex-[2]`}
                      style={inputStyle}
                      placeholder="https://…"
                      value={s.url}
                      onChange={(e) => updateSource(i, "url", e.target.value)}
                    />
                    <button
                      onClick={() => removeSource(i)}
                      className="px-2 rounded-xl border flex-shrink-0"
                      style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                      aria-label="Remove source"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addSource}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border hover:bg-muted"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add source
                </button>
              </div>
            </div>

            {/* Body editor + live preview */}
            <label className={labelCls}>Body (Markdown)</label>
            <div className="grid lg:grid-cols-2 gap-4 mb-6">
              <textarea
                className="w-full rounded-xl border px-3 py-3 text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--primary)] min-h-[28rem]"
                style={inputStyle}
                value={form.content}
                onChange={(e) => patch({ content: e.target.value })}
                spellCheck
              />
              <div
                className="rounded-xl border px-4 py-3 overflow-y-auto min-h-[28rem] max-h-[40rem]"
                style={{ background: "var(--paper)", borderColor: "var(--border)" }}
              >
                <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
                  <Markdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>
                    {form.content || "_Nothing to preview yet._"}
                  </Markdown>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="rounded-xl border px-4 py-3 mb-6" style={{ background: "var(--paper)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <CalendarClock className="w-4 h-4" style={{ color: "#8B5CF6" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Schedule</span>
                {post.status === "scheduled" && post.scheduledFor && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.15)", color: "#8B5CF6" }}>
                    Auto-publishes {formatScheduleDateTime(post.scheduledFor)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Pick a future date and time to auto-publish this post. It stays a draft until then.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="datetime-local"
                  value={scheduleValue}
                  onChange={(e) => setScheduleValue(e.target.value)}
                  className="rounded-lg border px-2 py-1.5 text-sm"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
                <button
                  onClick={handleSchedule}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-white disabled:opacity-50"
                  style={{ background: "#8B5CF6" }}
                >
                  {busy === "schedule" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                  {post.status === "scheduled" ? "Reschedule" : "Schedule"}
                </button>
                {post.status === "scheduled" && (
                  <button
                    onClick={handleCancelSchedule}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border disabled:opacity-50 hover:bg-muted"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    <CalendarX className="w-4 h-4" /> Cancel schedule
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap sticky bottom-0 py-3" style={{ background: "var(--background)" }}>
              <button
                onClick={handleSave}
                disabled={busy !== null || !dirty}
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-white disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {dirty ? "Save changes" : "Saved"}
              </button>

              <button
                onClick={handlePublishToggle}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border disabled:opacity-50 hover:bg-muted"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {busy === "publish" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : post.published ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}
                {post.published ? "Unpublish" : "Publish"}
              </button>

              <button
                onClick={handleDelete}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border ml-auto disabled:opacity-50"
                style={{ borderColor: "rgba(220,38,38,0.3)", color: "#B91C1C" }}
              >
                {busy === "delete" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
