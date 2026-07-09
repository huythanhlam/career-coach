import { describe, it, expect, vi, beforeEach } from "vitest";

// Chainable Supabase query-builder stand-in: every method returns the builder;
// awaiting it resolves to `result`.
function makeQuery(result: unknown = { data: null, error: null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {};
  for (const m of ["select", "update", "eq", "order"]) q[m] = vi.fn(() => q);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q.then = (resolve: any) => resolve(result);
  return q;
}

const fromMock = vi.fn();
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { listActiveNudges, dismissNudge } from "./coachNudges";

beforeEach(() => {
  fromMock.mockReset();
});

describe("listActiveNudges", () => {
  it("selects active nudges ordered by recency and maps rows", async () => {
    const q = makeQuery({
      data: [
        {
          id: "n1",
          kind: "follow_up",
          subject_id: "posting-1",
          title: "Follow up with Stripe?",
          body: "Your application to Stripe has been quiet for 12 days — draft a follow-up?",
          cta_view: "dashboard",
          created_at: "2026-07-06T00:00:00Z",
        },
      ],
      error: null,
    });
    fromMock.mockReturnValue(q);

    const out = await listActiveNudges();

    expect(fromMock).toHaveBeenCalledWith("coach_nudges");
    expect(q.eq).toHaveBeenCalledWith("status", "active");
    expect(q.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(out).toEqual([
      {
        id: "n1",
        kind: "follow_up",
        subjectId: "posting-1",
        title: "Follow up with Stripe?",
        body: "Your application to Stripe has been quiet for 12 days — draft a follow-up?",
        ctaView: "dashboard",
        createdAt: "2026-07-06T00:00:00Z",
      },
    ]);
  });

  it("returns [] on error instead of throwing", async () => {
    const q = makeQuery({ data: null, error: { message: "nope" } });
    fromMock.mockReturnValue(q);
    const out = await listActiveNudges();
    expect(out).toEqual([]);
  });
});

describe("dismissNudge", () => {
  it("updates status to dismissed by id", async () => {
    const q = makeQuery({ error: null });
    fromMock.mockReturnValue(q);
    await dismissNudge("n1");
    expect(fromMock).toHaveBeenCalledWith("coach_nudges");
    expect(q.update).toHaveBeenCalledWith({ status: "dismissed" });
    expect(q.eq).toHaveBeenCalledWith("id", "n1");
  });

  it("is fail-soft: an error is logged, not thrown", async () => {
    const q = makeQuery({ error: { message: "boom" } });
    fromMock.mockReturnValue(q);
    await expect(dismissNudge("n1")).resolves.toBeUndefined();
  });
});
