import { describe, it, expect } from "vitest";
import { resumeAnalysisCacheKey } from "./resumeAnalysisCache";

describe("resumeAnalysisCacheKey", () => {
  it("is a stable SHA-256 hex digest for identical inputs", async () => {
    const a = await resumeAnalysisCacheKey("my resume", "target job");
    const b = await resumeAnalysisCacheKey("my resume", "target job");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the resume text changes", async () => {
    const a = await resumeAnalysisCacheKey("resume v1", "job");
    const b = await resumeAnalysisCacheKey("resume v2", "job");
    expect(a).not.toBe(b);
  });

  it("changes when the target job changes", async () => {
    const a = await resumeAnalysisCacheKey("resume", "job A");
    const b = await resumeAnalysisCacheKey("resume", "job B");
    expect(a).not.toBe(b);
  });

  it("does not collide when the split between the two fields shifts", async () => {
    // Without a real separator, ("a","bc") and ("ab","c") would concatenate to
    // the same bytes; the NUL separator keeps them distinct.
    const a = await resumeAnalysisCacheKey("a", "bc");
    const b = await resumeAnalysisCacheKey("ab", "c");
    expect(a).not.toBe(b);
  });
});
