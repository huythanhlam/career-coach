import { describe, it, expect } from "vitest";
import {
  buildMonthGrid,
  localDayKey,
  groupByLocalDay,
  isFutureISO,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
} from "./calendar";

describe("buildMonthGrid", () => {
  it("returns whole weeks (7 days each), starting on a Sunday", () => {
    const grid = buildMonthGrid(2026, 5); // June 2026
    expect(grid.length).toBeGreaterThanOrEqual(4);
    expect(grid.length).toBeLessThanOrEqual(6);
    for (const week of grid) expect(week).toHaveLength(7);
    expect(grid[0][0].date.getDay()).toBe(0);
  });

  it("covers exactly the days of the target month, in order", () => {
    const year = 2026;
    const month = 5; // June (30 days)
    const grid = buildMonthGrid(year, month);
    const inMonth = grid
      .flat()
      .filter((c) => c.inMonth)
      .map((c) => c.date.getDate());
    expect(inMonth).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("handles a month that begins on Sunday (first cell is day 1)", () => {
    // Feb 2026 starts on a Sunday.
    const grid = buildMonthGrid(2026, 1);
    expect(grid[0][0].inMonth).toBe(true);
    expect(grid[0][0].date.getDate()).toBe(1);
  });
});

describe("localDayKey", () => {
  it("formats as YYYY-MM-DD and is stable for the same local day", () => {
    const d = new Date(2026, 5, 3, 14, 30);
    expect(localDayKey(d)).toBe("2026-06-03");
    expect(localDayKey(d.toISOString())).toBe(localDayKey(d));
  });
});

describe("groupByLocalDay", () => {
  it("buckets posts by their local scheduled day and skips unscheduled ones", () => {
    const morning = new Date(2026, 5, 10, 9, 0).toISOString();
    const evening = new Date(2026, 5, 10, 20, 0).toISOString();
    const other = new Date(2026, 5, 11, 9, 0).toISOString();
    const posts = [
      { slug: "a", scheduledFor: morning },
      { slug: "b", scheduledFor: evening },
      { slug: "c", scheduledFor: other },
      { slug: "d" }, // no schedule
    ];
    const grouped = groupByLocalDay(posts);
    expect(grouped.get("2026-06-10")!.map((p) => p.slug)).toEqual(["a", "b"]);
    expect(grouped.get("2026-06-11")!.map((p) => p.slug)).toEqual(["c"]);
    expect([...grouped.values()].flat()).toHaveLength(3);
  });
});

describe("isFutureISO", () => {
  it("distinguishes past from future and rejects garbage", () => {
    expect(isFutureISO(new Date(Date.now() + 60_000).toISOString())).toBe(true);
    expect(isFutureISO(new Date(Date.now() - 60_000).toISOString())).toBe(false);
    expect(isFutureISO("not a date")).toBe(false);
  });
});

describe("datetime-local round trip", () => {
  it("converts ISO → local input value → ISO without drift", () => {
    const iso = new Date(2026, 5, 15, 13, 45).toISOString();
    const localValue = toDatetimeLocalValue(iso);
    expect(localValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromDatetimeLocalValue(localValue)).toBe(iso);
  });

  it("treats empty input as no schedule", () => {
    expect(fromDatetimeLocalValue("")).toBeNull();
  });
});
