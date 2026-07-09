import { describe, it, expect } from "vitest";
import {
  buildFollowUpNudges,
  STALE_AFTER_DAYS,
  type StalePostingCandidate,
} from "./followUpNudges.ts";

const NOW = new Date("2026-07-08T00:00:00.000Z");

function posting(overrides: Partial<StalePostingCandidate>): StalePostingCandidate {
  return {
    id: "posting-1",
    user_id: "user-1",
    status: "applied",
    title: "Software Engineer",
    company: "Stripe",
    applied_at: null,
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

describe("buildFollowUpNudges", () => {
  it("produces a follow_up nudge for a stale applied posting", () => {
    const rows = buildFollowUpNudges(
      [posting({ applied_at: daysAgo(STALE_AFTER_DAYS + 1) })],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: "user-1",
      kind: "follow_up",
      subject_id: "posting-1",
      cta_view: "dashboard",
    });
    expect(rows[0].title).toContain("Stripe");
    expect(rows[0].body).toContain("Software Engineer");
    expect(rows[0].body).toContain("Stripe");
  });

  it("includes stale interviewing postings", () => {
    const rows = buildFollowUpNudges(
      [posting({ status: "interviewing", applied_at: daysAgo(STALE_AFTER_DAYS + 5) })],
      NOW,
    );
    expect(rows).toHaveLength(1);
  });

  it("excludes postings not yet past the staleness threshold", () => {
    const rows = buildFollowUpNudges(
      [posting({ applied_at: daysAgo(STALE_AFTER_DAYS - 1) })],
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it("excludes postings in other statuses (saved, offer, rejected, ...)", () => {
    const rows = buildFollowUpNudges(
      [
        posting({ id: "a", status: "saved", applied_at: daysAgo(30) }),
        posting({ id: "b", status: "offer", applied_at: daysAgo(30) }),
        posting({ id: "c", status: "rejected", applied_at: daysAgo(30) }),
        posting({ id: "d", status: "suggested", applied_at: daysAgo(30) }),
      ],
      NOW,
    );
    expect(rows).toHaveLength(0);
  });

  it("falls back to updated_at when applied_at is null", () => {
    const rows = buildFollowUpNudges(
      [posting({ applied_at: null, updated_at: daysAgo(STALE_AFTER_DAYS + 2) })],
      NOW,
    );
    expect(rows).toHaveLength(1);
  });

  it("falls back to a generic company label when company is missing", () => {
    const rows = buildFollowUpNudges(
      [posting({ company: null, applied_at: daysAgo(STALE_AFTER_DAYS + 1) })],
      NOW,
    );
    expect(rows[0].title).toBe("Follow up with this company?");
    expect(rows[0].body).toContain("this company");
  });

  it("is stable across repeated runs over the same input", () => {
    const input = [posting({ applied_at: daysAgo(STALE_AFTER_DAYS + 3) })];
    const first = buildFollowUpNudges(input, NOW);
    const second = buildFollowUpNudges(input, NOW);
    expect(second).toEqual(first);
  });

  it("returns no rows for an empty posting list", () => {
    expect(buildFollowUpNudges([], NOW)).toEqual([]);
  });
});
