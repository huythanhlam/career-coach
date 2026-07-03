import { describe, it, expect } from "vitest";
import { describeDbError } from "./supabaseError";

describe("describeDbError", () => {
  it("explains a missing table (Postgres 42P01)", () => {
    const msg = describeDbError({
      code: "42P01",
      message: 'relation "employer_company_profiles" does not exist',
    });
    expect(msg).toMatch(/migrations/i);
  });

  it("explains a PostgREST schema-cache miss", () => {
    const msg = describeDbError({
      code: "PGRST205",
      message: "Could not find the table 'public.employer_job_listings' in the schema cache",
    });
    expect(msg).toMatch(/migrations/i);
  });

  it("explains an RLS denial", () => {
    const msg = describeDbError({
      code: "42501",
      message: "new row violates row-level security policy",
    });
    expect(msg).toMatch(/permission|row-level security/i);
  });

  it("explains an expired session", () => {
    const msg = describeDbError({ message: "JWT expired" });
    expect(msg).toMatch(/session/i);
  });

  it("falls back to the raw message", () => {
    expect(describeDbError({ message: "boom" })).toBe("boom");
  });

  it("handles null/empty errors gracefully", () => {
    expect(describeDbError(null)).toBeTruthy();
    expect(describeDbError({})).toBeTruthy();
  });
});
