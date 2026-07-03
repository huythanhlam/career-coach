import { useEffect, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart, TrendingDown, TrendingUp } from "lucide-react";
import {
  fetchStockHistory,
  isIntradayRange,
  DEFAULT_STOCK_RANGE,
  STOCK_RANGES,
  type StockHistory,
  type StockRange,
} from "@/services/stockService";
import { MentorCard, SectionHeader } from "./shared";

const UP = "#2F6B4F";
const DOWN = "#D97757";

function fmtPrice(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

// Point `date` is a full ISO datetime for intraday windows and a YYYY-MM-DD
// string otherwise; normalize so both parse as UTC.
function parsePointDate(value: string): Date {
  return new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
}

function fmtAxisDate(value: string, range: StockRange): string {
  const d = parsePointDate(value);
  if (Number.isNaN(d.getTime())) return value;
  if (range === "1D") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (range === "1W") return d.toLocaleDateString("en-US", { weekday: "short" });
  if (range === "1M" || range === "3M" || range === "6M")
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function fmtTooltipDate(value: string, range: StockRange): string {
  const d = parsePointDate(value);
  if (Number.isNaN(d.getTime())) return value;
  if (isIntradayRange(range)) {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** What the chart should render, derived purely from fetch state. */
export type ChartView =
  | { kind: "skeleton" }
  | { kind: "hidden" }
  | { kind: "error"; range: StockRange }
  | { kind: "chart"; history: StockHistory; range: StockRange; dimmed: boolean };

/**
 * Decide what to show from the current fetch state. The invariant: a rendered
 * chart's label/percent ALWAYS correspond to the range its data was loaded for —
 * never to a pending or failed selection. When a switch to a new range fails we
 * surface an explicit error rather than silently leaving the previous range's
 * chart (and its percent change) on screen under the new range's label.
 */
export function resolveChartView(args: {
  selectedRange: StockRange;
  loaded: { range: StockRange; history: StockHistory } | null;
  loading: boolean;
  done: boolean;
  error: boolean;
}): ChartView {
  const { selectedRange, loaded, loading, done, error } = args;
  const haveData = !!loaded && loaded.history.points.length >= 2;

  // Nothing loaded yet: skeleton until the first fetch settles, then either the
  // data path below or (if it found nothing) hide entirely.
  if (!haveData) {
    return loading || !done ? { kind: "skeleton" } : { kind: "hidden" };
  }

  // A switch to a new range is in flight: keep the previously loaded chart on
  // screen (dimmed), labelled with the range it actually represents — never the
  // pending selection.
  if (loading) {
    return { kind: "chart", history: loaded!.history, range: loaded!.range, dimmed: true };
  }

  // Settled, and the loaded data is for the range the user has selected.
  if (loaded!.range === selectedRange) {
    return { kind: "chart", history: loaded!.history, range: loaded!.range, dimmed: false };
  }

  // Settled, but the loaded data is for a different range than selected — i.e.
  // the switch to `selectedRange` failed (its fetch returned no data). Surface
  // the failure rather than showing the old range's chart/percent under the new
  // label.
  if (error) return { kind: "error", range: selectedRange };

  // Defensive fallback: show what we have, correctly labelled.
  return { kind: "chart", history: loaded!.history, range: loaded!.range, dimmed: false };
}

/**
 * ~1-year daily price line for a public company. Renders nothing while loading
 * or when no history is available (private companies, unknown tickers, or the
 * service being unreachable) so the host UI degrades gracefully.
 *
 * Two presentations:
 *  - default: a self-contained inset box (embedded inside another card, e.g. the
 *    AI research Financials card).
 *  - `title` set: a full MentorCard with that section title (used standalone in
 *    the deterministic company-profile view).
 */
export function StockChart({ ticker, title }: { ticker: string; title?: string }) {
  const [range, setRange] = useState<StockRange>(DEFAULT_STOCK_RANGE);
  // The most recent successful load, tagged with the range it represents, so the
  // chart/percent are always attributed to the right window.
  const [loaded, setLoaded] = useState<{ range: StockRange; history: StockHistory } | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // New company: clear prior data and reset to the default window.
  useEffect(() => {
    setRange(DEFAULT_STOCK_RANGE);
    setLoaded(null);
    setDone(false);
    setError(false);
  }, [ticker]);

  // Fetch whenever the ticker or selected window changes. The previously loaded
  // chart stays on screen (dimmed) while a window switch is in flight; a switch
  // that returns no data surfaces an error rather than leaving the prior range's
  // chart and percent change on screen under the newly selected range's label.
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchStockHistory(ticker, range)
      .then((h) => {
        if (!active) return;
        if (h && h.points.length >= 2) {
          setLoaded({ range, history: h });
          setError(false);
        } else {
          setError(true);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setDone(true);
        }
      });
    return () => {
      active = false;
    };
  }, [ticker, range]);

  const view = resolveChartView({ selectedRange: range, loaded, loading, done, error });

  // Initial load for this ticker: skeleton inline; in framed mode render nothing
  // yet so an empty titled card never flashes before we know data exists.
  if (view.kind === "skeleton") {
    return title ? null : (
      <div
        style={{
          height: 220,
          borderRadius: 14,
          background: "var(--muted)",
          border: "1px solid var(--border)",
          marginBottom: 14,
        }}
        aria-hidden
      />
    );
  }
  if (view.kind === "hidden") return null;

  const switcher = (
    <div
      role="group"
      aria-label="Chart time range"
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 2,
        borderRadius: 9,
        background: "var(--muted)",
        border: "1px solid var(--border)",
      }}
    >
      {STOCK_RANGES.map((r) => {
        const active = r.key === range;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            aria-pressed={active}
            style={{
              padding: "3px 9px",
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1.3,
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              background: active ? "var(--card)" : "transparent",
              color: active ? "var(--foreground)" : "var(--muted-foreground)",
              boxShadow: active ? "0 1px 2px rgb(0 0 0 / 0.08)" : "none",
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );

  const frame = (content: ReactNode) =>
    title ? (
      <MentorCard style={{ overflow: "hidden" }}>
        <SectionHeader Icon={LineChart} color="#0EA5E9" title={title} />
        <div style={{ padding: "18px 22px" }}>{content}</div>
      </MentorCard>
    ) : (
      <div
        style={{
          borderRadius: 16,
          border: "1px solid var(--border)",
          background: "var(--muted)",
          padding: "14px 16px 6px",
          marginBottom: 16,
        }}
      >
        {content}
      </div>
    );

  if (view.kind === "error") {
    return frame(
      <>
        <div style={{ marginBottom: 10 }}>{switcher}</div>
        <div
          style={{
            height: 140,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            color: "var(--muted-foreground)",
            fontSize: 13,
            padding: "0 12px",
          }}
        >
          Couldn’t load {view.range} price history. Try another range.
        </div>
      </>,
    );
  }

  // A chart for `dataRange` — always the window the data was actually loaded for,
  // so the price, percent change, axis, tooltip and label all agree.
  const { history, range: dataRange, dimmed } = view;
  const { points, currency } = history;
  const first = points[0].close;
  const last = points[points.length - 1].close;
  const delta = last - first;
  const pct = first ? (delta / first) * 100 : 0;
  const up = delta >= 0;
  const color = up ? UP : DOWN;
  const Arrow = up ? TrendingUp : TrendingDown;

  return frame(
    <>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "var(--muted-foreground)",
            }}
          >
            {history.ticker}
          </span>
          <span
            className="font-display"
            style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}
          >
            {fmtPrice(last, currency)}
          </span>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
            fontWeight: 600,
            color,
          }}
        >
          <Arrow className="w-4 h-4" />
          {up ? "+" : ""}
          {fmtPrice(delta, currency)} ({up ? "+" : ""}
          {pct.toFixed(1)}%)
          <span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>· {dataRange}</span>
        </span>
      </div>
      <div style={{ marginBottom: 10 }}>{switcher}</div>
      <div style={{ height: 140, opacity: dimmed ? 0.45 : 1, transition: "opacity 120ms ease" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`stockfill-${history.ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={(v) => fmtAxisDate(String(v), dataRange)}
              minTickGap={48}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={["auto", "auto"]}
              width={52}
              tickFormatter={(v) => fmtPrice(Number(v), currency)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <RechartsTooltip
              formatter={(v: number) => [fmtPrice(Number(v), currency), "Close"]}
              labelFormatter={(l: string) => fmtTooltipDate(String(l), dataRange)}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--foreground)",
                fontSize: 12,
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />
            <Area
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={2}
              fill={`url(#stockfill-${history.ticker})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div
        style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "right", marginTop: 2 }}
      >
        source{" "}
        <a
          href="https://finance.yahoo.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--primary)" }}
        >
          Yahoo Finance
        </a>
      </div>
    </>,
  );
}
