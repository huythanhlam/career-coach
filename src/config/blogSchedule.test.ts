import { describe, it, expect } from "vitest";
import { nextRun, humanizeUntil } from "./blogSchedule";

// 2026-01-05 is a Monday (Jan 1 2026 is a Thursday).
const iso = (s: string) => new Date(s);

describe("nextRun (weekly, Mon 06:00 UTC)", () => {
  it("returns the same Monday 06:00 when called earlier that Monday", () => {
    expect(nextRun(iso("2026-01-05T05:59:00Z")).toISOString()).toBe("2026-01-05T06:00:00.000Z");
  });

  it("rolls to next Monday when called after 06:00 on Monday", () => {
    expect(nextRun(iso("2026-01-05T06:01:00Z")).toISOString()).toBe("2026-01-12T06:00:00.000Z");
  });

  it("treats exactly 06:00 as already firing → next Monday", () => {
    expect(nextRun(iso("2026-01-05T06:00:00Z")).toISOString()).toBe("2026-01-12T06:00:00.000Z");
  });

  it("from Sunday → the next day (Monday) 06:00", () => {
    expect(nextRun(iso("2026-01-04T12:00:00Z")).toISOString()).toBe("2026-01-05T06:00:00.000Z");
  });

  it("from midweek → the following Monday", () => {
    expect(nextRun(iso("2026-01-07T09:00:00Z")).toISOString()).toBe("2026-01-12T06:00:00.000Z");
  });

  it("always lands on a Monday at 06:00 UTC, strictly in the future", () => {
    const now = iso("2026-03-18T14:23:00Z");
    const r = nextRun(now);
    expect(r.getUTCDay()).toBe(1);
    expect(r.getUTCHours()).toBe(6);
    expect(r.getUTCMinutes()).toBe(0);
    expect(r.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("humanizeUntil", () => {
  it("formats day/hour/minute deltas", () => {
    const now = iso("2026-01-01T00:00:00Z");
    expect(humanizeUntil(iso("2026-01-04T05:00:00Z"), now)).toBe("in 3d 5h");
    expect(humanizeUntil(iso("2026-01-01T05:30:00Z"), now)).toBe("in 5h 30m");
    expect(humanizeUntil(iso("2026-01-01T00:02:00Z"), now)).toBe("in 2m");
    expect(humanizeUntil(iso("2025-12-31T00:00:00Z"), now)).toBe("now");
  });
});
