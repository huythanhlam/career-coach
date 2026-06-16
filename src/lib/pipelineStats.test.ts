import { describe, it, expect } from "vitest";
import type { JobPosting, JobStatus } from "@/types/jobPosting";
import { computePipelineStats, buildPipelineSummary, STALE_AFTER_DAYS } from "./pipelineStats";

const NOW = new Date("2026-06-10T12:00:00Z");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

let seq = 0;
const posting = (status: JobStatus, over: Partial<JobPosting> = {}): JobPosting => ({
  id: `p${++seq}`,
  title: "Product Manager",
  company: "Acme",
  source: "manual",
  status,
  favorite: false,
  createdAt: daysAgo(30),
  updatedAt: daysAgo(1),
  ...over,
});

describe("computePipelineStats", () => {
  it("returns null rates for an empty pipeline", () => {
    const stats = computePipelineStats([], NOW);
    expect(stats.applied).toBe(0);
    expect(stats.responseRate).toBeNull();
    expect(stats.interviewRate).toBeNull();
    expect(stats.staleApplications).toEqual([]);
    expect(stats.tailoredEdge).toBeNull();
  });

  it("counts funnel stages cumulatively (rejected counts as applied + response)", () => {
    const stats = computePipelineStats(
      [
        posting("saved"),
        posting("applied"),
        posting("interviewing"),
        posting("offer"),
        posting("accepted"),
        posting("rejected"),
      ],
      NOW,
    );
    expect(stats.applied).toBe(5);
    expect(stats.responses).toBe(4);
    expect(stats.interviews).toBe(3);
    expect(stats.offers).toBe(2);
    expect(stats.responseRate).toBeCloseTo(4 / 5);
    expect(stats.interviewRate).toBeCloseTo(3 / 5);
  });

  it("flags only old, still-applied postings as stale, oldest first", () => {
    const fresh = posting("applied", { appliedAt: daysAgo(2) });
    const old = posting("applied", { appliedAt: daysAgo(STALE_AFTER_DAYS + 5) });
    const older = posting("applied", { appliedAt: daysAgo(STALE_AFTER_DAYS + 20) });
    const moved = posting("interviewing", { appliedAt: daysAgo(40) });
    const stats = computePipelineStats([fresh, old, older, moved], NOW);
    expect(stats.staleApplications.map((p) => p.id)).toEqual([older.id, old.id]);
  });

  it("falls back to updatedAt for staleness when appliedAt is missing", () => {
    const p = posting("applied", { appliedAt: undefined, updatedAt: daysAgo(STALE_AFTER_DAYS + 1) });
    expect(computePipelineStats([p], NOW).staleApplications).toHaveLength(1);
  });

  it("computes the tailored edge only when both groups have ≥3 applications", () => {
    const tailored = (status: JobStatus) => posting(status, { appliedResumeId: "r1" });
    const small = computePipelineStats([tailored("interviewing"), posting("applied"), posting("applied"), posting("applied")], NOW);
    expect(small.tailoredEdge).toBeNull();

    const enough = computePipelineStats(
      [
        tailored("interviewing"), tailored("offer"), tailored("applied"),
        posting("applied"), posting("applied"), posting("rejected"),
      ],
      NOW,
    );
    expect(enough.tailoredEdge).not.toBeNull();
    expect(enough.tailoredEdge!.tailoredRate).toBeCloseTo(2 / 3);
    expect(enough.tailoredEdge!.untailoredRate).toBeCloseTo(1 / 3);
  });
});

describe("buildPipelineSummary", () => {
  it("is empty when nothing is tracked", () => {
    expect(buildPipelineSummary([])).toBe("");
    expect(buildPipelineSummary([posting("suggested"), posting("archived")])).toBe("");
  });

  it("summarizes counts and lists active applications", () => {
    const summary = buildPipelineSummary([
      posting("applied", { title: "PM", company: "Stripe" }),
      posting("interviewing", { title: "Senior PM", company: "Figma" }),
      posting("saved"),
      posting("suggested"),
    ]);
    expect(summary).toContain("3 tracked");
    expect(summary).toContain("1 applied");
    expect(summary).toContain("1 interviewing");
    expect(summary).toContain("PM at Stripe (applied)");
    expect(summary).toContain("Senior PM at Figma (interviewing)");
    expect(summary).not.toContain("suggested");
  });
});
