import { describe, it, expect } from "vitest";
import {
  PRESENT_LABEL,
  isCurrentRole,
  endDateLabel,
  normalizeWorkEntry,
  normalizeWorkHistory,
} from "./workExperience";

describe("isCurrentRole", () => {
  it("honors the canonical boolean flag", () => {
    expect(isCurrentRole({ current: true })).toBe(true);
    expect(isCurrentRole({ current: false, endDate: "2023" })).toBe(false);
  });

  it("treats legacy 'Present' endDate as current (case-insensitive)", () => {
    expect(isCurrentRole({ endDate: "Present" })).toBe(true);
    expect(isCurrentRole({ endDate: "present" })).toBe(true);
    expect(isCurrentRole({ endDate: "  PRESENT  " })).toBe(true);
  });

  it("is false for a real end date and for empty", () => {
    expect(isCurrentRole({ endDate: "March 2023" })).toBe(false);
    expect(isCurrentRole({})).toBe(false);
  });
});

describe("endDateLabel", () => {
  it("returns 'Present' for current roles", () => {
    expect(endDateLabel({ current: true })).toBe(PRESENT_LABEL);
    expect(endDateLabel({ endDate: "present" })).toBe(PRESENT_LABEL);
  });

  it("returns the date for finished roles", () => {
    expect(endDateLabel({ endDate: "March 2023" })).toBe("March 2023");
    expect(endDateLabel({})).toBe("");
  });
});

describe("normalizeWorkEntry", () => {
  it("clears endDate and sets current=true for ongoing roles", () => {
    expect(normalizeWorkEntry({ endDate: "Present" })).toEqual({
      current: true,
      endDate: "",
    });
  });

  it("keeps a real end date and current=false", () => {
    expect(normalizeWorkEntry({ endDate: "2022" })).toEqual({
      current: false,
      endDate: "2022",
    });
  });

  it("preserves other fields", () => {
    const entry = { id: "1", company: "Acme", role: "Eng", endDate: "Present" };
    expect(normalizeWorkEntry(entry)).toMatchObject({
      id: "1",
      company: "Acme",
      role: "Eng",
      current: true,
      endDate: "",
    });
  });
});

describe("normalizeWorkHistory", () => {
  it("returns [] for undefined", () => {
    expect(normalizeWorkHistory(undefined)).toEqual([]);
  });

  it("normalizes every entry", () => {
    const out = normalizeWorkHistory([{ endDate: "Present" }, { endDate: "2020" }]);
    expect(out).toEqual([
      { current: true, endDate: "" },
      { current: false, endDate: "2020" },
    ]);
  });
});
