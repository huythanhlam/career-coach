import { describe, it, expect } from "vitest";
import {
  timelineAt,
  totalDurationMs,
  jumpOffsetMs,
  typewriter,
  type TimelineScene,
} from "./demoTimeline";

const SCENES: TimelineScene[] = [{ durationMs: 1000 }, { durationMs: 2000 }, { durationMs: 1000 }];
// total = 4000

describe("totalDurationMs", () => {
  it("sums durations", () => {
    expect(totalDurationMs(SCENES)).toBe(4000);
  });
  it("is 0 for an empty list", () => {
    expect(totalDurationMs([])).toBe(0);
  });
});

describe("timelineAt", () => {
  it("starts at the first scene, zero progress", () => {
    expect(timelineAt(SCENES, 0)).toEqual({
      sceneIndex: 0,
      sceneProgress: 0,
      totalProgress: 0,
    });
  });

  it("reports mid-scene progress", () => {
    const s = timelineAt(SCENES, 500);
    expect(s.sceneIndex).toBe(0);
    expect(s.sceneProgress).toBeCloseTo(0.5);
    expect(s.totalProgress).toBeCloseTo(500 / 4000);
  });

  it("hands off to the next scene exactly at the boundary", () => {
    const s = timelineAt(SCENES, 1000);
    expect(s.sceneIndex).toBe(1);
    expect(s.sceneProgress).toBeCloseTo(0);
  });

  it("tracks progress within a later scene", () => {
    const s = timelineAt(SCENES, 2000); // 1000 into the 2000ms scene 1
    expect(s.sceneIndex).toBe(1);
    expect(s.sceneProgress).toBeCloseTo(0.5);
  });

  it("wraps around past the total duration", () => {
    // 4500 % 4000 = 500 → same as t=500
    expect(timelineAt(SCENES, 4500)).toEqual(timelineAt(SCENES, 500));
  });

  it("wraps negative elapsed values into range", () => {
    // -500 → 3500 → 500 into the final 1000ms scene
    const s = timelineAt(SCENES, -500);
    expect(s.sceneIndex).toBe(2);
    expect(s.sceneProgress).toBeCloseTo(0.5);
  });

  it("is safe for an empty scene list", () => {
    expect(timelineAt([], 123)).toEqual({
      sceneIndex: 0,
      sceneProgress: 0,
      totalProgress: 0,
    });
  });
});

describe("jumpOffsetMs", () => {
  it("returns the cumulative offset of a scene start", () => {
    expect(jumpOffsetMs(SCENES, 0)).toBe(0);
    expect(jumpOffsetMs(SCENES, 1)).toBe(1000);
    expect(jumpOffsetMs(SCENES, 2)).toBe(3000);
  });

  it("clamps out-of-range indices", () => {
    expect(jumpOffsetMs(SCENES, -5)).toBe(0);
    expect(jumpOffsetMs(SCENES, 99)).toBe(3000);
  });

  it("a jump offset lands timelineAt on that scene's first frame", () => {
    const s = timelineAt(SCENES, jumpOffsetMs(SCENES, 2));
    expect(s.sceneIndex).toBe(2);
    expect(s.sceneProgress).toBeCloseTo(0);
  });
});

describe("typewriter", () => {
  it("is empty at zero progress", () => {
    expect(typewriter("hello world", 0)).toBe("");
  });
  it("is the full string at full progress", () => {
    expect(typewriter("hello world", 1)).toBe("hello world");
  });
  it("returns the full string when progress is forced past 1 (reduced motion)", () => {
    expect(typewriter("hello", 5)).toBe("hello");
  });
  it("reveals a prefix mid-progress", () => {
    expect(typewriter("hello", 0.6)).toBe("hel"); // round(0.6*5)=3
  });
  it("never returns negative-length output", () => {
    expect(typewriter("hello", -1)).toBe("");
  });
});
