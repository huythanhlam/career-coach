import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Building2,
  ExternalLink,
  MapPin,
  Calculator,
  RefreshCw,
  Trophy,
  ShieldCheck,
  Info,
  Target,
  Layers,
} from "lucide-react";

export interface SourceRef {
  label: string;
  url: string;
  asOf?: string;
}

export interface LocationCompData {
  locationName: string;
  currency?: string;
  confidence?: "high" | "medium" | "low";
  dataAsOf?: string;
  /** Combined federal + state + local effective tax rate on median base, as a decimal (e.g. 0.30). */
  effectiveTaxRate?: number;
  /** Internal: ISO timestamp the BLS bands were last fetched (for the BLS-specific TTL). */
  blsCachedAt?: string;
  /** Typical compensation by seniority level for this role/market. */
  levelLadder?: { level: string; baseMedian: number; totalMedian: number }[];
  salaryBands: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
    source?: SourceRef;
  };
  salaryHistogram?: {
    bucket: string;
    percentage: number;
  }[];
  salaryHistogramSource?: SourceRef;
  totalCompensation?: {
    baseMedian: number;
    bonusMedian: number;
    equityMedian: number;
    signOnMedian: number;
    totalEstimated: number;
    notes: string;
    source?: SourceRef;
  };
  equity: string;
  yoyTrend: {
    year: string;
    compensation: number;
  }[];
  yoyTrendSource?: SourceRef;
  costOfLiving: {
    housing: number;
    utilities: number;
    gas: number;
    groceries: number;
    dining?: number;
    transportation?: number;
    healthcare?: number;
    effectiveDisposableIncome: number;
    source?: SourceRef;
  };
}

export interface MarketCompData {
  summary: string;
  locations: LocationCompData[];
  sources: string[];
}

interface MarketCompensationVizProps {
  data: MarketCompData;
  /** ISO timestamp the data was cached, if served from cache. */
  cachedAt?: string;
  /** Force a fresh fetch, bypassing the cache. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** Navigate to another tool (e.g. the Salary Negotiation workflow). */
  onNavigate?: (view: string) => void;
}

const PALETTE = ["#D97757", "#2F6B4F"];

const makeFmt =
  (currency = "USD") =>
  (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(val);

const totalCol = (c: LocationCompData["costOfLiving"]) =>
  (c.housing || 0) +
  (c.utilities || 0) +
  (c.gas || 0) +
  (c.groceries || 0) +
  (c.dining || 0) +
  (c.transportation || 0) +
  (c.healthcare || 0);

/** True when a usable effective tax rate is present. */
const hasTax = (loc: LocationCompData) =>
  typeof loc.effectiveTaxRate === "number" && loc.effectiveTaxRate > 0 && loc.effectiveTaxRate < 1;

/**
 * Annual take-home: median base minus income tax minus annual cost of living.
 * Falls back to the pre-tax effectiveDisposableIncome when no tax rate is available
 * (e.g. older cached entries).
 */
const takeHome = (loc: LocationCompData) => {
  const colYr = totalCol(loc.costOfLiving) * 12;
  if (hasTax(loc)) return loc.salaryBands.median * (1 - (loc.effectiveTaxRate as number)) - colYr;
  return loc.costOfLiving.effectiveDisposableIncome;
};

const muteText = { color: "var(--muted-foreground)" };
const fgText = { color: "var(--foreground)" };
const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 24,
  boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
};

/** Returns the URL only if it is an absolute http(s) link; blocks javascript:/data: and other schemes. */
const safeHttpUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
};

function SourceBadge({ source, prefix = "Source" }: { source?: SourceRef; prefix?: string }) {
  const href = safeHttpUrl(source?.url);
  if (!source || !href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs hover:underline"
      style={muteText}
      title={`${prefix}: ${source.label}${source.asOf ? ` (as of ${source.asOf})` : ""}`}
    >
      <ExternalLink className="w-3 h-3 flex-shrink-0" />
      <span>
        {prefix}: {source.label}
        {source.asOf ? ` · ${source.asOf}` : ""}
      </span>
    </a>
  );
}

function ConfidenceChip({ level }: { level?: "high" | "medium" | "low" }) {
  if (!level) return null;
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    high: { bg: "rgba(47,107,79,0.12)", color: "#2F6B4F", label: "High confidence" },
    medium: { bg: "rgba(217,119,87,0.12)", color: "#D97757", label: "Medium confidence" },
    low: { bg: "rgba(110,101,87,0.12)", color: "#6E6557", label: "Low confidence" },
  };
  const s = styles[level] ?? styles.low;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      <ShieldCheck className="w-3 h-3" /> {s.label}
    </span>
  );
}

