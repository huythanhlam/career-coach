import { describe, it, expect, vi } from "vitest";

// The hook module imports the supabase client + auth context at load; stub them
// so we can unit-test the pure `isMemorableInterview` policy in isolation.
vi.mock("@/lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/services/coachMemory", () => ({ recordEvent: vi.fn() }));

import { isMemorableInterview, MIN_MEMORABLE_ANSWERS } from "./useInterviewSessions";
import type { ChatTurn } from "@/types/interviewSession";

const answers = (n: number): ChatTurn[] =>
  Array.from({ length: n }, (_, i) => ({ role: "user" as const, text: `answer ${i}` }));

describe("isMemorableInterview", () => {
  it("is memorable when scored and enough questions were answered", () => {
    expect(
      isMemorableInterview({ overallScore: 72, transcript: answers(MIN_MEMORABLE_ANSWERS) }),
    ).toBe(true);
  });

  it("is NOT memorable when the interview was never scored", () => {
    expect(isMemorableInterview({ overallScore: undefined, transcript: answers(5) })).toBe(false);
  });

  it("is NOT memorable when too few questions were answered (barely started)", () => {
    expect(
      isMemorableInterview({ overallScore: 40, transcript: answers(MIN_MEMORABLE_ANSWERS - 1) }),
    ).toBe(false);
  });

  it("ignores model turns when counting answers", () => {
    const transcript: ChatTurn[] = [
      { role: "model", text: "Q1" },
      { role: "user", text: "A1" },
      { role: "model", text: "Q2" },
    ];
    expect(isMemorableInterview({ overallScore: 60, transcript })).toBe(false);
  });
});
