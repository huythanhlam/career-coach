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

/** Indexes from the SEC ticker file: by ticker symbol and by normalized name. */
export interface TickerMaps {
  byTicker: Record<string, string>; // UPPER ticker → 10-digit CIK
  byName: Record<string, string>;   // normalized company name → 10-digit CIK
}

interface TickerRow { cik_str: number; ticker: string; title: string }

/**
 * Normalize a company name/title for matching: lowercase, drop parentheticals
 * and common corporate suffixes, collapse to alphanumerics. So "3M", "3M CO",
 * and "Alphabet (Google)" reduce to "3m" / "3m" / "alphabet".
 */
export function normalizeCompanyName(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, " and ")
    .replace(/\b(the|co|company|inc|incorporated|corp|corporation|plc|ltd|limited|llc|holdings|holding|group|sa|nv|ag|se)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Load and index the SEC ticker→CIK file (by ticker and by name). Call once per run. */
export async function loadTickerMap(httpGet: HttpGet): Promise<TickerMaps> {
  const res = await httpGet("https://www.sec.gov/files/company_tickers.json");
  const empty: TickerMaps = { byTicker: {}, byName: {} };
  if (!res.ok) return empty;
  const data = safeJson<Record<string, TickerRow>>(res.text);
  if (!data) return empty;
  const maps: TickerMaps = { byTicker: {}, byName: {} };
  for (const row of Object.values(data)) {
    if (row?.cik_str == null) continue;
    const cik = String(row.cik_str).padStart(10, "0");
    if (row.ticker) maps.byTicker[row.ticker.toUpperCase()] = cik;
    const name = normalizeCompanyName(row.title);
    // First-write wins (the file is ordered by market cap), so the most
    // prominent issuer for a given name takes precedence.
    if (name && !(name in maps.byName)) maps.byName[name] = cik;
  }
  return maps;
}

/** Resolve a CIK from an (optional) ticker first, then an exact normalized name. */
export function resolveCik(maps: TickerMaps, opts: { ticker?: string; name?: string }): string | undefined {
  const t = opts.ticker?.trim().toUpperCase();
  if (t && maps.byTicker[t]) return maps.byTicker[t];
  const n = opts.name ? normalizeCompanyName(opts.name) : "";
  return n ? maps.byName[n] : undefined;
}

interface XbrlUnitEntry { end: string; val: number; fy?: number; fp?: string; form?: string }

/** How many years of annual history to keep per metric (for the YoY chart). */
const SERIES_YEARS = 5;

/**
 * Annual (10-K, full-year) series for a concept: one value per fiscal year
 * (restatements resolved by latest `end`), oldest→newest, capped to the last
 * SERIES_YEARS years.
 */
function annualSeries(entries: XbrlUnitEntry[] | undefined): XbrlUnitEntry[] {
  if (!Array.isArray(entries) || !entries.length) return [];
  const annual = entries.filter((e) => e.form === "10-K" && (e.fp === "FY" || e.fp == null) && Number.isFinite(e.val));
  const byYear = new Map<number, XbrlUnitEntry>();
  for (const e of annual) {
    const fy = e.fy ?? Number(e.end.slice(0, 4));
    const prev = byYear.get(fy);
    if (!prev || e.end > prev.end) byYear.set(fy, { ...e, fy });
  }
  return [...byYear.values()].sort((a, b) => (a.fy! - b.fy!)).slice(-SERIES_YEARS);
}

/** First us-gaap concept that exists, across known aliases. */
function pickConcept(usGaap: Record<string, any>, names: string[]): XbrlUnitEntry[] | undefined {
  for (const n of names) {
    const usd = usGaap?.[n]?.units?.USD;
    if (Array.isArray(usd) && usd.length) return usd as XbrlUnitEntry[];
  }
  return undefined;
}

function seriesMetrics(label: string, entries: XbrlUnitEntry[] | undefined): FinancialMetric[] {
  return annualSeries(entries).map((e) => ({
    label,
    value: e.val,
    unit: "USD",
    periodEnd: e.end,
    fiscalYear: e.fy,
    form: e.form,
  }));
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

  // Multi-year series per metric so the UI can chart YoY change.
  const financials = [
    ...seriesMetrics("Revenue", pickConcept(usGaap, [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ])),
    ...seriesMetrics("Net income", pickConcept(usGaap, ["NetIncomeLoss"])),
    ...seriesMetrics("Total assets", pickConcept(usGaap, ["Assets"])),
  ];

  return {
    financials,
    cik,
    source: financials.length
      ? { label: "SEC EDGAR", url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K`, provider: "sec" }
      : undefined,
  };
}
