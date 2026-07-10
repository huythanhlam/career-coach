import { describe, it, expect } from "vitest";
import type { JobPosting, JobStatus } from "@/types/jobPosting";
import {
  computePipelineStats,
  computeResumeVariantStats,
  buildPipelineSummary,
  STALE_AFTER_DAYS,
} from "./pipelineStats";

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
    const p = posting("applied", {
      appliedAt: undefined,
      updatedAt: daysAgo(STALE_AFTER_DAYS + 1),
    });
    expect(computePipelineStats([p], NOW).staleApplications).toHaveLength(1);
  });

});

describe("computeResumeVariantStats", () => {
  const resumes = [
    { id: "r1", name: "Resume v1" },
    { id: "r2", name: "Resume v2" },
  ];

  it("returns null when fewer than 10 total applications", () => {
    const postings = [
      ...Array.from({ length: 4 }, () => posting("interviewing", { appliedResumeId: "r1" })),
      ...Array.from({ length: 4 }, () => posting("applied", { appliedResumeId: "r2" })),
    ];
    expect(computeResumeVariantStats(postings, resumes)).toBeNull();
  });

  it("returns null when fewer than 2 qualifying variant groups, even with ≥10 total applications", () => {
    const postings = [
      ...Array.from({ length: 9 }, () => posting("interviewing", { appliedResumeId: "r1" })),
      posting("applied", { appliedResumeId: "r2" }), // only 1 — below the ≥3 per-variant minimum
    ];
    expect(computeResumeVariantStats(postings, resumes)).toBeNull();
  });

  it("omits groups with fewer than 3 applications rather than merging them", () => {
    const postings = [
      ...Array.from({ length: 5 }, () => posting("interviewing", { appliedResumeId: "r1" })),
      ...Array.from({ length: 5 }, () => posting("applied", { appliedResumeId: "r2" })),
      posting("rejected", { appliedResumeId: "r3" }),
      posting("applied", { appliedResumeId: "r3" }),
    ];
    const stats = computeResumeVariantStats(postings, resumes);
    expect(stats).not.toBeNull();
    expect(stats!.map((s) => s.id).sort()).toEqual(["r1", "r2"]);
  });

  it("buckets applications with no resume attached under 'No resume attached'", () => {
    const postings = [
      ...Array.from({ length: 5 }, () => posting("interviewing", { appliedResumeId: "r1" })),
      ...Array.from({ length: 5 }, () => posting("applied")), // no appliedResumeId
    ];
    const stats = computeResumeVariantStats(postings, resumes)!;
    const noResume = stats.find((s) => s.id === null);
    expect(noResume).toBeDefined();
    expect(noResume!.label).toBe("No resume attached");
    expect(noResume!.applied).toBe(5);
  });

  it("labels a resume no longer in savedResumes as 'Deleted resume'", () => {
    const postings = [
      ...Array.from({ length: 5 }, () => posting("interviewing", { appliedResumeId: "r1" })),
      ...Array.from({ length: 5 }, () => posting("applied", { appliedResumeId: "gone" })),
    ];
    const stats = computeResumeVariantStats(postings, resumes)!;
    const deleted = stats.find((s) => s.id === "gone");
    expect(deleted!.label).toBe("Deleted resume");
  });

  it("disambiguates colliding deleted-resume labels with an id suffix", () => {
    const postings = [
      ...Array.from({ length: 4 }, () => posting("interviewing", { appliedResumeId: "gone1" })),
      ...Array.from({ length: 4 }, () => posting("applied", { appliedResumeId: "gone2" })),
      ...Array.from({ length: 3 }, () => posting("rejected", { appliedResumeId: "r1" })),
    ];
    const stats = computeResumeVariantStats(postings, resumes)!;
    const g1 = stats.find((s) => s.id === "gone1");
    const g2 = stats.find((s) => s.id === "gone2");
    expect(g1!.label).toBe(`Deleted resume (${"gone1".slice(0, 6)})`);
    expect(g2!.label).toBe(`Deleted resume (${"gone2".slice(0, 6)})`);
  });

  it("computes exact per-group response rates and sorts by rate descending", () => {
    const postings = [
      // r1: 3 responses / 6 applied = 0.5
      posting("interviewing", { appliedResumeId: "r1" }),
      posting("offer", { appliedResumeId: "r1" }),
      posting("rejected", { appliedResumeId: "r1" }),
      posting("applied", { appliedResumeId: "r1" }),
      posting("applied", { appliedResumeId: "r1" }),
      posting("applied", { appliedResumeId: "r1" }),
      // r2: 1 response / 4 applied = 0.25
      posting("interviewing", { appliedResumeId: "r2" }),
      posting("applied", { appliedResumeId: "r2" }),
      posting("applied", { appliedResumeId: "r2" }),
      posting("applied", { appliedResumeId: "r2" }),
    ];
    const stats = computeResumeVariantStats(postings, resumes)!;
    expect(stats).toHaveLength(2);
    expect(stats[0].id).toBe("r1");
    expect(stats[0].applied).toBe(6);
    expect(stats[0].responses).toBe(3);
    expect(stats[0].responseRate).toBeCloseTo(0.5);
    expect(stats[1].id).toBe("r2");
    expect(stats[1].applied).toBe(4);
    expect(stats[1].responses).toBe(1);
    expect(stats[1].responseRate).toBeCloseTo(0.25);
  });

  it("works with savedResumes undefined (treats every id as deleted)", () => {
    const postings = [
      ...Array.from({ length: 5 }, () => posting("interviewing", { appliedResumeId: "r1" })),
      ...Array.from({ length: 5 }, () => posting("applied", { appliedResumeId: "r2" })),
    ];
    const stats = computeResumeVariantStats(postings, undefined)!;
    expect(stats).not.toBeNull();
    expect(stats.every((s) => s.label.startsWith("Deleted resume"))).toBe(true);
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
