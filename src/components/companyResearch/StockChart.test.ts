import { describe, it, expect } from "vitest";
import { resolveChartView } from "./StockChart";
import type { StockHistory } from "@/services/stockService";

const hist = (close = 120): StockHistory => ({
  ticker: "AAPL",
  currency: "USD",
  points: [
    { date: "2025-01-01", close: 100 },
    { date: "2025-06-01", close },
  ],
});

describe("resolveChartView (time-range switching)", () => {
  it("shows a skeleton during the initial load", () => {
    const view = resolveChartView({
      selectedRange: "1Y",
      loaded: null,
      loading: true,
      done: false,
      error: false,
    });
    expect(view.kind).toBe("skeleton");
  });

  it("hides the chart when the initial load finds no data", () => {
    const view = resolveChartView({
      selectedRange: "1Y",
      loaded: null,
      loading: false,
      done: true,
      error: true,
    });
    expect(view.kind).toBe("hidden");
  });

  it("shows the loaded data, labelled with the range it represents, when ready", () => {
    const loaded = { range: "1Y" as const, history: hist() };
    const view = resolveChartView({
      selectedRange: "1Y",
      loaded,
      loading: false,
      done: true,
      error: false,
    });
    expect(view).toMatchObject({ kind: "chart", range: "1Y", dimmed: false });
  });

  it("keeps the prior chart dimmed while switching, labelled with the OLD range (not the pending one)", () => {
    const loaded = { range: "1Y" as const, history: hist() };
    // user clicked 1M; fetch in flight
    const view = resolveChartView({
      selectedRange: "1M",
      loaded,
      loading: true,
      done: true,
      error: false,
    });
    expect(view).toMatchObject({ kind: "chart", range: "1Y", dimmed: true });
  });

  // The core regression: a range switch whose fetch failed must NEVER render the
  // previous range's chart/percent under the newly-selected range's label.
  it("does not show stale data mislabelled when a range switch fails", () => {
    const loaded = { range: "1Y" as const, history: hist() };
    // user clicked 1M; fetch failed (Yahoo rate-limit / transient)
    const view = resolveChartView({
      selectedRange: "1M",
      loaded,
      loading: false,
      done: true,
      error: true,
    });
    if (view.kind === "chart") {
      // If a chart is shown at all, its label MUST match the data — never "1M" over 1Y data.
      expect(view.range).toBe("1Y");
      throw new Error("expected an explicit error state, not a chart, for a failed range switch");
    }
    expect(view.kind).toBe("error");
    expect(view).toMatchObject({ range: "1M" });
  });

  it("flips to the new range's data once a switch succeeds", () => {
    const loaded = { range: "1M" as const, history: hist(90) };
    const view = resolveChartView({
      selectedRange: "1M",
      loaded,
      loading: false,
      done: true,
      error: false,
    });
    expect(view).toMatchObject({ kind: "chart", range: "1M", dimmed: false });
  });
});
