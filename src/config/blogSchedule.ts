/**
 * Blog auto-curation schedule — kept in sync with the cron in
 * `.github/workflows/blog-content-build.yml` (`0 6 * * 1`). Pure functions so the
 * Blog Admin view can show the cadence and the next run without any backend.
 */

export const BLOG_SCHEDULE = {
  /** Mirrors the workflow cron. */
  cron: "0 6 * * 1",
  weekdayUTC: 1, // Monday (0 = Sunday)
  hourUTC: 6,
  minuteUTC: 0,
  label: "Weekly · Mondays 06:00 UTC",
  cadence: "Weekly",
} as const;

/** The next time the build workflow will run, at or after `now` (UTC). */
export function nextRun(now: Date = new Date()): Date {
  const d = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      BLOG_SCHEDULE.hourUTC,
      BLOG_SCHEDULE.minuteUTC,
      0,
      0,
    ),
  );
  // Advance one day at a time until we land on the target weekday strictly in the
  // future. Bounded to a week+ so it always terminates.
  let guard = 0;
  while ((d.getUTCDay() !== BLOG_SCHEDULE.weekdayUTC || d.getTime() <= now.getTime()) && guard < 14) {
    d.setUTCDate(d.getUTCDate() + 1);
    guard++;
  }
  return d;
}

/** Human countdown like "in 3d 4h" / "in 5h 12m" / "in 2m". */
export function humanizeUntil(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "now";
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / (60 * 24));
  const h = Math.floor((mins % (60 * 24)) / 60);
  const m = mins % 60;
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}
