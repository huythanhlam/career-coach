import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend } from 'recharts';
import { DollarSign, TrendingUp, Building2, ExternalLink, MapPin, Calculator } from 'lucide-react';

export interface LocationCompData {
  locationName: string;
  salaryBands: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
  };
  salaryHistogram?: {
    bucket: string;
    percentage: number;
  }[];
  totalCompensation?: {
    baseMedian: number;
    bonusMedian: number;
    equityMedian: number;
    signOnMedian: number;
    totalEstimated: number;
    notes: string;
  };
  equity: string;
  yoyTrend: {
    year: string;
    compensation: number;
  }[];
  costOfLiving: {
    housing: number;
    utilities: number;
    gas: number;
    groceries: number;
    dining?: number;
    transportation?: number;
    healthcare?: number;
    effectiveDisposableIncome: number;
  };
}

export interface MarketCompData {
  summary: string;
  locations: LocationCompData[];
  sources: string[];
}

export function MarketCompensationViz({ data }: { data: MarketCompData }) {
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const primaryLoc = data.locations[0];
  const isComparison = data.locations.length > 1;

  const histogramData = useMemo(() => {
    if (primaryLoc.salaryHistogram && primaryLoc.salaryHistogram.length > 0) {
      if (isComparison) {
        const loc1 = data.locations[0];
        const loc2 = data.locations[1];
        const bucketsList = Array.from(new Set([
          ...(loc1.salaryHistogram || []).map(h => h.bucket),
          ...(loc2.salaryHistogram || []).map(h => h.bucket)
        ]));
        return bucketsList.map(bucket => {
          const match1 = (loc1.salaryHistogram || []).find(h => h.bucket === bucket);
          const match2 = (loc2.salaryHistogram || []).find(h => h.bucket === bucket);
          return {
            name: bucket,
            [loc1.locationName]: match1 ? match1.percentage : 0,
            [loc2.locationName]: match2 ? match2.percentage : 0,
          };
        });
      }
      return primaryLoc.salaryHistogram.map(item => ({ name: item.bucket, value: item.percentage }));
    }

    if (isComparison) {
      const loc1 = data.locations[0];
      const loc2 = data.locations[1];
      return [
        { name: 'Min', [loc1.locationName]: loc1.salaryBands.min, [loc2.locationName]: loc2.salaryBands.min },
        { name: '25th %', [loc1.locationName]: loc1.salaryBands.q1, [loc2.locationName]: loc2.salaryBands.q1 },
        { name: 'Median', [loc1.locationName]: loc1.salaryBands.median, [loc2.locationName]: loc2.salaryBands.median },
        { name: '75th %', [loc1.locationName]: loc1.salaryBands.q3, [loc2.locationName]: loc2.salaryBands.q3 },
        { name: 'Max', [loc1.locationName]: loc1.salaryBands.max, [loc2.locationName]: loc2.salaryBands.max },
      ];
    }

    return [
      { name: 'Min', value: primaryLoc.salaryBands.min },
      { name: '25th %', value: primaryLoc.salaryBands.q1 },
      { name: 'Median', value: primaryLoc.salaryBands.median },
      { name: '75th %', value: primaryLoc.salaryBands.q3 },
      { name: 'Max', value: primaryLoc.salaryBands.max },
    ];
  }, [data.locations, isComparison, primaryLoc]);

  const costOfLivingData = useMemo(() => {
    return data.locations.map(loc => ({
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

  const cardStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.04)" };
  const muteText = { color: "var(--muted-foreground)" };
  const fgText = { color: "var(--foreground)" };
  const primaryText = { color: "var(--primary)" };
  const forestText = { color: "var(--forest)" };

  return (
    <div className="w-full space-y-6 mt-4">
      {/* Summary Header */}
      <div style={{ ...cardStyle, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontWeight: 600, ...fgText }}>
          <MapPin className="w-4 h-4" />
          {data.locations.map(l => l.locationName).join(" vs ")}
        </div>
        <p style={{ fontSize: 14, ...fgText, opacity: 0.8 }}>{data.summary}</p>
      </div>

      {isComparison ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.locations.map((loc, i) => (
            <Card key={i} style={{
              ...cardStyle,
              background: i === 0 ? "rgba(217,119,87,0.06)" : "rgba(47,107,79,0.06)",
              border: `1px solid ${i === 0 ? "rgba(217,119,87,0.20)" : "rgba(47,107,79,0.20)"}`,
            }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg" style={fgText}>{loc.locationName}</CardTitle>
                <CardDescription style={muteText}>{loc.equity}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium mb-1" style={muteText}>Median Base</p>
                  <h3 className="text-xl font-bold" style={i === 0 ? primaryText : forestText}>{formatCurrency(loc.salaryBands.median)}</h3>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1 flex items-center gap-1" style={muteText}><Calculator className="w-3 h-3" /> Effective Disposable Income</p>
                  <h3 className="text-xl font-bold" style={i === 0 ? primaryText : forestText}>{formatCurrency(loc.costOfLiving.effectiveDisposableIncome)}</h3>
                </div>
                {loc.totalCompensation && (
                  <div className="col-span-2 pt-3 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
                    <p className="text-xs font-medium mb-2" style={muteText}>Total Compensation Estimate</p>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div><div className="font-semibold" style={fgText}>{formatCurrency(loc.totalCompensation.baseMedian)}</div><div style={muteText}>Base</div></div>
                      <div><div className="font-semibold" style={fgText}>{formatCurrency(loc.totalCompensation.bonusMedian)}</div><div style={muteText}>Bonus</div></div>
                      <div><div className="font-semibold" style={fgText}>{formatCurrency(loc.totalCompensation.equityMedian + loc.totalCompensation.signOnMedian)}</div><div style={muteText}>Equity</div></div>
                      <div><div className="font-bold" style={primaryText}>{formatCurrency(loc.totalCompensation.totalEstimated)}</div><div style={muteText}>Total</div></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card style={{ ...cardStyle, background: "rgba(217,119,87,0.06)", border: "1px solid rgba(217,119,87,0.20)" }}>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--primary)", opacity: 0.8 }}>Median Base</p>
                <h3 className="text-2xl font-bold" style={primaryText}>{formatCurrency(primaryLoc.salaryBands.median)}</h3>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(217,119,87,0.12)", display: "flex", alignItems: "center", justifyContent: "center", ...primaryText }}>
                <DollarSign className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card style={{ ...cardStyle, background: "rgba(47,107,79,0.06)", border: "1px solid rgba(47,107,79,0.20)" }}>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium mb-1 flex items-center gap-1" style={{ color: "var(--forest)", opacity: 0.85 }}><Calculator className="w-3 h-3" /> Effective Income</p>
                <h3 className="text-2xl font-bold" style={forestText}>{formatCurrency(primaryLoc.costOfLiving.effectiveDisposableIncome)}</h3>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(47,107,79,0.12)", display: "flex", alignItems: "center", justifyContent: "center", ...forestText }}>
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card style={cardStyle}>
            <CardContent className="p-6 flex items-center justify-between">
              {primaryLoc.totalCompensation ? (
                <div className="w-full">
                  <p className="text-sm font-medium mb-2" style={fgText}>Total Compensation (TC)</p>
                  <div className="flex justify-between items-center p-2 rounded-md mb-2" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
                    <span className="text-xs font-medium" style={muteText}>Estimated TC:</span>
                    <span className="text-sm font-bold" style={primaryText}>{formatCurrency(primaryLoc.totalCompensation.totalEstimated)}</span>
                  </div>
                  {[
                    ["Base:", primaryLoc.totalCompensation.baseMedian],
                    ["Bonus (Perf):", primaryLoc.totalCompensation.bonusMedian],
                    ["Equity / Sign-on:", primaryLoc.totalCompensation.equityMedian + primaryLoc.totalCompensation.signOnMedian],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between items-center text-xs mb-1" style={muteText}>
                      <span>{label}</span>
                      <span className="font-medium" style={fgText}>{formatCurrency(val as number)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium mb-1" style={fgText}>Equity & Bonus</p>
                    <p className="text-xs font-medium leading-tight pr-2" style={muteText}>{primaryLoc.equity}</p>
                  </div>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", ...muteText, flexShrink: 0 }}>
                    <Building2 className="h-5 w-5" />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Histogram / Range Chart */}
        <Card style={{ ...cardStyle, overflow: "hidden" }}>
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-base" style={fgText}>{primaryLoc.salaryHistogram && primaryLoc.salaryHistogram.length > 0 ? "Salary Range Classification" : "Salary Range Distribution"}</CardTitle>
            <CardDescription style={muteText}>{primaryLoc.salaryHistogram && primaryLoc.salaryHistogram.length > 0 ? "Percentage of earners within bins" : "Min, percentiles, and maximum base compensation"}</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6E6557' }} dy={10} />
                <YAxis
                  tickFormatter={(val) => primaryLoc.salaryHistogram && primaryLoc.salaryHistogram.length > 0 ? `${val}%` : `$${val / 1000}k`}
                  axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6E6557' }} width={60}
                />
                <RechartsTooltip
                  formatter={(val: number) => primaryLoc.salaryHistogram && primaryLoc.salaryHistogram.length > 0 ? [`${val}%`, 'Percentage'] : [formatCurrency(val), 'Amount']}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                {isComparison && <Legend wrapperStyle={{ fontSize: '12px' }} />}
                {isComparison ? (
                  <>
                    <Bar dataKey={data.locations[0].locationName} fill="#D97757" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Bar dataKey={data.locations[1].locationName} fill="#2F6B4F" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </>
                ) : (
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {histogramData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index === 2 ? '#D97757' : 'rgba(217,119,87,0.5)'} />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost of Living Bar Chart */}
        <Card style={{ ...cardStyle, overflow: "hidden" }}>
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-base" style={fgText}>Monthly Cost of Living</CardTitle>
            <CardDescription style={muteText}>Average essential expenses</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costOfLivingData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6E6557' }} tickFormatter={(val) => `$${val}`} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6E6557' }} width={80} />
                <RechartsTooltip
                  formatter={(val: number) => [formatCurrency(val), 'Cost']}
                  contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
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

          <div className="px-5 pb-5">
            <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--border)" }}>
              <table className="w-full text-sm text-left">
                <thead style={{ background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                  <tr>
                    <th className="px-4 py-3 font-medium" style={fgText}>Category (Monthly)</th>
                    {data.locations.map(loc => (
                      <th key={loc.locationName} className="px-4 py-3 font-medium text-right" style={fgText}>{loc.locationName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ background: "var(--card)" }}>
                  {['housing', 'utilities', 'gas', 'groceries', 'dining', 'transportation', 'healthcare'].map((key) => (
                    <tr key={key} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="px-4 py-3 font-medium capitalize" style={muteText}>{key}</td>
                      {data.locations.map(loc => (
                        <td key={loc.locationName} className="px-4 py-3 text-right font-medium" style={fgText}>
                          {formatCurrency((loc.costOfLiving as any)[key] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ background: "var(--muted)", borderTop: "2px solid var(--border)" }}>
                    <td className="px-4 py-3 font-bold text-xs uppercase tracking-wider" style={fgText}>Total Monthly</td>
                    {data.locations.map(loc => {
                      const total = (loc.costOfLiving.housing || 0) + (loc.costOfLiving.utilities || 0) + (loc.costOfLiving.gas || 0) + (loc.costOfLiving.groceries || 0) + (loc.costOfLiving.dining || 0) + (loc.costOfLiving.transportation || 0) + (loc.costOfLiving.healthcare || 0);
                      return (
                        <td key={loc.locationName} className="px-4 py-3 text-right font-bold" style={fgText}>
                          {formatCurrency(total)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      {/* YoY Trend Chart */}
      <Card style={{ ...cardStyle, overflow: "hidden" }}>
        <CardHeader className="p-6 pb-2">
          <CardTitle className="text-base" style={fgText}>YoY Compensation Trend</CardTitle>
          <CardDescription style={muteText}>Historical median base changes (Uses Real Trends)</CardDescription>
        </CardHeader>
        <CardContent className="h-[250px] pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6E6557' }} dy={10} allowDuplicatedCategory={false} />
              <YAxis
                domain={['dataMin - 10000', 'dataMax + 10000']}
                tickFormatter={(val) => `$${val / 1000}k`}
                axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6E6557' }} width={60}
              />
              <RechartsTooltip
                formatter={(val: number) => [formatCurrency(val), 'Median TC']}
                contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              {isComparison && <Legend wrapperStyle={{ fontSize: '12px' }} verticalAlign="top" />}
              {data.locations.map((loc, i) => (
                <Line
                  key={loc.locationName}
                  data={loc.yoyTrend}
                  name={loc.locationName}
                  type="monotone"
                  dataKey="compensation"
                  stroke={i === 0 ? "#D97757" : "#2F6B4F"}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {data.sources && data.sources.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm items-center" style={muteText}>
          <span className="font-medium mr-1.5 flex items-center"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Sources:</span>
          {data.sources.map((s, idx) => (
            <a key={idx} href={s} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }} className="hover:underline">
              [Source {idx + 1}]
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
