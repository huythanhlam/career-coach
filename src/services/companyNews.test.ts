import { describe, it, expect } from "vitest";
import { normalizeNewsSection } from "@/services/geminiService";

const FALLBACK = [{ label: "Google News", url: "https://news.google.com" }];

describe("normalizeNewsSection", () => {
  it("sorts items strictly newest → oldest", () => {
    const section = normalizeNewsSection(
      {
        summary: "s",
        items: [
          { headline: "Older", date: "2026-01-10", whyItMatters: "a" },
          { headline: "Newest", date: "2026-06-01", whyItMatters: "b" },
          { headline: "Middle", date: "2026-03-15", whyItMatters: "c" },
        ],
        sources: FALLBACK,
      },
      FALLBACK,
    );
    expect(section.items?.map((i) => i.headline)).toEqual(["Newest", "Middle", "Older"]);
  });

  it("pushes undated items to the bottom and keeps dated order", () => {
    const section = normalizeNewsSection(
      {
        items: [
          { headline: "Undated", date: "not-a-date", whyItMatters: "x" },
          { headline: "Dated", date: "2026-05-01", whyItMatters: "y" },
        ],
        sources: [],
      },
      FALLBACK,
    );
    expect(section.items?.map((i) => i.headline)).toEqual(["Dated", "Undated"]);
    expect(section.items?.[1].date).toBe(""); // invalid date coerced to ""
  });

  it("synthesizes 'headline — date — why' bullets from sorted items", () => {
    const section = normalizeNewsSection(
      { items: [{ headline: "Launch", date: "2026-06-01", whyItMatters: "matters" }] },
      FALLBACK,
    );
    expect(section.bullets).toEqual(["Launch — 2026-06-01 — matters"]);
  });

  it("drops items with no headline", () => {
    const section = normalizeNewsSection(
      {
        items: [
          { headline: "", date: "2026-06-01", whyItMatters: "y" },
          { headline: "Keep", date: "2026-06-02", whyItMatters: "z" },
        ],
      },
      FALLBACK,
    );
    expect(section.items?.map((i) => i.headline)).toEqual(["Keep"]);
  });

  it("falls back to the legacy bullets shape when no items are present", () => {
    const section = normalizeNewsSection(
      { summary: "s", bullets: ["Headline — 2026-01-01 — why"], sources: [] },
      FALLBACK,
    );
    expect(section.items).toBeUndefined();
    expect(section.bullets).toEqual(["Headline — 2026-01-01 — why"]);
    expect(section.sources).toEqual(FALLBACK); // empty sources → fallback
  });
});
