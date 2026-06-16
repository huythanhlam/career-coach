import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { LineChart, TrendingDown, TrendingUp } from "lucide-react";
import { fetchStockHistory, type StockHistory } from "@/services/stockService";
import { MentorCard, SectionHeader } from "./shared";

const UP = "#2F6B4F";
const DOWN = "#D97757";

function fmtPrice(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(n);
}

function fmtAxisDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
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
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    setDone(false);
    setHistory(null);
    fetchStockHistory(ticker)
      .then((h) => active && setHistory(h))
      .finally(() => active && setDone(true));
    return () => {
      active = false;
    };
  }, [ticker]);

  // Loading: show a skeleton inline; in framed mode render nothing yet so an
  // empty titled card never flashes before we know whether data exists.
  if (!done) {
    return title ? null : <div style={{ height: 188, borderRadius: 14, background: "var(--muted)", border: "1px solid var(--border)", marginBottom: 14 }} aria-hidden />;
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
          <span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>· 1Y</span>
        </span>
      </div>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`stockfill-${history.ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={fmtAxisDate} minTickGap={48} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis domain={["auto", "auto"]} width={52} tickFormatter={(v) => fmtPrice(Number(v), currency)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <RechartsTooltip
              formatter={(v: number) => [fmtPrice(Number(v), currency), "Close"]}
              labelFormatter={(l: string) => new Date(`${l}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            />
            <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2} fill={`url(#stockfill-${history.ticker})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "right", marginTop: 2 }}>
        Daily close · source{" "}
        <a href="https://stooq.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>Stooq</a>
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
