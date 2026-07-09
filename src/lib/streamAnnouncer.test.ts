import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStreamAnnouncer } from "@/lib/streamAnnouncer";

describe("createStreamAnnouncer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not announce before the pause threshold", () => {
    const onAnnounce = vi.fn();
    const announcer = createStreamAnnouncer(onAnnounce, 1200);
    announcer.update("Hello", false);
    vi.advanceTimersByTime(1000);
    expect(onAnnounce).not.toHaveBeenCalled();
  });

  it("announces once the pause threshold elapses with no new update", () => {
    const onAnnounce = vi.fn();
    const announcer = createStreamAnnouncer(onAnnounce, 1200);
    announcer.update("Hello", false);
    vi.advanceTimersByTime(1200);
    expect(onAnnounce).toHaveBeenCalledWith("Hello");
    expect(onAnnounce).toHaveBeenCalledTimes(1);
  });

  it("resets the pause timer on every new update — no announcement while tokens keep arriving", () => {
    const onAnnounce = vi.fn();
    const announcer = createStreamAnnouncer(onAnnounce, 1200);
    announcer.update("Hel", false);
    vi.advanceTimersByTime(800);
    announcer.update("Hello", false);
    vi.advanceTimersByTime(800);
    expect(onAnnounce).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(onAnnounce).toHaveBeenCalledWith("Hello");
    expect(onAnnounce).toHaveBeenCalledTimes(1);
  });

  it("flushes immediately on stream-settle even if the pause threshold wasn't reached", () => {
    const onAnnounce = vi.fn();
    const announcer = createStreamAnnouncer(onAnnounce, 1200);
    announcer.update("Hi", false);
    vi.advanceTimersByTime(100);
    announcer.update("Hi there.", true);
    expect(onAnnounce).toHaveBeenCalledWith("Hi there.");
    expect(onAnnounce).toHaveBeenCalledTimes(1);
  });

  it("dispose cancels a pending timer", () => {
    const onAnnounce = vi.fn();
    const announcer = createStreamAnnouncer(onAnnounce, 1200);
    announcer.update("Hello", false);
    announcer.dispose();
    vi.advanceTimersByTime(2000);
    expect(onAnnounce).not.toHaveBeenCalled();
  });
});
