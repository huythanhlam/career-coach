import { describe, it, expect, beforeEach } from "vitest";
import {
  defaultViewForAccount,
  MODE_META,
  PENDING_ACCOUNT_TYPE_KEY,
  readPendingAccountType,
  setPendingAccountType,
  clearPendingAccountType,
} from "./accountMode";

describe("defaultViewForAccount", () => {
  it("sends employers to the studio", () => {
    expect(defaultViewForAccount("employer")).toBe("employer_studio");
  });
  it("sends seekers (and unknown/undefined) to the dashboard", () => {
    expect(defaultViewForAccount("seeker")).toBe("dashboard");
    expect(defaultViewForAccount(undefined)).toBe("dashboard");
  });
});

describe("MODE_META", () => {
  it("has a label and modeLabel for each account type", () => {
    expect(MODE_META.seeker.label).toBe("Job Seeker");
    expect(MODE_META.employer.modeLabel).toBe("Employer mode");
  });
});

describe("pending account type", () => {
  // jsdom-free env: provide a minimal in-memory localStorage.
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: () => null,
      length: 0,
    } as Storage;
  });

  it("returns null when nothing is stored", () => {
    expect(readPendingAccountType()).toBeNull();
  });

  it("round-trips a stored employer intent and clears it", () => {
    setPendingAccountType("employer");
    expect(localStorage.getItem(PENDING_ACCOUNT_TYPE_KEY)).toBe("employer");
    expect(readPendingAccountType()).toBe("employer");
    clearPendingAccountType();
    expect(readPendingAccountType()).toBeNull();
  });

  it("ignores an invalid stored value", () => {
    localStorage.setItem(PENDING_ACCOUNT_TYPE_KEY, "garbage");
    expect(readPendingAccountType()).toBeNull();
  });
});
