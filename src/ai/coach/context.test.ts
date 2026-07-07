import { describe, it, expect } from "vitest";
import { assembleCoachContext } from "@/ai/coach/context";
import type { UserProfile } from "@/types/userProfile";
import type { JobPosting } from "@/types/jobPosting";
import type { UserMemory } from "@/services/coachMemory";

const profile = {
  fullName: "Jane Doe",
  currentRole: "SRE",
  targetRole: "Staff SRE",
  skills: ["Go", "Kubernetes"],
  resumeScore: 82,
  linkedinScore: 75,
} as unknown as UserProfile;

const emptyProfile = {} as unknown as UserProfile;

const postings = [
  { id: "p1", title: "Staff SRE", company: "Stripe", status: "applied" },
] as unknown as JobPosting[];

const memories: UserMemory[] = [
  {
    id: "m1",
    kind: "episode",
    content: "Scored 62/100 on a behavioral interview, weak on Result.",
    sourceFeature: "mock_interview",
    salience: 5,
    createdAt: "2026-07-06T00:00:00Z",
  },
  {
    id: "m2",
    kind: "preference",
    content: "Prefers concise, direct feedback.",
    sourceFeature: "goal_planner",
    salience: 2,
    createdAt: "2026-07-05T00:00:00Z",
  },
];

const SYSTEM = "You are The Coach.";

describe("assembleCoachContext", () => {
  it("includes the baseline, pipeline, scores, and memories", () => {
    const out = assembleCoachContext({ systemInstruction: SYSTEM, profile, postings, memories });
    expect(out).toContain(SYSTEM);
    expect(out).toContain("Stated Target Role: Staff SRE");
    expect(out).toContain("Job pipeline:");
    expect(out).toContain("Latest resume score: 82/100");
    expect(out).toContain("Latest LinkedIn score: 75/100");
    expect(out).toContain("What you remember about this user from past sessions:");
    expect(out).toContain("(episode) Scored 62/100 on a behavioral interview");
    expect(out).toContain("(preference) Prefers concise, direct feedback.");
  });

  it("renders memories in the order given (caller supplies salience order)", () => {
    const out = assembleCoachContext({ systemInstruction: SYSTEM, profile, postings, memories });
    expect(out.indexOf("Scored 62/100")).toBeLessThan(out.indexOf("Prefers concise"));
  });

  it("omits the memory block when there are no memories", () => {
    const out = assembleCoachContext({
      systemInstruction: SYSTEM,
      profile,
      postings,
      memories: [],
    });
    expect(out).not.toContain("What you remember about this user");
    expect(out).toContain("Latest resume score: 82/100");
  });

  it("returns the bare system instruction when there is no context at all", () => {
    const out = assembleCoachContext({
      systemInstruction: SYSTEM,
      profile: emptyProfile,
      postings: [],
      memories: [],
    });
    expect(out).toBe(SYSTEM);
  });
});
