/**
 * Pure date helpers for the blog scheduling UI — a month-grid calendar and
 * day-grouping, plus formatters and <input type="datetime-local"> conversions.
 * No dependencies (the project avoids adding a date lib); all local-timezone
 * aware, storing/reading UTC ISO strings at the boundaries.
 */

export interface CalendarCell {
  date: Date;
  /** True when `date` falls in the grid's target month (vs. leading/trailing days). */
  inMonth: boolean;
}

/**
 * Build a Sunday-started month grid of whole weeks covering `month` (0-indexed).
 * Leading/trailing days from adjacent months fill the first/last weeks and are
 * flagged `inMonth: false`.
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[][] {
  const startOffset = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const numWeeks = Math.ceil((startOffset + daysInMonth) / 7);

  const weeks: CalendarCell[][] = [];
  for (let w = 0; w < numWeeks; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      // 1 - startOffset places day 1 on its weekday; JS normalizes negatives.
      const date = new Date(year, month, 1 - startOffset + w * 7 + d);
      week.push({ date, inMonth: date.getMonth() === month });
    }
    weeks.push(week);
  }
  return weeks;
}

/** Local-date key ('YYYY-MM-DD') for a Date or ISO string — used to bucket by day. */
export function localDayKey(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Group items by the local day of their `scheduledFor`; items without one are skipped. */
export function groupByLocalDay<T extends { scheduledFor?: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!item.scheduledFor) continue;
    const key = localDayKey(item.scheduledFor);
    const arr = map.get(key);
    if (arr) arr.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export function formatScheduleDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatScheduleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** True if the instant is strictly in the future (used to reject past schedules). */
export function isFutureISO(iso: string): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t > Date.now();
}

/** ISO string → value for <input type="datetime-local"> (local wall-clock). */
export function toDatetimeLocalValue(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (local) → UTC ISO string. Empty → null. */
export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