export function MarketCompensationViz({
  data,
  cachedAt,
  onRefresh,
  isRefreshing,
  onNavigate,
}: MarketCompensationVizProps) {
  const primaryLoc = data.locations[0];
  const isComparison = data.locations.length > 1;
  const fmt = useMemo(() => makeFmt(primaryLoc.currency), [primaryLoc.currency]);

  const costOfLivingData = useMemo(() => {
    return data.locations.map((loc) => ({
      name: loc.locationName,
      Housing: loc.costOfLiving.housing || 0,
      Utilities: loc.costOfLiving.utilities || 0,
      Gas: loc.costOfLiving.gas || 0,
      Groceries: loc.costOfLiving.groceries || 0,
      Dining: loc.costOfLiving.dining || 0,
      Transportation: loc.costOfLiving.transportation || 0,
      Healthcare: loc.costOfLiving.healthcare || 0,
    }));
  }, [data.locations]);

  return (
    <div className="w-full space-y-6 mt-4">
      {/* Top bar: locations + freshness + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold" style={fgText}>
          <MapPin className="w-4 h-4" />
          <span className="text-lg">
            {data.locations.map((l) => l.locationName).join("  vs  ")}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data.locations.map(
            (l, i) => l.confidence && <ConfidenceChip key={i} level={l.confidence} />,
          )}
          {cachedAt && (
            <span className="text-xs flex items-center gap-1" style={muteText}>
              <Info className="w-3 h-3" /> As of {new Date(cachedAt).toLocaleDateString()}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-60"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                cursor: isRefreshing ? "default" : "pointer",
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />{" "}
              {isRefreshing ? "Refreshing…" : "Refresh data"}
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={{ ...cardStyle, padding: 24 }}>
        <p style={{ fontSize: 15, lineHeight: 1.6, ...fgText, opacity: 0.85 }}>{data.summary}</p>
      </div>

      {/* Comparison verdict hero */}
      {isComparison && <VerdictHero data={data} fmt={fmt} />}

      {/* Hero metric cards */}
      {isComparison ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {data.locations.map((loc, i) => {
            const accent = PALETTE[i % PALETTE.length];
            const lfmt = makeFmt(loc.currency);
            return (
              <Card
                key={i}
                style={{ ...cardStyle, background: `${accent}0F`, border: `1px solid ${accent}33` }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl" style={fgText}>
                    {loc.locationName}
                  </CardTitle>
                  <CardDescription style={muteText}>{loc.equity}</CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <p className="text-xs font-medium mb-1" style={muteText}>
                        Median Base
                      </p>
                      <h3 className="text-3xl font-bold leading-tight" style={{ color: accent }}>
                        {lfmt(loc.salaryBands.median)}
                      </h3>
                      <div className="mt-1">
                        <SourceBadge source={loc.salaryBands.source} />
                      </div>
                    </div>
                    <div>
                      <p
                        className="text-xs font-medium mb-1 flex items-center gap-1"
                        style={muteText}
                      >
                        <Calculator className="w-3 h-3" />{" "}
                        {hasTax(loc) ? "Take-home (after tax & COL)" : "Real Income (after COL)"}
                      </p>
                      <h3 className="text-3xl font-bold leading-tight" style={{ color: accent }}>
                        {lfmt(takeHome(loc))}
                      </h3>
                      {hasTax(loc) && (
                        <p className="text-xs mt-0.5" style={muteText}>
                          ~{Math.round((loc.effectiveTaxRate as number) * 100)}% effective tax
                        </p>
                      )}
                      <div className="mt-1">
                        <SourceBadge source={loc.costOfLiving.source} />
                      </div>
                    </div>
                  </div>
                  {loc.totalCompensation && (
                    <div className="pt-4 mt-4" style={{ borderTop: "1px solid var(--border)" }}>
                      <p className="text-xs font-medium mb-2" style={muteText}>
                        Total Compensation Estimate
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm">
                        <div>
                          <div className="font-semibold" style={fgText}>
                            {lfmt(loc.totalCompensation.baseMedian)}
                          </div>
                          <div className="text-xs" style={muteText}>
                            Base
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold" style={fgText}>
                            {lfmt(loc.totalCompensation.bonusMedian)}
                          </div>
                          <div className="text-xs" style={muteText}>
                            Bonus
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold" style={fgText}>
                            {lfmt(
                              loc.totalCompensation.equityMedian +
                                loc.totalCompensation.signOnMedian,
                            )}
                          </div>
                          <div className="text-xs" style={muteText}>
                            Equity
                          </div>
                        </div>
                        <div>
                          <div className="font-bold" style={{ color: accent }}>
                            {lfmt(loc.totalCompensation.totalEstimated)}
                          </div>
                          <div className="text-xs" style={muteText}>
                            Total
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <SourceBadge source={loc.totalCompensation.source} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <HeroStat
            label="Median Base"
            value={fmt(primaryLoc.salaryBands.median)}
            accent="#D97757"
            icon={<DollarSign className="h-6 w-6" />}
            source={primaryLoc.salaryBands.source}
          />
          <HeroStat
            label={hasTax(primaryLoc) ? "Take-home (after tax & COL)" : "Real Income (after COL)"}
            value={fmt(takeHome(primaryLoc))}
            sub={
              hasTax(primaryLoc)
                ? `~${Math.round((primaryLoc.effectiveTaxRate as number) * 100)}% effective tax`
                : undefined
            }
            accent="#2F6B4F"
            icon={<TrendingUp className="h-6 w-6" />}
            source={primaryLoc.costOfLiving.source}
          />
          {primaryLoc.totalCompensation ? (
            <Card style={cardStyle}>
              <CardContent className="p-6">
                <p className="text-sm font-medium mb-3" style={fgText}>
                  Total Compensation (TC)
                </p>
                <div
                  className="flex justify-between items-center p-2.5 rounded-lg mb-3"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
                >
                  <span className="text-xs font-medium" style={muteText}>
                    Estimated TC
                  </span>
                  <span className="text-lg font-bold" style={{ color: "#D97757" }}>
                    {fmt(primaryLoc.totalCompensation.totalEstimated)}
                  </span>
                </div>
                {[
                  ["Base", primaryLoc.totalCompensation.baseMedian],
                  ["Bonus (Perf)", primaryLoc.totalCompensation.bonusMedian],
                  [
                    "Equity / Sign-on",
                    primaryLoc.totalCompensation.equityMedian +
                      primaryLoc.totalCompensation.signOnMedian,
                  ],
                ].map(([label, val]) => (
                  <div
                    key={label as string}
                    className="flex justify-between items-center text-sm mb-1.5"
                    style={muteText}
                  >
                    <span>{label}</span>
                    <span className="font-medium" style={fgText}>
                      {fmt(val as number)}
                    </span>
                  </div>
                ))}
                <div className="mt-2">
                  <SourceBadge source={primaryLoc.totalCompensation.source} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card style={cardStyle}>
              <CardContent className="p-6 flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium mb-1" style={fgText}>
                    Equity & Bonus
                  </p>
                  <p className="text-sm leading-snug pr-2" style={muteText}>
                    {primaryLoc.equity}
                  </p>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    ...muteText,
                    flexShrink: 0,
                  }}
                >
                  <Building2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Side-by-side comparison table */}
      {isComparison && <ComparisonTable data={data} fmt={fmt} />}

      {/* Offer-vs-market gauge */}
      <OfferGauge loc={primaryLoc} fmt={fmt} onNavigate={onNavigate} />

      {/* Comp-by-level ladder */}
      <LevelLadder data={data} fmt={fmt} />

      {/* Salary range (percentile bar) */}
      <SalaryRangeBar data={data} fmt={fmt} />

      <div className="grid grid-cols-1 gap-6">
        {/* Cost of Living Bar Chart */}
        <Card style={{ ...cardStyle, overflow: "hidden" }}>
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-base" style={fgText}>
              Monthly Cost of Living
            </CardTitle>
            <CardDescription style={muteText}>Average essential expenses</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={costOfLivingData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                layout="vertical"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={true}
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6E6557" }}
                  tickFormatter={(val) => `$${val}`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6E6557" }}
                  width={80}
                />
                <RechartsTooltip
                  formatter={(val: number) => [fmt(val), "Cost"]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="Housing" stackId="a" fill="#1d4ed8" maxBarSize={30} />
                <Bar dataKey="Utilities" stackId="a" fill="#3b82f6" maxBarSize={30} />
                <Bar dataKey="Gas" stackId="a" fill="#60a5fa" maxBarSize={30} />
                <Bar dataKey="Groceries" stackId="a" fill="#93c5fd" maxBarSize={30} />
                <Bar dataKey="Dining" stackId="a" fill="#f59e0b" maxBarSize={30} />
                <Bar dataKey="Transportation" stackId="a" fill="#10b981" maxBarSize={30} />
                <Bar dataKey="Healthcare" stackId="a" fill="#ec4899" maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>

          <div className="px-5 pb-3">
            <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--border)" }}>
              <table className="w-full text-sm text-left">
                <thead
                  style={{ background: "var(--muted)", borderBottom: "1px solid var(--border)" }}
                >
                  <tr>
                    <th className="px-4 py-3 font-medium" style={fgText}>
                      Category (Monthly)
                    </th>
                    {data.locations.map((loc) => (
                      <th
                        key={loc.locationName}
                        className="px-4 py-3 font-medium text-right"
                        style={fgText}
                      >
                        {loc.locationName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ background: "var(--card)" }}>
                  {[
                    "housing",
                    "utilities",
                    "gas",
                    "groceries",
                    "dining",
                    "transportation",
                    "healthcare",
                  ].map((key) => (
                    <tr key={key} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-3 font-medium capitalize" style={muteText}>
                        {key}
                      </td>
                      {data.locations.map((loc) => (
                        <td
                          key={loc.locationName}
                          className="px-4 py-3 text-right font-medium"
                          style={fgText}
                        >
                          {makeFmt(loc.currency)((loc.costOfLiving as any)[key] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ background: "var(--muted)", borderTop: "2px solid var(--border)" }}>
                    <td
                      className="px-4 py-3 font-bold text-xs uppercase tracking-wider"
                      style={fgText}
                    >
                      Total Monthly
                    </td>
                    {data.locations.map((loc) => (
                      <td
                        key={loc.locationName}
                        className="px-4 py-3 text-right font-bold"
                        style={fgText}
                      >
                        {makeFmt(loc.currency)(totalCol(loc.costOfLiving))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="px-6 pb-4">
            <SourceBadge source={primaryLoc.costOfLiving.source} />
          </div>
        </Card>
      </div>

      {/* YoY Trend Chart */}
      <Card style={{ ...cardStyle, overflow: "hidden" }}>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-base" style={fgText}>
            YoY Compensation Trend
          </CardTitle>
          <CardDescription style={muteText}>
            Historical median base changes (uses real trends)
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[320px] pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="year"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6E6557" }}
                dy={10}
                allowDuplicatedCategory={false}
              />
              <YAxis
                domain={["dataMin - 10000", "dataMax + 10000"]}
                tickFormatter={(val) => `$${val / 1000}k`}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6E6557" }}
                width={60}
              />
              <RechartsTooltip
                formatter={(val: number) => [fmt(val), "Median TC"]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
              {isComparison && <Legend wrapperStyle={{ fontSize: "12px" }} verticalAlign="top" />}
              {data.locations.map((loc, i) => (
                <Line
                  key={loc.locationName}
                  data={loc.yoyTrend}
                  name={loc.locationName}
                  type="monotone"
                  dataKey="compensation"
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
        <div className="px-6 pb-4">
          <SourceBadge source={primaryLoc.yoyTrendSource} />
        </div>
      </Card>

      {/* References + disclaimer */}
      {data.sources && data.sources.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm items-center" style={muteText}>
          <span className="font-medium mr-1.5 flex items-center">
            <ExternalLink className="w-3.5 h-3.5 mr-1" /> All references:
          </span>
          {data.sources.map((s, idx) => {
            const href = safeHttpUrl(s);
            if (!href) return null;
            let host = s;
            try {
              host = new URL(s).hostname.replace(/^www\./, "");
            } catch {
              /* keep raw */
            }
            return (
              <a
                key={idx}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--primary)" }}
                className="hover:underline"
              >
                {host}
              </a>
            );
          })}
        </div>
      )}
      <p className="text-xs flex items-start gap-1.5" style={muteText}>
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        Estimates aggregated from public sources — not a guarantee of pay. Verify against the linked
        sources before negotiating.
      </p>
    </div>
  );
}

/* ── Comparison verdict hero ─────────────────────────────────────── */
function VerdictHero({ data, fmt }: { data: MarketCompData; fmt: (v: number) => string }) {
  const [a, b] = data.locations;
  const taxAware = hasTax(a) && hasTax(b);
  const effDelta = takeHome(b) - takeHome(a);
  const nominalDelta = b.salaryBands.median - a.salaryBands.median;

  const realWinner = effDelta >= 0 ? b : a;
  const realLoser = effDelta >= 0 ? a : b;
  const realGap = Math.abs(effDelta);

  const nominalWinner = nominalDelta >= 0 ? b.locationName : a.locationName;
  const flips = nominalDelta >= 0 !== effDelta >= 0;
  const afterPhrase = taxAware ? "tax and cost of living" : "cost of living";

  return (
    <div
      style={{
        ...cardStyle,
        padding: 24,
        background: "linear-gradient(135deg, rgba(217,119,87,0.08), rgba(47,107,79,0.08))",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(217,119,87,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#D97757",
            flexShrink: 0,
          }}
        >
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={muteText}>
            The verdict — real pay after {afterPhrase}
          </p>
          <p className="text-xl font-bold leading-snug" style={fgText}>
            {realGap === 0 ? (
              <>Both locations leave you with roughly the same take-home.</>
            ) : (
              <>
                After {afterPhrase},{" "}
                <span style={{ color: "#2F6B4F" }}>{realWinner.locationName}</span> leaves you{" "}
                <span style={{ color: "#2F6B4F" }}>+{fmt(realGap)}/yr</span> more than{" "}
                {realLoser.locationName}.
              </>
            )}
          </p>
          <p className="text-sm mt-1.5" style={muteText}>
            Nominal median base is higher in <strong style={fgText}>{nominalWinner}</strong> (
            {fmt(Math.abs(nominalDelta))} gap).
            {flips && ` — but ${afterPhrase} flips which location actually pays more.`}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Side-by-side comparison table ───────────────────────────────── */
function ComparisonTable({ data, fmt }: { data: MarketCompData; fmt: (v: number) => string }) {
  const [a, b] = data.locations;
  const taxAware = hasTax(a) && hasTax(b);
  const rows: {
    label: string;
    va: number;
    vb: number;
    better: "high" | "low";
    highlight?: boolean;
  }[] = [
    {
      label: "Median base salary",
      va: a.salaryBands.median,
      vb: b.salaryBands.median,
      better: "high",
    },
    {
      label: "Total compensation",
      va: a.totalCompensation?.totalEstimated ?? a.salaryBands.median,
      vb: b.totalCompensation?.totalEstimated ?? b.salaryBands.median,
      better: "high",
    },
    {
      label: "Total monthly cost of living",
      va: totalCol(a.costOfLiving),
      vb: totalCol(b.costOfLiving),
      better: "low",
    },
    {
      label: taxAware ? "Take-home (after tax & COL)" : "Real income (after COL)",
      va: takeHome(a),
      vb: takeHome(b),
      better: "high",
      highlight: true,
    },
  ];
  const winnerColor = "#2F6B4F";

  return (
    <Card style={{ ...cardStyle, overflow: "hidden" }}>
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-base" style={fgText}>
          Side-by-side comparison
        </CardTitle>
        <CardDescription style={muteText}>
          Winner highlighted per metric · Δ is {b.locationName} minus {a.locationName}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-3">
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm text-left">
            <thead style={{ borderBottom: "1px solid var(--border)" }}>
              <tr>
                <th className="px-3 py-2.5 font-medium" style={muteText}>
                  Metric
                </th>
                <th className="px-3 py-2.5 font-semibold text-right" style={{ color: PALETTE[0] }}>
                  {a.locationName}
                </th>
                <th className="px-3 py-2.5 font-semibold text-right" style={{ color: PALETTE[1] }}>
                  {b.locationName}
                </th>
                <th className="px-3 py-2.5 font-medium text-right" style={muteText}>
                  Δ
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const aWins = r.better === "high" ? r.va > r.vb : r.va < r.vb;
                const bWins = r.better === "high" ? r.vb > r.va : r.vb < r.va;
                const delta = r.vb - r.va;
                return (
                  <tr
                    key={r.label}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: r.highlight ? "var(--muted)" : undefined,
                    }}
                  >
                    <td className="px-3 py-3 font-medium" style={fgText}>
                      {r.label}
                    </td>
                    <td
                      className="px-3 py-3 text-right font-semibold"
                      style={{ color: aWins ? winnerColor : "var(--foreground)" }}
                    >
                      {fmt(r.va)}
                      {aWins && " ✓"}
                    </td>
                    <td
                      className="px-3 py-3 text-right font-semibold"
                      style={{ color: bWins ? winnerColor : "var(--foreground)" }}
                    >
                      {fmt(r.vb)}
                      {bWins && " ✓"}
                    </td>
                    <td
                      className="px-3 py-3 text-right"
                      style={{
                        color:
                          delta === 0
                            ? "var(--muted-foreground)"
                            : delta > 0
                              ? "#2F6B4F"
                              : "#D97757",
                      }}
                    >
                      {delta > 0 ? "+" : ""}
                      {fmt(delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Single-location hero stat card ──────────────────────────────── */
function HeroStat({
  label,
  value,
  sub,
  accent,
  icon,
  source,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  icon: React.ReactNode;
  source?: SourceRef;
}) {
  return (
    <Card style={{ ...cardStyle, background: `${accent}0F`, border: `1px solid ${accent}33` }}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: accent, opacity: 0.85 }}>
              {label}
            </p>
            <h3 className="text-4xl font-bold leading-tight" style={{ color: accent }}>
              {value}
            </h3>
            {sub && (
              <p className="text-xs mt-1" style={muteText}>
                {sub}
              </p>
            )}
          </div>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: `${accent}1F`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: accent,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        </div>
        <div className="mt-3">
          <SourceBadge source={source} />
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Offer-vs-market gauge ───────────────────────────────────────── */
function percentileOf(v: number, b: LocationCompData["salaryBands"]): number {
  const pts: [number, number][] = [
    [b.min, 0],
    [b.q1, 25],
    [b.median, 50],
    [b.q3, 75],
    [b.max, 100],
  ];
  if (v <= b.min) return 0;
  if (v >= b.max) return 100;
  for (let i = 1; i < pts.length; i++) {
    const [x0, p0] = pts[i - 1];
    const [x1, p1] = pts[i];
    if (v <= x1) return Math.round(p0 + (p1 - p0) * ((v - x0) / (x1 - x0 || 1)));
  }
  return 100;
}

function OfferGauge({
  loc,
  fmt,
  onNavigate,
}: {
  loc: LocationCompData;
  fmt: (v: number) => string;
  onNavigate?: (view: string) => void;
}) {
  const [offerStr, setOfferStr] = useState("");
  const offer = parseFloat(offerStr.replace(/[^0-9.]/g, ""));
  const b = loc.salaryBands;
  const valid = Number.isFinite(offer) && offer > 0;
  const pct = valid ? percentileOf(offer, b) : null;
  const markerPos = valid
    ? Math.min(100, Math.max(0, ((offer - b.min) / (b.max - b.min || 1)) * 100))
    : null;

  let verdict = "";
  let verdictColor = "var(--foreground)";
  if (pct !== null) {
    if (pct < 25) {
      verdict = "below the 25th percentile — strong room to negotiate up.";
      verdictColor = "#D97757";
    } else if (pct < 45) {
      verdict = "below the median — likely room to push higher.";
      verdictColor = "#D97757";
    } else if (pct <= 55) {
      verdict = "right around the median for this market.";
    } else if (pct <= 75) {
      verdict = "above the median — a competitive offer.";
      verdictColor = "#2F6B4F";
    } else {
      verdict = "above the 75th percentile — a strong offer.";
      verdictColor = "#2F6B4F";
    }
  }

  return (
    <Card style={{ ...cardStyle, overflow: "hidden" }}>
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-base flex items-center gap-2" style={fgText}>
          <Target className="w-4 h-4" /> Where does your offer land?
        </CardTitle>
        <CardDescription style={muteText}>
          Compare your current or offered base against {loc.locationName} ({fmt(b.min)}–{fmt(b.max)}
          )
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-3">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <input
            inputMode="numeric"
            value={offerStr}
            onChange={(e) => setOfferStr(e.target.value)}
            placeholder="e.g. 165000"
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              outline: "none",
              width: 180,
            }}
          />
          {pct !== null && (
            <span className="text-sm" style={{ color: verdictColor }}>
              <strong>~{pct}th percentile</strong> — your {fmt(offer)} is {verdict}
            </span>
          )}
        </div>

        <div
          style={{
            position: "relative",
            height: 10,
            borderRadius: 9999,
            background:
              "linear-gradient(90deg, rgba(217,119,87,0.35), rgba(232,185,72,0.35), rgba(47,107,79,0.35))",
          }}
        >
          {(
            [
              ["25th", b.q1],
              ["Median", b.median],
              ["75th", b.q3],
            ] as [string, number][]
          ).map(([lbl, val]) => {
            const pos = Math.min(100, Math.max(0, ((val - b.min) / (b.max - b.min || 1)) * 100));
            return (
              <div
                key={lbl}
                style={{
                  position: "absolute",
                  left: `${pos}%`,
                  top: -3,
                  width: 1,
                  height: 16,
                  background: "var(--border)",
                }}
              />
            );
          })}
          {markerPos !== null && (
            <div
              style={{
                position: "absolute",
                left: `${markerPos}%`,
                top: -5,
                transform: "translateX(-50%)",
                width: 4,
                height: 20,
                borderRadius: 2,
                background: verdictColor,
              }}
            />
          )}
        </div>
        <div className="flex justify-between mt-2 text-xs" style={muteText}>
          <span>{fmt(b.min)}</span>
          <span>Median {fmt(b.median)}</span>
          <span>{fmt(b.max)}</span>
        </div>

        {pct !== null && onNavigate && (
          <button
            onClick={() => onNavigate("salary")}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg"
            style={{
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Draft a negotiation with these numbers →
          </button>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Comp-by-level ladder ────────────────────────────────────────── */
function LevelLadder({ data, fmt }: { data: MarketCompData; fmt: (v: number) => string }) {
  const withLadder = data.locations.filter((l) => l.levelLadder && l.levelLadder.length > 0);
  if (withLadder.length === 0) return null;
  const isComparison = data.locations.length > 1;

  const levels = Array.from(
    new Set(withLadder.flatMap((l) => (l.levelLadder || []).map((x) => x.level))),
  );
  const chartData = levels.map((level) => {
    const row: Record<string, string | number> = { name: level };
    withLadder.forEach((l) => {
      const match = (l.levelLadder || []).find((x) => x.level === level);
      row[l.locationName] = match ? match.baseMedian : 0;
    });
    return row;
  });

  return (
    <Card style={{ ...cardStyle, overflow: "hidden" }}>
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-base flex items-center gap-2" style={fgText}>
          <Layers className="w-4 h-4" /> Compensation by level
        </CardTitle>
        <CardDescription style={muteText}>
          Typical median base as you progress in seniority
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#6E6557" }}
              dy={10}
            />
            <YAxis
              tickFormatter={(val) => `$${val / 1000}k`}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#6E6557" }}
              width={60}
            />
            <RechartsTooltip
              formatter={(val: number) => [fmt(val), "Base median"]}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--foreground)",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
            />
            {isComparison && <Legend wrapperStyle={{ fontSize: "12px" }} />}
            {withLadder.map((l, i) => (
              <Bar
                key={l.locationName}
                dataKey={l.locationName}
                fill={PALETTE[i % PALETTE.length]}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/* ── Salary range (percentile / box-plot bar) ────────────────────── */
function SalaryRangeBar({ data, fmt: _fmt }: { data: MarketCompData; fmt: (v: number) => string }) {
  const locs = data.locations;
  const gMin = Math.min(...locs.map((l) => l.salaryBands.min));
  const gMax = Math.max(...locs.map((l) => l.salaryBands.max));
  const span = gMax - gMin || 1;
  const pos = (v: number) => ((v - gMin) / span) * 100;
  // Anchor edge labels so they don't clip off the track.
  const edge = (p: number): React.CSSProperties =>
    p < 8
      ? { left: `${p}%`, transform: "translateX(0)" }
      : p > 92
        ? { left: `${p}%`, transform: "translateX(-100%)" }
        : { left: `${p}%`, transform: "translateX(-50%)" };

  return (
    <Card style={{ ...cardStyle, overflow: "hidden" }}>
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-base" style={fgText}>
          Salary Range
        </CardTitle>
        <CardDescription style={muteText}>
          Box = middle 50% (25th–75th percentile); line = median; whiskers = min–max base
        </CardDescription>
      </CardHeader>
      <CardContent
        className="p-6 pt-5"
        style={{ display: "flex", flexDirection: "column", gap: 26 }}
      >
        {locs.map((loc, i) => {
          const b = loc.salaryBands;
          const accent = PALETTE[i % PALETTE.length];
          const lfmt = makeFmt(loc.currency);
          return (
            <div key={i}>
              <div className="mb-2">
                <span className="text-sm font-semibold" style={{ color: accent }}>
                  {loc.locationName}
                </span>
              </div>
              {/* median value, positioned above its marker */}
              <div style={{ position: "relative", height: 16 }}>
                <span
                  className="text-xs font-semibold"
                  style={{
                    position: "absolute",
                    whiteSpace: "nowrap",
                    color: accent,
                    ...edge(pos(b.median)),
                  }}
                >
                  Median {lfmt(b.median)}
                </span>
              </div>
              <div style={{ position: "relative", height: 30 }}>
                {/* whisker */}
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: `${pos(b.min)}%`,
                    width: `${pos(b.max) - pos(b.min)}%`,
                    height: 2,
                    background: `${accent}66`,
                  }}
                />
                {/* min/max end caps */}
                {[b.min, b.max].map((v, k) => (
                  <div
                    key={k}
                    style={{
                      position: "absolute",
                      top: 9,
                      left: `${pos(v)}%`,
                      transform: "translateX(-50%)",
                      width: 2,
                      height: 12,
                      background: `${accent}99`,
                    }}
                  />
                ))}
                {/* IQR box */}
                <div
                  style={{
                    position: "absolute",
                    top: 5,
                    left: `${pos(b.q1)}%`,
                    width: `${pos(b.q3) - pos(b.q1)}%`,
                    height: 20,
                    background: `${accent}33`,
                    border: `1px solid ${accent}`,
                    borderRadius: 6,
                  }}
                />
                {/* median */}
                <div
                  style={{
                    position: "absolute",
                    top: 1,
                    left: `${pos(b.median)}%`,
                    transform: "translateX(-50%)",
                    width: 3,
                    height: 28,
                    background: accent,
                    borderRadius: 2,
                  }}
                  title={`Median ${lfmt(b.median)}`}
                />
              </div>
              <div style={{ position: "relative", height: 16, marginTop: 2 }}>
                <span
                  className="text-xs"
                  style={{ position: "absolute", ...edge(pos(b.min)), ...muteText }}
                >
                  {lfmt(b.min)}
                </span>
                <span
                  className="text-xs"
                  style={{ position: "absolute", ...edge(pos(b.max)), ...muteText }}
                >
                  {lfmt(b.max)}
                </span>
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pt-1" style={muteText}>
          <span className="inline-flex items-center gap-1.5">
            <span
              style={{
                width: 16,
                height: 11,
                background: `${PALETTE[0]}33`,
                border: `1px solid ${PALETTE[0]}`,
                borderRadius: 3,
                display: "inline-block",
              }}
            />{" "}
            Middle 50% (25th–75th)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              style={{
                width: 3,
                height: 13,
                background: PALETTE[0],
                borderRadius: 2,
                display: "inline-block",
              }}
            />{" "}
            Median
          </span>
          <span>Whiskers: min – max</span>
        </div>
      </CardContent>
      <div className="px-6 pb-4">
        <SourceBadge source={locs[0].salaryBands.source} />
      </div>
    </Card>
  );
}

/** Plain-text/markdown summary of a market result — used for copy-to-clipboard sharing. */
export function marketToMarkdown(data: MarketCompData): string {
  const lines: string[] = [];
  lines.push(`# Market Compensation — ${data.locations.map((l) => l.locationName).join(" vs ")}`);
  lines.push("");
  lines.push(data.summary);
  data.locations.forEach((loc) => {
    const f = makeFmt(loc.currency);
    lines.push("");
    lines.push(`## ${loc.locationName}`);
    lines.push(
      `- Median base: ${f(loc.salaryBands.median)} (range ${f(loc.salaryBands.min)}–${f(loc.salaryBands.max)})`,
    );
    if (loc.totalCompensation)
      lines.push(`- Total comp (median): ${f(loc.totalCompensation.totalEstimated)}`);
    lines.push(`- Total monthly cost of living: ${f(totalCol(loc.costOfLiving))}`);
    lines.push(
      `- ${hasTax(loc) ? "Take-home after tax & COL" : "Real income after COL"}: ${f(takeHome(loc))}`,
    );
    if (loc.dataAsOf)
      lines.push(
        `- Data as of: ${loc.dataAsOf}${loc.confidence ? ` (${loc.confidence} confidence)` : ""}`,
      );
  });
  if (data.sources?.length) {
    lines.push("");
    lines.push(`Sources: ${data.sources.join(", ")}`);
  }
  lines.push("");
  lines.push("_Estimates aggregated from public sources — not a guarantee of pay._");
  return lines.join("\n");
}
