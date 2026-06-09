import { describe, it, expect } from "vitest";
import { createEmptyProfile } from "@/types/userProfile";
import type { UserProfile } from "@/types/userProfile";
import { rowToProfile, profileToRow } from "./profileMapper";

describe("profileToRow", () => {
  it("maps camelCase fields to snake_case columns", () => {
    const p: UserProfile = {
      ...createEmptyProfile(),
      fullName: "Ada Lovelace",
      currentRole: "Engineer",
      yearsOfExperience: 9,
      skills: ["a", "b"],
    };
    const row = profileToRow(p, "user-123");
    expect(row.id).toBe("user-123");
    expect(row.full_name).toBe("Ada Lovelace");
    expect(row.current_role).toBe("Engineer");
    expect(row.years_of_experience).toBe(9);
    expect(row.skills).toEqual(["a", "b"]);
  });

  it("coerces undefined optionals to null for the DB", () => {
    const row = profileToRow(createEmptyProfile(), "u1");
    expect(row.phone).toBeNull();
    expect(row.current_role).toBeNull();
    expect(row.years_of_experience).toBeNull();
  });

  it("always stamps a fresh updated_at", () => {
    const row = profileToRow(createEmptyProfile(), "u1");
    expect(typeof row.updated_at).toBe("string");
    expect(() => new Date(row.updated_at as string).toISOString()).not.toThrow();
  });

  it("strips transient fields from saved cover letters", () => {
    const p: UserProfile = {
      ...createEmptyProfile(),
      savedCoverLetters: [
        {
          id: "cl1",
          name: "CL",
          storagePath: "path",
          text: "SHOULD NOT PERSIST",
          jobTitle: "PM",
          company: "Acme",
          createdAt: "2026-01-01",
        },
      ],
    };
    const row = profileToRow(p, "u1") as { saved_cover_letters: any[] };
    expect(row.saved_cover_letters[0]).not.toHaveProperty("text");
    expect(row.saved_cover_letters[0]).toMatchObject({ id: "cl1", company: "Acme" });
  });
});

describe("rowToProfile", () => {
  it("maps snake_case columns back to camelCase", () => {
    const profile = rowToProfile({
      full_name: "Ada Lovelace",
      current_role: "Engineer",
      years_of_experience: 9,
      skills: ["a", "b"],
      onboarding_complete: true,
    });
    expect(profile.fullName).toBe("Ada Lovelace");
    expect(profile.currentRole).toBe("Engineer");
    expect(profile.yearsOfExperience).toBe(9);
    expect(profile.skills).toEqual(["a", "b"]);
    expect(profile.onboardingComplete).toBe(true);
  });

  it("supplies safe defaults for missing columns", () => {
    const profile = rowToProfile({});
    expect(profile.fullName).toBe("");
    expect(profile.workHistory).toEqual([]);
    expect(profile.education).toEqual([]);
    expect(profile.skills).toEqual([]);
    expect(profile.onboardingComplete).toBe(false);
    expect(typeof profile.createdAt).toBe("string");
  });

  it("normalizes legacy 'Present' work history on read", () => {
    const profile = rowToProfile({
      work_history: [
        { id: "1", company: "Acme", role: "Eng", startDate: "2020", endDate: "Present", responsibilities: "" },
      ],
    });
    expect(profile.workHistory[0]).toMatchObject({ current: true, endDate: "" });
  });
});

describe("round-trip", () => {
  // Catches the classic bug: a field added to UserProfile but wired into only
  // one of the two mappers, silently dropped on save/load.
  it("preserves core fields through profileToRow → rowToProfile", () => {
    const original: UserProfile = {
      ...createEmptyProfile(),
      fullName: "Grace Hopper",
      preferredName: "Grace",
      email: "grace@example.com",
      currentRole: "Rear Admiral",
      targetRole: "Legend",
      yearsOfExperience: 40,
      summary: "Compiler pioneer",
      skills: ["COBOL", "leadership"],
      workHistory: [
        { id: "w1", company: "US Navy", role: "Officer", startDate: "1943", endDate: "", responsibilities: "", current: true },
      ],
      onboardingComplete: true,
    };
    const restored = rowToProfile(profileToRow(original, "u1"));
    expect(restored.fullName).toBe(original.fullName);
    expect(restored.preferredName).toBe(original.preferredName);
    expect(restored.email).toBe(original.email);
    expect(restored.currentRole).toBe(original.currentRole);
    expect(restored.targetRole).toBe(original.targetRole);
    expect(restored.yearsOfExperience).toBe(original.yearsOfExperience);
    expect(restored.summary).toBe(original.summary);
    expect(restored.skills).toEqual(original.skills);
    expect(restored.workHistory[0]).toMatchObject({
      company: "US Navy",
      role: "Officer",
      current: true,
    });
    expect(restored.onboardingComplete).toBe(true);
  });
});
