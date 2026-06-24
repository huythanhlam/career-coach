import { useMemo, useState } from "react";
import {
  CalendarDays,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  PenLine,
  CalendarX,
  Loader2,
} from "lucide-react";
import type { BlogPost } from "@/types/blogPost";
import {
  buildMonthGrid,
  groupByLocalDay,
  localDayKey,
  formatScheduleTime,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  isFutureISO,
  WEEKDAY_LABELS,
  MONTH_LABELS,
} from "@/lib/calendar";

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

interface Props {
  posts: BlogPost[];
  onEdit: (slug: string) => void;
  onReschedule: (slug: string, whenISO: string) => Promise<void> | void;
  onCancel: (slug: string) => Promise<void> | void;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function PostChip({ post, onEdit }: { post: BlogPost; onEdit: (slug: string) => void }) {
  return (
    <button
      onClick={() => onEdit(post.slug)}
      className="w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded truncate hover:opacity-80"
      style={{ background: `${color(post.category)}1a`, color: color(post.category) }}
      title={`${post.scheduledFor ? formatScheduleTime(post.scheduledFor) + " · " : ""}${post.title}`}
    >
      {post.scheduledFor ? `${formatScheduleTime(post.scheduledFor)} ` : ""}
      {post.heroEmoji || "📝"} {post.title}
    </button>
  );
}

function ListView({ posts, onEdit, onReschedule, onCancel }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const groups = [...groupByLocalDay(posts).entries()];
    groups.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    for (const [, list] of groups) list.sort((a, b) => (a.scheduledFor! < b.scheduledFor! ? -1 : 1));
    return groups;
  }, [posts]);

  const submitReschedule = async (slug: string) => {
    const iso = fromDatetimeLocalValue(value);
    if (!iso || !isFutureISO(iso)) {
      setErr("Pick a future date and time.");
      return;
    }
    setBusy(slug);
    setErr(null);
    try {
      await onReschedule(slug, iso);
      setEditing(null);
    } finally {
      setBusy(null);
    }
  };

  if (posts.length === 0) {
    return <p className="text-sm text-muted-foreground px-1">No scheduled posts. Set a publish time on any draft from its editor.</p>;
  }

  return (
    <div className="space-y-5">
      {err && <p className="text-xs" style={{ color: "#B91C1C" }}>{err}</p>}
      {byDay.map(([key, list]) => (
        <div key={key}>
          <div className="text-xs font-semibold mb-2 text-muted-foreground">{dayLabel(key)}</div>
          <div className="space-y-2">
            {list.map((p) => (
              <div
                key={p.slug}
                className="rounded-xl border px-4 py-3"
                style={{ background: "var(--paper)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono tabular-nums flex items-center gap-1 flex-shrink-0" style={{ color: "var(--foreground)" }}>
                    <Clock className="w-3.5 h-3.5" /> {p.scheduledFor ? formatScheduleTime(p.scheduledFor) : "—"}
                  </span>
                  <span className="text-lg flex-shrink-0">{p.heroEmoji || "📝"}</span>
                  <span className="font-medium text-sm truncate flex-1" style={{ color: "var(--foreground)" }}>{p.title}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => onEdit(p.slug)} className="text-xs font-semibold inline-flex items-center gap-1 hover:underline" style={{ color: "var(--primary)" }}>
                      <PenLine className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        setEditing(editing === p.slug ? null : p.slug);
                        setValue(toDatetimeLocalValue(p.scheduledFor));
                        setErr(null);
                      }}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => onCancel(p.slug)}
                      className="text-xs font-semibold inline-flex items-center gap-1 hover:underline"
                      style={{ color: "#B91C1C" }}
                    >
                      <CalendarX className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                </div>
                {editing === p.slug && (
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="datetime-local"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="rounded-lg border px-2 py-1 text-sm"
                      style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                    />
                    <button
                      onClick={() => submitReschedule(p.slug)}
                      disabled={busy === p.slug}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50 inline-flex items-center gap-1"
                      style={{ background: "var(--primary)" }}
                    >
                      {busy === p.slug && <Loader2 className="w-3 h-3 animate-spin" />} Update
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarView({ posts, onEdit }: Props) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const byDay = useMemo(() => groupByLocalDay(posts), [posts]);
  const todayKey = localDayKey(today);

  const shift = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-base font-semibold" style={{ color: "var(--foreground)" }}>
          {MONTH_LABELS[cursor.month]} {cursor.year}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="p-1.5 rounded-lg border hover:bg-muted" style={{ borderColor: "var(--border)" }} aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" style={{ color: "var(--foreground)" }} />
          </button>
          <button
            onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border hover:bg-muted"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            Today
          </button>
          <button onClick={() => shift(1)} className="p-1.5 rounded-lg border hover:bg-muted" style={{ borderColor: "var(--border)" }} aria-label="Next month">
            <ChevronRight className="w-4 h-4" style={{ color: "var(--foreground)" }} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)", background: "var(--border)" }}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="text-[11px] font-semibold text-center py-1.5" style={{ background: "var(--card)", color: "var(--muted-foreground)" }}>
            {w}
          </div>
        ))}
        {grid.flat().map((cell, i) => {
          const key = localDayKey(cell.date);
          const dayPosts = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={i}
              className="min-h-[5.5rem] p-1.5 align-top"
              style={{ background: cell.inMonth ? "var(--paper)" : "var(--card)", opacity: cell.inMonth ? 1 : 0.5 }}
            >
              <div
                className="text-xs mb-1 flex items-center justify-center w-6 h-6 rounded-full"
                style={isToday ? { background: "var(--primary)", color: "#fff", fontWeight: 700 } : { color: "var(--muted-foreground)" }}
              >
                {cell.date.getDate()}
              </div>
              <div className="space-y-1">
                {dayPosts.map((p) => (
                  <PostChip key={p.slug} post={p} onEdit={onEdit} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ScheduledView(props: Props) {
  const [view, setView] = useState<"list" | "calendar">("list");
  return (
    <div>
      <div className="flex items-center gap-1 mb-4">
        {(["list", "calendar"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border inline-flex items-center gap-1.5 transition-colors"
            style={
              view === v
                ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" }
                : { background: "var(--paper)", color: "var(--foreground)", borderColor: "var(--border)" }
            }
          >
            {v === "list" ? <ListIcon className="w-3.5 h-3.5" /> : <CalendarDays className="w-3.5 h-3.5" />}
            {v === "list" ? "List" : "Calendar"}
          </button>
        ))}
      </div>
      {view === "list" ? <ListView {...props} /> : <CalendarView {...props} />}
    </div>
  );
}
