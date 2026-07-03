import { describe, it, expect, vi, beforeEach } from "vitest";

// A chainable Supabase query-builder stand-in: every method returns the builder;
// awaiting it resolves to `result`; maybeSingle() resolves to `single`.
function makeQuery(opts: { single?: unknown; result?: unknown } = {}) {
  const single = opts.single ?? { data: null, error: null };
  const result = opts.result ?? { data: null, error: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "order"]) q[m] = vi.fn(() => q);
  q.maybeSingle = vi.fn(() => Promise.resolve(single));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q.then = (resolve: any) => resolve(result);
  return q;
}

const fromMock = vi.fn();
vi.mock("@/lib/supabaseClient", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

const generateBlogDraft = vi.fn();
vi.mock("@/services/geminiService", () => ({
  generateBlogDraft: (...args: unknown[]) => generateBlogDraft(...args),
}));

import {
  createDraftFromTopic,
  savePost,
  setPublished,
  deletePost,
  loadAdminPost,
  schedulePost,
  cancelSchedule,
} from "./blogAdminService";

const draft = {
  slug: "how-to-pivot-careers",
  title: "How to Pivot Careers",
  excerpt: "A guide.",
  category: "career-growth",
  tags: ["pivot"],
  content: "## Intro\n\nBody.",
  sources: [{ label: "A", url: "https://a.com" }],
  heroEmoji: "🔁",
  model: "gemini-2.5-flash",
  readingMinutes: 3,
  editorScore: 88,
  editorRounds: 1,
};

beforeEach(() => {
  fromMock.mockReset();
  generateBlogDraft.mockReset();
});

describe("createDraftFromTopic", () => {
  it("generates, then inserts an unpublished draft row when the slug is free", async () => {
    generateBlogDraft.mockResolvedValue(draft);
    const q = makeQuery({ single: { data: null, error: null } }); // slug not taken
    fromMock.mockReturnValue(q);

    const res = await createDraftFromTopic({
      title: "How to Pivot Careers",
      category: "career-growth",
    });

    expect(res).toEqual({ kind: "created", slug: draft.slug });
    expect(q.insert).toHaveBeenCalledTimes(1);
    const row = q.insert.mock.calls[0][0];
    expect(row).toMatchObject({
      slug: draft.slug,
      title: draft.title,
      hero_emoji: "🔁",
      status: "draft",
      published: false,
      editor_score: 88,
      reading_minutes: 3,
    });
  });

  it("returns 'exists' (and does not insert) when the slug already exists", async () => {
    generateBlogDraft.mockResolvedValue(draft);
    const q = makeQuery({ single: { data: { slug: draft.slug }, error: null } });
    fromMock.mockReturnValue(q);

    const res = await createDraftFromTopic({
      title: "How to Pivot Careers",
      category: "career-growth",
    });

    expect(res).toEqual({ kind: "exists", slug: draft.slug });
    expect(q.insert).not.toHaveBeenCalled();
  });

  it("throws when the insert fails", async () => {
    generateBlogDraft.mockResolvedValue(draft);
    fromMock.mockReturnValue(makeQuery({ result: { data: null, error: { message: "denied" } } }));
    await expect(
      createDraftFromTopic({ title: "How to Pivot Careers", category: "career-growth" }),
    ).rejects.toThrow("denied");
  });
});

describe("savePost", () => {
  it("updates editable fields and recomputes reading time", async () => {
    const q = makeQuery();
    fromMock.mockReturnValue(q);

    await savePost("s", {
      title: "T",
      excerpt: "E",
      category: "resume",
      tags: ["a"],
      content: Array(450).fill("word").join(" "),
      heroEmoji: "📝",
      sources: [],
    });

    const patch = q.update.mock.calls[0][0];
    expect(patch).toMatchObject({
      title: "T",
      category: "resume",
      hero_emoji: "📝",
      reading_minutes: 2,
    });
    expect(q.eq).toHaveBeenCalledWith("slug", "s");
  });
});

describe("setPublished", () => {
  it("publishing flips the flag, sets status, and stamps published_at", async () => {
    const q = makeQuery();
    fromMock.mockReturnValue(q);
    await setPublished("s", true);
    const patch = q.update.mock.calls[0][0];
    expect(patch).toMatchObject({ published: true, status: "published" });
    expect(patch.published_at).toBeTruthy();
  });

  it("unpublishing returns it to review and does not stamp published_at", async () => {
    const q = makeQuery();
    fromMock.mockReturnValue(q);
    await setPublished("s", false);
    const patch = q.update.mock.calls[0][0];
    expect(patch).toMatchObject({ published: false, status: "review" });
    expect(patch.published_at).toBeUndefined();
  });
});

describe("setPublished", () => {
  it("clears scheduled_for when publishing (a scheduled post going live now)", async () => {
    const q = makeQuery();
    fromMock.mockReturnValue(q);
    await setPublished("s", true);
    expect(q.update.mock.calls[0][0]).toMatchObject({
      published: true,
      status: "published",
      scheduled_for: null,
    });
  });
});

describe("schedulePost", () => {
  it("marks the post scheduled with the given time, not yet public", async () => {
    const q = makeQuery();
    fromMock.mockReturnValue(q);
    const when = new Date(Date.now() + 86_400_000).toISOString();
    await schedulePost("s", when);
    expect(q.update.mock.calls[0][0]).toMatchObject({
      status: "scheduled",
      scheduled_for: when,
      published: false,
    });
    expect(q.eq).toHaveBeenCalledWith("slug", "s");
  });
});

describe("cancelSchedule", () => {
  it("clears the schedule and returns the post to review", async () => {
    const q = makeQuery();
    fromMock.mockReturnValue(q);
    await cancelSchedule("s");
    expect(q.update.mock.calls[0][0]).toMatchObject({ status: "review", scheduled_for: null });
  });
});

describe("deletePost / loadAdminPost", () => {
  it("deletes by slug", async () => {
    const q = makeQuery();
    fromMock.mockReturnValue(q);
    await deletePost("s");
    expect(q.delete).toHaveBeenCalledTimes(1);
    expect(q.eq).toHaveBeenCalledWith("slug", "s");
  });

  it("returns null when no row is found", async () => {
    fromMock.mockReturnValue(makeQuery({ single: { data: null, error: null } }));
    expect(await loadAdminPost("missing")).toBeNull();
  });
});
