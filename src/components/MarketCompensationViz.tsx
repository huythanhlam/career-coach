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

  // Use primary location for the main summary cards if single location, or aggregate if multiple (but let's just use the first location's data as primary anchor)
  const primaryLoc = data.locations[0];
  const isComparison = data.locations.length > 1;

  const histogramData = useMemo(() => {
    // If we have proper salaryHistogram data
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

      // Single location histogram
      return primaryLoc.salaryHistogram.map(item => ({
        name: item.bucket,
        value: item.percentage
      }));
    }

    // Fallback block if the AI fails to output salaryHistogram and only gives bands
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

  // Rest of return block and components
  return (
    <div className="w-full space-y-6 mt-4">
      {/* Summary Header */}
      <div className="bg-white dark:bg-zinc-900 border border-black/[0.04] dark:border-white/[0.04] rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
         <div className="flex items-center gap-2 mb-2 text-zinc-900 dark:text-zinc-100 font-semibold">
            <MapPin className="w-4 h-4" /> 
            {data.locations.map(l => l.locationName).join(" vs ")}
         </div>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{data.summary}</p>
      </div>

      {isComparison ? (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.locations.map((loc, i) => (
                <Card key={i} className={`${i === 0 ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900' : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900'} shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[24px]`}>
                    <CardHeader className="pb-2">
                       <CardTitle className="text-lg">{loc.locationName}</CardTitle>
                       <CardDescription className="text-xs">{loc.equity}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                       <div>
                          <p className="text-xs font-medium text-zinc-500 mb-1">Median Base</p>
                          <h3 className={`text-xl font-bold ${i === 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{formatCurrency(loc.salaryBands.median)}</h3>
                       </div>
                       <div>
                          <p className="text-xs font-medium text-zinc-500 mb-1 flex items-center gap-1"><Calculator className="w-3 h-3" /> Effective Disposable Income</p>
                          <h3 className={`text-xl font-bold ${i === 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{formatCurrency(loc.costOfLiving.effectiveDisposableIncome)}</h3>
                       </div>
                       {loc.totalCompensation && (
                           <div className="col-span-2 pt-3 mt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                              <p className="text-xs font-medium text-zinc-500 mb-2">Total Compensation Estimate</p>
                              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                <div><div className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(loc.totalCompensation.baseMedian)}</div><div className="text-zinc-500">Base</div></div>
                                <div><div className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(loc.totalCompensation.bonusMedian)}</div><div className="text-zinc-500">Bonus</div></div>
                                <div><div className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCurrency(loc.totalCompensation.equityMedian + loc.totalCompensation.signOnMedian)}</div><div className="text-zinc-500">Equity</div></div>
                                <div><div className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(loc.totalCompensation.totalEstimated)}</div><div className="text-zinc-500">Total</div></div>
                              </div>
                           </div>
                       )}
                    </CardContent>
                </Card>
            ))}
         </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[24px]">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300 mb-1">Median Base</p>
                  <h3 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{formatCurrency(primaryLoc.salaryBands.median)}</h3>
                </div>
                <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[24px]">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-300 mb-1 flex items-center gap-1"><Calculator className="w-3 h-3" /> Effective Income</p>
                  <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(primaryLoc.costOfLiving.effectiveDisposableIncome)}</h3>
                </div>
                <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[24px]">
              <CardContent className="p-6 flex items-center justify-between">
                {primaryLoc.totalCompensation ? (
                  <div className="w-full">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Total Compensation (TC)</p>
                    <div className="flex justify-between items-center bg-white dark:bg-zinc-950 p-2 rounded-md mb-2 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-xs text-zinc-500 font-medium">Estimated TC:</span>
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(primaryLoc.totalCompensation.totalEstimated)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                      <span>Base:</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(primaryLoc.totalCompensation.baseMedian)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                      <span>Bonus (Perf):</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(primaryLoc.totalCompensation.bonusMedian)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Equity / Sign-on:</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(primaryLoc.totalCompensation.equityMedian + primaryLoc.totalCompensation.signOnMedian)}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Equity & Bonus</p>
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 leading-tight pr-2">{primaryLoc.equity}</p>
                    </div>
                    <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
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
        <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/[0.04] dark:border-white/[0.04] rounded-[32px] overflow-hidden">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-base">{primaryLoc.salaryHistogram && primaryLoc.salaryHistogram.length > 0 ? "Salary Range Classification" : "Salary Range Distribution"}</CardTitle>
            <CardDescription>{primaryLoc.salaryHistogram && primaryLoc.salaryHistogram.length > 0 ? "Percentage of earners within bins" : "Min, percentiles, and maximum base compensation"}</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis 
                  tickFormatter={
                    (val) => primaryLoc.salaryHistogram && primaryLoc.salaryHistogram.length > 0 ? `${val}%` : `$${val / 1000}k`
                  } 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  width={60}
                />
                <RechartsTooltip 
                  formatter={(val: number) => {
                     return primaryLoc.salaryHistogram && primaryLoc.salaryHistogram.length > 0 
                       ? [`${val}%`, 'Percentage'] 
                       : [formatCurrency(val), 'Amount'];
                  }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                {isComparison && <Legend wrapperStyle={{ fontSize: '12px' }} />}
                {isComparison ? (
                   <>
                     <Bar dataKey={data.locations[0].locationName} fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={50} />
                     <Bar dataKey={data.locations[1].locationName} fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={50} />
                   </>
                ) : (
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {histogramData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 2 ? '#4f46e5' : '#818cf8'} />
                      ))}
                    </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost of Living Bar Chart */}
        <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/[0.04] dark:border-white/[0.04] rounded-[32px] overflow-hidden">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-base">Monthly Cost of Living</CardTitle>
            <CardDescription>Average essential expenses</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costOfLivingData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => `$${val}`} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} width={80} />
                <RechartsTooltip 
                  formatter={(val: number) => [formatCurrency(val), 'Cost']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
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
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-300 rounded-tl-lg">Category (Monthly)</th>
                    {data.locations.map(loc => (
                      <th key={loc.locationName} className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-300 text-right">{loc.locationName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {['housing', 'utilities', 'gas', 'groceries', 'dining', 'transportation', 'healthcare'].map((key) => (
                    <tr key={key} className="bg-white dark:bg-zinc-950">
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-400 font-medium capitalize">{key}</td>
                      {data.locations.map(loc => (
                        <td key={loc.locationName} className="px-4 py-3 text-zinc-900 dark:text-zinc-300 text-right font-medium">
                          {formatCurrency((loc.costOfLiving as any)[key] || 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-zinc-50 dark:bg-zinc-900 font-bold border-t-2 border-zinc-300 dark:border-zinc-700">
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-xs">Total Monthly</td>
                    {data.locations.map(loc => {
                       const total = (loc.costOfLiving.housing||0) + (loc.costOfLiving.utilities||0) + (loc.costOfLiving.gas||0) + (loc.costOfLiving.groceries||0) + (loc.costOfLiving.dining||0) + (loc.costOfLiving.transportation||0) + (loc.costOfLiving.healthcare||0);
                       return (
                          <td key={loc.locationName} className="px-4 py-3 text-zinc-900 dark:text-zinc-100 text-right font-bold">
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
      <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/[0.04] dark:border-white/[0.04] rounded-[32px] overflow-hidden">
         <CardHeader className="p-6 pb-2">
            <CardTitle className="text-base">YoY Compensation Trend</CardTitle>
            <CardDescription>Historical median base changes (Uses Real Trends)</CardDescription>
         </CardHeader>
         <CardContent className="h-[250px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
               <LineChart margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} allowDuplicatedCategory={false} />
                  <YAxis 
                     domain={['dataMin - 10000', 'dataMax + 10000']}
                     tickFormatter={(val) => `$${val / 1000}k`} 
                     axisLine={false} 
                     tickLine={false} 
                     tick={{ fontSize: 12, fill: '#6b7280' }}
                     width={60}
                  />
                  <RechartsTooltip 
                     formatter={(val: number) => [formatCurrency(val), 'Median TC']}
                     contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  {isComparison && <Legend wrapperStyle={{ fontSize: '12px' }} verticalAlign="top" />}
                  {data.locations.map((loc, i) => (
                     <Line 
                        key={loc.locationName}
                        data={loc.yoyTrend}
                        name={loc.locationName}
                        type="monotone" 
                        dataKey="compensation" 
                        stroke={i === 0 ? "#4f46e5" : "#10b981"} 
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
        <div className="flex flex-wrap gap-2 text-sm text-zinc-500 items-center">
          <span className="font-medium mr-1.5 flex items-center"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Sources:</span>
          {data.sources.map((s, idx) => (
            <a key={idx} href={s} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              [Source {idx + 1}]
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
