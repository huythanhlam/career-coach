/**
 * Live salary grounding via the U.S. Bureau of Labor Statistics (BLS) OEWS
 * (Occupational Employment & Wage Statistics) public API.
 *
 * BLS gives authoritative, government base-wage percentiles (10/25/50/75/90) by
 * occupation (SOC code) + area (metro or national). We overlay these onto the
 * AI-generated result so the displayed salary range is real government data
 * rather than a model estimate. Everything BLS doesn't cover (equity, bonus,
 * total comp, YoY trend, cost of living) stays AI-generated.
 *
 * Note: OEWS is annual (lags ~1 year) and all-experience (percentiles span
 * junior→senior), so the bands reflect the whole occupation in that metro, not a
 * specific YoE. London/non-US and custom roles fall back to the AI estimate.
 */
import type { MarketCompData } from "@/components/MarketCompensationViz";

// Derive the BLS endpoint from the AI gateway URL — both the local Express
// gateway (/api/ai/generate → /api/bls) and the Supabase Edge Function
// (/functions/v1/ai-generate → /functions/v1/bls).
const BLS_PROXY_URL = ((import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000/api/ai/generate")
  .replace(/\/api\/ai\/generate\/?$/, "/api/bls")
  .replace(/\/functions\/v1\/ai-generate\/?$/, "/functions/v1/bls");

const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

/** Prepopulated role → BLS SOC occupation code (6 digits). */
export const BLS_SOC_CODES: Record<string, string> = {
  "Software Engineer": "151252",        // Software Developers
  "Frontend Engineer": "151252",
  "Backend Engineer": "151252",
  "Full Stack Engineer": "151252",
  "DevOps Engineer": "151252",
  "Data Engineer": "151252",
  "Machine Learning Engineer": "151252",
  "Data Scientist": "152051",           // Data Scientists
  "Engineering Manager": "113021",      // Computer & Information Systems Managers
  "UX/UI Designer": "151255",           // Web & Digital Interface Designers
  "QA Engineer": "151253",              // Software QA Analysts & Testers
  "Product Manager": "113021",          // closest BLS proxy (no exact PM SOC)
};

/** Location → BLS area (metro/national) + the public OEWS page for citation. */
export const BLS_AREAS: Record<string, { areaType: "N" | "M"; code: string; label: string; page: string }> = {
  "San Francisco, CA": { areaType: "M", code: "0041860", label: "San Francisco metro", page: "https://www.bls.gov/oes/current/oes_41860.htm" },
  "New York, NY": { areaType: "M", code: "0035620", label: "New York metro", page: "https://www.bls.gov/oes/current/oes_35620.htm" },
  "Seattle, WA": { areaType: "M", code: "0042660", label: "Seattle metro", page: "https://www.bls.gov/oes/current/oes_42660.htm" },
  "Austin, TX": { areaType: "M", code: "0012420", label: "Austin metro", page: "https://www.bls.gov/oes/current/oes_12420.htm" },
  "Boston, MA": { areaType: "M", code: "0014460", label: "Boston metro", page: "https://www.bls.gov/oes/current/oes_14460.htm" },
  "Los Angeles, CA": { areaType: "M", code: "0031080", label: "Los Angeles metro", page: "https://www.bls.gov/oes/current/oes_31080.htm" },
  "Remote (US)": { areaType: "N", code: "0000000", label: "United States (national)", page: "https://www.bls.gov/oes/current/oes_nat.htm" },
  // London, UK has no BLS coverage → falls back to the AI estimate.
};

/** OEWS datatype codes for annual percentile wages. */
const DATATYPES = { min: "11", q1: "12", median: "13", q3: "14", max: "15" } as const;

const seriesId = (areaType: string, code: string, soc: string, dt: string) =>
  `OEU${areaType}${code}000000${soc}${dt}`;

function matchArea(locationName: string) {
  if (BLS_AREAS[locationName]) return BLS_AREAS[locationName];
  const lower = locationName.toLowerCase();
  for (const [key, area] of Object.entries(BLS_AREAS)) {
    const city = key.split(",")[0].toLowerCase();
    if (lower.includes(city)) return area;
  }
  return null;
}

function matchSoc(role: string) {
  if (BLS_SOC_CODES[role]) return BLS_SOC_CODES[role];
  const lower = role.toLowerCase();
  for (const [key, soc] of Object.entries(BLS_SOC_CODES)) {
    if (lower.includes(key.toLowerCase())) return soc;
  }
  return null;
}

export interface BlsBands {
  min: number; q1: number; median: number; q3: number; max: number;
  year: string; areaLabel: string; page: string;
}

/** Fetch real BLS base-wage percentile bands for a role + location, or null if unavailable. */
export async function fetchBlsBands(role: string, locationName: string): Promise<BlsBands | null> {
  const area = matchArea(locationName);
  const soc = matchSoc(role);
  if (!area || !soc) return null;

  const ids = Object.values(DATATYPES).map((dt) => seriesId(area.areaType, area.code, soc, dt));
  try {
    const res = await fetch(BLS_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ seriesIds: ids }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const series = data?.Results?.series;
    if (!Array.isArray(series)) return null;

    const byId: Record<string, { value: number; year: string }> = {};
    for (const s of series) {
      const pt = (s.data || []).find((d: any) => d.value && d.value !== "-") ?? s.data?.[0];
      if (pt && pt.value) byId[s.seriesID] = { value: parseFloat(pt.value), year: pt.year };
    }
    const get = (dt: string) => byId[seriesId(area.areaType, area.code, soc, dt)];
    const med = get(DATATYPES.median);
    if (!med || !Number.isFinite(med.value)) return null; // require at least a median

    const v = (dt: string) => {
      const x = get(dt);
      return x && Number.isFinite(x.value) ? x.value : null;
    };
    return {
      min: v(DATATYPES.min) ?? med.value,
      q1: v(DATATYPES.q1) ?? med.value,
      median: med.value,
      q3: v(DATATYPES.q3) ?? med.value,
      max: v(DATATYPES.max) ?? med.value,
      year: med.year,
      areaLabel: area.label,
      page: area.page,
    };
  } catch {
    return null;
  }
}

/**
 * Overlay real BLS base-wage bands onto an AI-generated result. Locations with
 * no BLS coverage (London, custom metros) or custom roles are returned unchanged.
 */
export async function enrichWithBls(data: MarketCompData, role: string): Promise<MarketCompData> {
  const locations = await Promise.all(
    data.locations.map(async (loc) => {
      const bands = await fetchBlsBands(role, loc.locationName);
      if (!bands) return loc;
      return {
        ...loc,
        salaryBands: {
          ...loc.salaryBands,
          min: bands.min,
          q1: bands.q1,
          median: bands.median,
          q3: bands.q3,
          max: bands.max,
          source: { label: `BLS OEWS — ${bands.areaLabel}`, url: bands.page, asOf: bands.year },
        },
        dataAsOf: bands.year,
      };
    })
  );
  return { ...data, locations };
}
