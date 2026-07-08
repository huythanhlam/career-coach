import { describe, it, expect, vi, beforeEach } from "vitest";

// Chainable Supabase query-builder stand-in: every method returns the builder;
// awaiting it resolves to `result`.
function makeQuery(result: unknown = { data: null, error: null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {};
  for (const m of ["select", "insert", "delete", "eq", "order", "limit"]) q[m] = vi.fn(() => q);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q.then = (resolve: any) => resolve(result);
  return q;
}

const fromMock = vi.fn();
const getUserMock = vi.fn();
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    auth: { getUser: () => getUserMock() },
  },
}));

const runWorkflow = vi.fn();
vi.mock("@/ai/client", () => ({
  runWorkflow: (...args: unknown[]) => runWorkflow(...args),
}));

import { recordEvent, listMemories, topMemories, deleteMemory } from "./coachMemory";

const signedIn = { data: { user: { id: "user-1" } } };

beforeEach(() => {
  fromMock.mockReset();
  getUserMock.mockReset();
  runWorkflow.mockReset();
  getUserMock.mockResolvedValue(signedIn);
});

describe("recordEvent", () => {
  it("runs the memory-writer and inserts the extracted rows", async () => {
    runWorkflow.mockResolvedValue({
      status: "ok",
      data: {
        memories: [
          { kind: "episode", content: "Scored 62 on a mock interview.", salience: 4 },
          { kind: "preference", content: "Prefers concise feedback.", salience: 2 },
        ],
      },
    });
    const q = makeQuery({ error: null });
    fromMock.mockReturnValue(q);

    await recordEvent("mock_interview", "62/100, weak on Result");

    expect(fromMock).toHaveBeenCalledWith("user_memories");
    expect(q.insert).toHaveBeenCalledTimes(1);
    const rows = q.insert.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      user_id: "user-1",
      kind: "episode",
      source_feature: "mock_interview",
      salience: 4,
    });
  });

  it("does nothing when the user is signed out", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await recordEvent("goal_planner", "saved a plan");
    expect(runWorkflow).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("does not insert when the workflow errors", async () => {
    runWorkflow.mockResolvedValue({ status: "error", error: "boom" });
    await recordEvent("autopilot", "package generated");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("does not insert when nothing worth remembering was extracted", async () => {
    runWorkflow.mockResolvedValue({ status: "ok", data: { memories: [] } });
    await recordEvent("autopilot", "package generated");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("is fail-soft: a thrown error never propagates", async () => {
    runWorkflow.mockRejectedValue(new Error("gateway down"));
    await expect(recordEvent("mock_interview", "x")).resolves.toBeUndefined();
  });
});

describe("listMemories / topMemories", () => {
  it("maps rows to UserMemory and orders by salience then recency", async () => {
    const q = makeQuery({
      data: [
        {
          id: "m1",
          kind: "fact",
          content: "Targeting Staff SRE roles.",
          source_feature: "goal_planner",
          salience: 5,
          created_at: "2026-07-06T00:00:00Z",
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(q);

    const out = await listMemories();

    expect(out).toEqual([
      {
        id: "m1",
        kind: "fact",
        content: "Targeting Staff SRE roles.",
        sourceFeature: "goal_planner",
        salience: 5,
        createdAt: "2026-07-06T00:00:00Z",
      },
    ]);
    expect(q.order).toHaveBeenCalledWith("salience", { ascending: false });
    expect(q.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("topMemories applies a limit and returns [] on error", async () => {
    const q = makeQuery({ data: null, error: { message: "nope" } });
    fromMock.mockReturnValue(q);
    const out = await topMemories(3);
    expect(q.limit).toHaveBeenCalledWith(3);
    expect(out).toEqual([]);
  });
});

describe("deleteMemory", () => {
  it("deletes by id", async () => {
    const q = makeQuery({ error: null });
    fromMock.mockReturnValue(q);
    await deleteMemory("m1");
    expect(fromMock).toHaveBeenCalledWith("user_memories");
    expect(q.delete).toHaveBeenCalledTimes(1);
    expect(q.eq).toHaveBeenCalledWith("id", "m1");
  });
});
