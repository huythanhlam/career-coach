import { describe, it, expect } from "vitest";
import { createEmptyProfile } from "@/types/userProfile";
import type { UserProfile } from "@/types/userProfile";
import { deriveTargetRoles, MAX_AUTO_TARGET_ROLES } from "./targetRoleDerivation";

describe("deriveTargetRoles", () => {
  it("returns [] for a profile with no targetRole or workHistory", () => {
    expect(deriveTargetRoles(createEmptyProfile())).toEqual([]);
  });

  it("derives a single role from targetRole alone", () => {
    const profile: UserProfile = { ...createEmptyProfile(), targetRole: "Product Manager" };
    const roles = deriveTargetRoles(profile);
    expect(roles).toHaveLength(1);
    expect(roles[0].title).toBe("Product Manager");
    expect(roles[0].id).toBeTruthy();
  });

  it("derives roles from workHistory, current role first", () => {
    const profile: UserProfile = {
      ...createEmptyProfile(),
      workHistory: [
        {
          id: "w1",
          company: "Acme",
          role: "Software Engineer",
          startDate: "2018",
          endDate: "2021",
          responsibilities: "",
        },
        {
          id: "w2",
          company: "Globex",
          role: "Senior Software Engineer",
          startDate: "2021",
          endDate: "",
          responsibilities: "",
          current: true,
        },
      ],
    };
    const roles = deriveTargetRoles(profile);
    expect(roles.map((r) => r.title)).toEqual(["Senior Software Engineer", "Software Engineer"]);
  });

  it("dedupes targetRole against an overlapping work-history title (case/whitespace insensitive)", () => {
    const profile: UserProfile = {
      ...createEmptyProfile(),
      targetRole: "  Product Manager ",
      workHistory: [
        {
          id: "w1",
          company: "Acme",
          role: "product manager",
          startDate: "2020",
          endDate: "",
          responsibilities: "",
          current: true,
        },
      ],
    };
    const roles = deriveTargetRoles(profile);
    expect(roles).toHaveLength(1);
    expect(roles[0].title).toBe("Product Manager");
  });

  it("caps at MAX_AUTO_TARGET_ROLES", () => {
    const profile: UserProfile = {
      ...createEmptyProfile(),
      workHistory: Array.from({ length: 6 }, (_, i) => ({
        id: `w${i}`,
        company: "Acme",
        role: `Role ${i}`,
        startDate: "2020",
        endDate: "",
        responsibilities: "",
      })),
    };
    expect(deriveTargetRoles(profile)).toHaveLength(MAX_AUTO_TARGET_ROLES);
  });

  it("skips work-history entries with a blank role", () => {
    const profile: UserProfile = {
      ...createEmptyProfile(),
      workHistory: [
        { id: "w1", company: "Acme", role: "  ", startDate: "2020", endDate: "", responsibilities: "" },
      ],
    };
    expect(deriveTargetRoles(profile)).toEqual([]);
  });
});
