// Pure playback math for the hero ProductDemo. Kept framework-free so it can be
// unit-tested in the repo's node vitest environment (no jsdom/RAF needed). The
// React component feeds it an elapsed-ms clock from requestAnimationFrame and
// renders whatever scene/progress this returns.

export interface TimelineScene {
  /** How long this scene plays before advancing, in milliseconds. */
  durationMs: number;
}

export interface TimelineState {
  /** Index of the currently-playing scene. */
  sceneIndex: number;
  /** Progress through the current scene, 0..1. */
  sceneProgress: number;
  /** Progress through the whole loop, 0..1. */
  totalProgress: number;
}

/** Sum of every scene's duration. Returns 0 for an empty list. */
export function totalDurationMs(scenes: readonly TimelineScene[]): number {
  return scenes.reduce((sum, s) => sum + s.durationMs, 0);
}

/**
 * Elapsed-ms offset at which a given scene starts. Used to re-base the clock
 * when a viewer clicks a chapter dot to jump to a scene.
 */
export function jumpOffsetMs(scenes: readonly TimelineScene[], index: number): number {
  let offset = 0;
  const target = Math.max(0, Math.min(index, scenes.length - 1));
  for (let i = 0; i < target; i++) offset += scenes[i].durationMs;
  return offset;
}

/**
 * Resolve an elapsed-ms clock into the active scene and progress values. The
 * timeline loops, so any elapsed value (including negatives, which can arise
 * from a re-based clock) maps into range.
 */
export function timelineAt(scenes: readonly TimelineScene[], elapsedMs: number): TimelineState {
  const total = totalDurationMs(scenes);
  if (scenes.length === 0 || total <= 0) {
    return { sceneIndex: 0, sceneProgress: 0, totalProgress: 0 };
  }

  // Wrap into [0, total) even for negative input.
  const looped = ((elapsedMs % total) + total) % total;

  let acc = 0;
  for (let i = 0; i < scenes.length; i++) {
    const dur = scenes[i].durationMs;
    if (looped < acc + dur) {
      const sceneProgress = dur > 0 ? (looped - acc) / dur : 0;
      return {
        sceneIndex: i,
        sceneProgress: clamp01(sceneProgress),
        totalProgress: looped / total,
      };
    }
    acc += dur;
  }

  // Floating-point edge: looped landed exactly on total. Show the last scene's end.
  return {
    sceneIndex: scenes.length - 1,
    sceneProgress: 1,
    totalProgress: 1,
  };
}

/**
 * The visibly-typed substring of `full` for a 0..1 progress value. At 0 it is
 * empty, at 1 it is the whole string — so forcing progress to 1 (reduced motion)
 * yields complete, readable text with no animation.
 */
export function typewriter(full: string, progress: number): string {
  const count = Math.round(clamp01(progress) * full.length);
  return full.slice(0, count);
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
