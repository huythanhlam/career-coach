import { describe, it, expect } from "vitest";
import { createEmptyProfile } from "@/types/userProfile";
import type { CareerSurvey, UserProfile } from "@/types/userProfile";
import {
  isSurveyStarted,
  isSurveyComplete,
  isProfileThin,
  getProfileIdentity,
  hasProfileBaseline,
  hasBaselineIdentity,
  diffIdentityForSync,
  buildIdentityPatch,
} from "./careerBaseline";

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  ...createEmptyProfile(),
  ...over,
});

describe("isSurveyStarted", () => {
  it("is false for undefined or empty survey", () => {
    expect(isSurveyStarted(undefined)).toBe(false);
    expect(isSurveyStarted({})).toBe(false);
  });

  it("ignores updatedAt as a signal", () => {
    expect(isSurveyStarted({ updatedAt: "2026-01-01" })).toBe(false);
  });

  it("ignores whitespace-only text answers", () => {
    expect(isSurveyStarted({ currentRole: "   " })).toBe(false);
  });

  it("is true once any real answer is present", () => {
    expect(isSurveyStarted({ currentRole: "PM" })).toBe(true);
    expect(isSurveyStarted({ jobSatisfaction: 3 })).toBe(true);
  });
});

describe("isSurveyComplete", () => {
  it("requires both jobSatisfaction and mobility", () => {
    expect(isSurveyComplete(undefined)).toBe(false);
    expect(isSurveyComplete({ jobSatisfaction: 4 })).toBe(false);
    expect(isSurveyComplete({ mobility: "Open to the right move" })).toBe(false);
    expect(
      isSurveyComplete({ jobSatisfaction: 4, mobility: "Open to the right move" }),
    ).toBe(true);
  });

  it("treats a 0 satisfaction as answered (null-check, not falsy-check)", () => {
    expect(isSurveyComplete({ jobSatisfaction: 0, mobility: "Unsure" })).toBe(
      true,
    );
  });
});

describe("isProfileThin", () => {
  it("is thin with fewer than two baseline signals", () => {
    expect(isProfileThin(profile())).toBe(true);
    expect(isProfileThin(profile({ currentRole: "Engineer" }))).toBe(true); // only 1 signal
  });

  it("is not thin with at least two signals", () => {
    expect(
      isProfileThin(profile({ currentRole: "Engineer", skills: ["a", "b", "c"] })),
    ).toBe(false);
    expect(
      isProfileThin(
        profile({
          skills: ["a", "b", "c"],
          workHistory: [
            { id: "1", company: "X", role: "Eng", startDate: "", endDate: "", responsibilities: "" },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("does not count fewer than three skills as a signal", () => {
    expect(
      isProfileThin(profile({ currentRole: "Engineer", skills: ["a", "b"] })),
    ).toBe(true);
  });
});

describe("getProfileIdentity", () => {
  it("prefers explicit currentRole, falls back to current job role", () => {
    expect(getProfileIdentity(profile({ currentRole: "Staff Eng" })).currentRole).toBe(
      "Staff Eng",
    );
    expect(
      getProfileIdentity(
        profile({
          workHistory: [
            { id: "1", company: "Acme", role: "Senior Eng", startDate: "", endDate: "", responsibilities: "", current: true },
          ],
        }),
      ),
    ).toEqual({ currentRole: "Senior Eng", company: "Acme", yearsExperience: "" });
  });

  it("uses the entry flagged current over the first entry", () => {
    const id = getProfileIdentity(
      profile({
        workHistory: [
          { id: "1", company: "Old", role: "Junior", startDate: "", endDate: "2020", responsibilities: "" },
          { id: "2", company: "New", role: "Senior", startDate: "2020", endDate: "", responsibilities: "", current: true },
        ],
      }),
    );
    expect(id.company).toBe("New");
    expect(id.currentRole).toBe("Senior");
  });

  it("stringifies yearsOfExperience", () => {
    expect(getProfileIdentity(profile({ yearsOfExperience: 7 })).yearsExperience).toBe("7");
  });
});

describe("hasProfileBaseline / hasBaselineIdentity", () => {
  it("hasProfileBaseline true when a role exists anywhere", () => {
    expect(hasProfileBaseline(profile())).toBe(false);
    expect(hasProfileBaseline(profile({ currentRole: "PM" }))).toBe(true);
  });

  it("hasBaselineIdentity falls back to the survey's currentRole", () => {
    expect(hasBaselineIdentity(profile(), undefined)).toBe(false);
    expect(hasBaselineIdentity(profile(), { currentRole: "PM" })).toBe(true);
  });
});

describe("diffIdentityForSync", () => {
  it("returns [] without a survey", () => {
    expect(diffIdentityForSync(profile(), undefined)).toEqual([]);
  });

  it("only includes fields the user actually answered", () => {
    const out = diffIdentityForSync(profile(), { currentRole: "PM" });
    expect(out.map((f) => f.key)).toEqual(["currentRole"]);
  });

  it("marks empty-profile fields as 'new'", () => {
    const [field] = diffIdentityForSync(profile(), { currentRole: "PM" });
    expect(field.status).toBe("new");
    expect(field.surveyValue).toBe("PM");
    expect(field.profileValue).toBe("");
  });

  it("marks case-insensitive matches as 'same'", () => {
    const [field] = diffIdentityForSync(
      profile({ currentRole: "Product Manager" }),
      { currentRole: "product manager" },
    );
    expect(field.status).toBe("same");
  });

  it("marks differing values as 'conflict'", () => {
    const [field] = diffIdentityForSync(
      profile({ currentRole: "Engineer" }),
      { currentRole: "Designer" },
    );
    expect(field.status).toBe("conflict");
  });
});

describe("buildIdentityPatch", () => {
  it("only applies the requested keys", () => {
    const survey: CareerSurvey = { currentRole: "PM", yearsExperience: "5", company: "Acme" };
    const patch = buildIdentityPatch(profile(), survey, ["currentRole"]);
    expect(patch).toEqual({ currentRole: "PM" });
  });

  it("parses yearsExperience to a number, ignoring unparseable input", () => {
    expect(
      buildIdentityPatch(profile(), { yearsExperience: "8 years" }, ["yearsExperience"]),
    ).toEqual({ yearsOfExperience: 8 });
    expect(
      buildIdentityPatch(profile(), { yearsExperience: "many" }, ["yearsExperience"]),
    ).toEqual({});
  });

  it("writes company into a new current work-history entry when none exists", () => {
    const patch = buildIdentityPatch(
      profile(),
      { company: "Acme", currentRole: "PM" },
      ["company", "currentRole"],
    );
    expect(patch.currentRole).toBe("PM");
    expect(patch.workHistory).toHaveLength(1);
    expect(patch.workHistory![0]).toMatchObject({
      company: "Acme",
      role: "PM",
      current: true,
    });
  });

  it("updates the existing current entry's company in place", () => {
    const base = profile({
      workHistory: [
        { id: "1", company: "Old", role: "Eng", startDate: "", endDate: "", responsibilities: "", current: true },
      ],
    });
    const patch = buildIdentityPatch(base, { company: "NewCo" }, ["company"]);
    expect(patch.workHistory).toHaveLength(1);
    expect(patch.workHistory![0]).toMatchObject({ company: "NewCo", role: "Eng" });
  });

  it("ignores blank survey answers", () => {
    expect(buildIdentityPatch(profile(), { currentRole: "   " }, ["currentRole"])).toEqual({});
  });
});
