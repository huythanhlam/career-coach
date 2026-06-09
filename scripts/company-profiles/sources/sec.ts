/**
 * SEC EDGAR → audited financials for U.S.-listed public companies. Free, keyless
 * (a descriptive User-Agent is required, handled by `realHttpGet`).
 *
 *   1. company_tickers.json  — map ticker → CIK (load once, reuse across companies).
 *   2. companyfacts/CIK##### — XBRL facts; we pull the latest annual Revenue,
 *      Net income, and Total assets in USD with their fiscal period.
 */
import type { HttpGet } from "../lib.ts";
import { safeJson } from "../lib.ts";
import type { FinancialMetric, ProfileSource } from "../../../src/types/companyProfile.ts";

export interface SecResult {
  financials: FinancialMetric[];
  source?: ProfileSource;
  cik?: string;
}

export type TickerMap = Record<string, string>; // UPPER ticker → 10-digit CIK

interface TickerRow { cik_str: number; ticker: string; title: string }

/** Load and index the SEC ticker→CIK file. Call once per run. */
export async function loadTickerMap(httpGet: HttpGet): Promise<TickerMap> {
  const res = await httpGet("https://www.sec.gov/files/company_tickers.json");
  if (!res.ok) return {};
  const data = safeJson<Record<string, TickerRow>>(res.text);
  if (!data) return {};
  const map: TickerMap = {};
  for (const row of Object.values(data)) {
    if (row?.ticker && row.cik_str != null) {
      map[row.ticker.toUpperCase()] = String(row.cik_str).padStart(10, "0");
    }
  }
  return map;
}

interface XbrlUnitEntry { end: string; val: number; fy?: number; fp?: string; form?: string }

/** Pick the most recent annual (10-K) value; fall back to most recent of any. */
function latestAnnual(entries: XbrlUnitEntry[] | undefined): XbrlUnitEntry | undefined {
  if (!Array.isArray(entries) || !entries.length) return undefined;
  const byEndDesc = [...entries].sort((a, b) => (a.end < b.end ? 1 : -1));
  return byEndDesc.find((e) => e.form === "10-K") ?? byEndDesc[0];
}

/** First us-gaap concept that exists, across known aliases. */
function pickConcept(usGaap: Record<string, any>, names: string[]): XbrlUnitEntry[] | undefined {
  for (const n of names) {
    const usd = usGaap?.[n]?.units?.USD;
    if (Array.isArray(usd) && usd.length) return usd as XbrlUnitEntry[];
  }
  return undefined;
}

function metric(label: string, entry: XbrlUnitEntry | undefined): FinancialMetric | null {
  if (!entry || !Number.isFinite(entry.val)) return null;
  return {
    label,
    value: entry.val,
    unit: "USD",
    periodEnd: entry.end,
    fiscalYear: entry.fy,
    form: entry.form,
  };
}

export async function fetchSecFinancials(
  cik: string | undefined,
  httpGet: HttpGet,
): Promise<SecResult> {
  if (!cik) return { financials: [] };
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  const res = await httpGet(url);
  if (!res.ok) return { financials: [], cik };
  const data = safeJson<{ facts?: { "us-gaap"?: Record<string, any> } }>(res.text);
  const usGaap = data?.facts?.["us-gaap"];
  if (!usGaap) return { financials: [], cik };

  const financials = [
    metric("Revenue", latestAnnual(pickConcept(usGaap, [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ]))),
    metric("Net income", latestAnnual(pickConcept(usGaap, ["NetIncomeLoss"]))),
    metric("Total assets", latestAnnual(pickConcept(usGaap, ["Assets"]))),
  ].filter((m): m is FinancialMetric => m !== null);

  return {
    financials,
    cik,
    source: financials.length
      ? { label: "SEC EDGAR", url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K`, provider: "sec" }
      : undefined,
  };
}
