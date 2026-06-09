import { describe, it, expect } from "vitest";
import { scoreJobFit, fitLabel, buildDefaultQuery, canScoreProfile, RECOMMENDED_THRESHOLD } from "./jobRecommendation";
import type { JobPosting } from "@/types/jobPosting";
import { createEmptyProfile, type UserProfile } from "@/types/userProfile";

function job(over: Partial<JobPosting>): JobPosting {
  return {
    id: "j1", title: "", source: "web", status: "saved", favorite: false,
    createdAt: "", updatedAt: "", ...over,
  };
}

function profile(over: Partial<UserProfile>): UserProfile {
  return { ...createEmptyProfile(), ...over };
}

describe("scoreJobFit", () => {
  it("scores a skill- and role-aligned posting far above an unrelated one", () => {
    const p = profile({
      targetRole: "Product Manager",
      yearsOfExperience: 6,
      skills: ["Roadmapping", "SQL", "User Research", "Agile"],
    });
    const relevant = job({
      title: "Senior Product Manager",
      description: "Own the product roadmap. SQL and user research skills required. 5+ years experience.",
    });
    const unrelated = job({
      title: "Line Cook",
      description: "Prepare food in a busy kitchen. No office experience needed.",
    });

    const a = scoreJobFit(relevant, p);
    const b = scoreJobFit(unrelated, p);

    expect(a.score).toBeGreaterThan(b.score);
    expect(a.score).toBeGreaterThanOrEqual(RECOMMENDED_THRESHOLD);
    expect(a.reasons.length).toBeGreaterThan(0);
  });

  it("returns a full factor breakdown explaining the score", () => {
    const p = profile({ targetRole: "Product Manager", yearsOfExperience: 6, skills: ["SQL", "Roadmapping"] });
    const { factors } = scoreJobFit(
      job({ title: "Senior Product Manager", description: "Own the roadmap. SQL required. 5+ years." }),
      p,
    );
    expect(factors.map((f) => f.key)).toEqual(["skills", "role", "experience", "history"]);
    // Weights are percentage points that sum to 100.
    expect(factors.reduce((n, f) => n + f.weight, 0)).toBe(100);
    for (const f of factors) {
      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(100);
      expect(f.detail.length).toBeGreaterThan(0);
    }
  });

  it("explains gaps when a factor scores low", () => {
    const p = profile({ skills: ["Welding", "Carpentry"], yearsOfExperience: 2 });
    const { factors } = scoreJobFit(job({ title: "Tax Accountant", description: "CPA required. 8+ years." }), p);
    const skills = factors.find((f) => f.key === "skills")!;
    const exp = factors.find((f) => f.key === "experience")!;
    expect(skills.detail.toLowerCase()).toContain("none of your");
    expect(exp.detail).toContain("8+ years"); // surfaces the unmet requirement
  });

  it("credits matched skills in the reasons", () => {
    const p = profile({ skills: ["TypeScript", "React", "GraphQL"] });
    const { reasons } = scoreJobFit(
      job({ title: "Frontend Engineer", description: "We use TypeScript and React heavily." }),
      p,
    );
    expect(reasons.some((r) => r.toLowerCase().includes("skill"))).toBe(true);
  });

  it("down-weights a senior posting for a junior candidate", () => {
    const p = profile({ targetRole: "Engineer", skills: ["Java"], yearsOfExperience: 1 });
    const senior = scoreJobFit(job({ title: "Principal Engineer", description: "Java. 10+ years experience." }), p);
    const fitting = scoreJobFit(job({ title: "Junior Engineer", description: "Java. Entry level, 1 year." }), p);
    expect(fitting.score).toBeGreaterThan(senior.score);
  });

  it("matches role synonyms/abbreviations (TPM ↔ Technical Program Manager)", () => {
    const p = profile({ targetRole: "TPM" });
    const role = (j: Parameters<typeof scoreJobFit>[0]) => scoreJobFit(j, p).factors.find((f) => f.key === "role")!.score;
    expect(role(job({ title: "Technical Program Manager" }))).toBeGreaterThanOrEqual(80);
    // and the reverse direction
    const p2 = profile({ targetRole: "Technical Program Manager" });
    const roleScore = scoreJobFit(job({ title: "Senior TPM" }), p2).factors.find((f) => f.key === "role")!.score;
    expect(roleScore).toBeGreaterThanOrEqual(80);
  });

  it("treats SWE / SDE / Software Developer as the same role family", () => {
    const p = profile({ targetRole: "SWE" });
    const role = (title: string) => scoreJobFit(job({ title }), p).factors.find((f) => f.key === "role")!.score;
    expect(role("Software Engineer")).toBeGreaterThanOrEqual(80);
    expect(role("Software Developer")).toBeGreaterThanOrEqual(80);
  });

  it("returns a low score with no badge when nothing matches", () => {
    const p = profile({ targetRole: "Accountant", skills: ["Excel", "Tax"] });
    const { score } = scoreJobFit(job({ title: "Marine Biologist", description: "Study ocean life." }), p);
    expect(score).toBeLessThan(RECOMMENDED_THRESHOLD);
  });
});

describe("canScoreProfile", () => {
  it("is false for an empty profile", () => {
    expect(canScoreProfile(createEmptyProfile())).toBe(false);
  });

  it("is true once any substantive signal exists", () => {
    expect(canScoreProfile(profile({ skills: ["SQL"] }))).toBe(true);
    expect(canScoreProfile(profile({ targetRole: "PM" }))).toBe(true);
    expect(canScoreProfile(profile({ currentRole: "Analyst" }))).toBe(true);
    expect(canScoreProfile(profile({
      workHistory: [{ id: "1", company: "Acme", role: "Dev", startDate: "", endDate: "", responsibilities: "" }],
    }))).toBe(true);
    expect(canScoreProfile(profile({ targetRoles: [{ id: "r", title: "PM" }] }))).toBe(true);
  });

  it("years of experience alone is not enough to personalize", () => {
    expect(canScoreProfile(profile({ yearsOfExperience: 5 }))).toBe(false);
  });
});

describe("fitLabel", () => {
  it("labels by tier", () => {
    expect(fitLabel(80)).toBe("Recommended");
    expect(fitLabel(50)).toBe("Good match");
    expect(fitLabel(10)).toBe("Possible match");
  });
});

describe("buildDefaultQuery", () => {
  it("prefers an explicit target role", () => {
    const q = buildDefaultQuery(profile({ targetRole: "Data Scientist", currentRole: "Analyst" }));
    expect(q.keyword).toBe("Data Scientist");
  });

  it("falls back to current role, then work history", () => {
    expect(buildDefaultQuery(profile({ currentRole: "Analyst" })).keyword).toBe("Analyst");
    expect(
      buildDefaultQuery(profile({
        workHistory: [{ id: "1", company: "Acme", role: "Designer", startDate: "", endDate: "", responsibilities: "" }],
      })).keyword,
    ).toBe("Designer");
  });

  it("pulls a location from a target role when present", () => {
    const q = buildDefaultQuery(profile({
      targetRoles: [{ id: "r1", title: "PM", location: "Remote" }],
    }));
    expect(q.location).toBe("Remote");
  });

  it("returns empty strings for an empty profile", () => {
    expect(buildDefaultQuery(createEmptyProfile())).toEqual({ keyword: "", location: "" });
  });
});
