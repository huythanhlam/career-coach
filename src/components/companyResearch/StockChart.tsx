import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(n);
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
  if (range === "1M" || range === "3M" || range === "6M") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function fmtTooltipDate(value: string, range: StockRange): string {
  const d = parsePointDate(value);
  if (Number.isNaN(d.getTime())) return value;
  if (isIntradayRange(range)) {
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // New company: clear prior data and reset to the default window.
  useEffect(() => {
    setRange(DEFAULT_STOCK_RANGE);
    setHistory(null);
    setDone(false);
  }, [ticker]);

  // Fetch whenever the ticker or selected window changes. The previous chart
  // stays on screen (dimmed) while a window switch is in flight.
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchStockHistory(ticker, range)
      .then((h) => {
        if (active && h) setHistory(h);
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

  // Initial load for this ticker: skeleton inline; in framed mode render nothing
  // yet so an empty titled card never flashes before we know data exists.
  if (!done) {
    return title ? null : <div style={{ height: 220, borderRadius: 14, background: "var(--muted)", border: "1px solid var(--border)", marginBottom: 14 }} aria-hidden />;
  }
  if (!history || history.points.length < 2) return null;

  const { points, currency } = history;
  const first = points[0].close;
  const last = points[points.length - 1].close;
  const delta = last - first;
  const pct = first ? (delta / first) * 100 : 0;
  const up = delta >= 0;
  const color = up ? UP : DOWN;
  const Arrow = up ? TrendingUp : TrendingDown;

  const switcher = (
    <div role="group" aria-label="Chart time range" style={{ display: "inline-flex", gap: 2, padding: 2, borderRadius: 9, background: "var(--muted)", border: "1px solid var(--border)" }}>
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

  const body = (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>{history.ticker}</span>
          <span className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>{fmtPrice(last, currency)}</span>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color }}>
          <Arrow className="w-4 h-4" />
          {up ? "+" : ""}{fmtPrice(delta, currency)} ({up ? "+" : ""}{pct.toFixed(1)}%)
          <span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>· {range}</span>
        </span>
      </div>
      <div style={{ marginBottom: 10 }}>{switcher}</div>
      <div style={{ height: 140, opacity: loading ? 0.45 : 1, transition: "opacity 120ms ease" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`stockfill-${history.ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={(v) => fmtAxisDate(String(v), range)} minTickGap={48} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis domain={["auto", "auto"]} width={52} tickFormatter={(v) => fmtPrice(Number(v), currency)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <RechartsTooltip
              formatter={(v: number) => [fmtPrice(Number(v), currency), "Close"]}
              labelFormatter={(l: string) => fmtTooltipDate(String(l), range)}
              contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            />
            <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2} fill={`url(#stockfill-${history.ticker})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "right", marginTop: 2 }}>
        source{" "}
        <a href="https://finance.yahoo.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>Yahoo Finance</a>
      </div>
    </>
  );

  if (title) {
    return (
      <MentorCard style={{ overflow: "hidden" }}>
        <SectionHeader Icon={LineChart} color="#0EA5E9" title={title} />
        <div style={{ padding: "18px 22px" }}>{body}</div>
      </MentorCard>
    );
  }

  return (
    <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--muted)", padding: "14px 16px 6px", marginBottom: 16 }}>
      {body}
    </div>
  );
}
