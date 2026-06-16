/**
 * Curated registry of Fortune 100 + popular employers whose Research Company
 * data we want pre-warmed in the shared cache (`company_research_cache`), so the
 * first user to look one up gets an instant hit instead of triggering an AI call.
 *
 * Only the company *names/aliases/tickers* are static here — public, stable
 * facts. All research figures and ratings are produced by the grounded pipeline
 * (`researchCompanyProfile` / `researchCompanyNews`), never hand-authored, so we
 * never ship invented data.
 *
 * `canonicalCompanyName()` collapses the many ways a user might type a company
 * ("google", "Alphabet", "Alphabet (Google)") onto one canonical name so they
 * all share a single cache entry — fewer duplicate AI calls, more cache hits.
 */
import { SP500_COMPANIES } from "@/lib/profileOptions";

export interface PopularCompany {
  /** Canonical display name used as the cache identity. */
  name: string;
  /** Other names/spellings that should resolve to `name`. */
  aliases?: string[];
  /** Stock ticker, where public — also treated as an alias. */
  ticker?: string;
}

/**
 * Popular private / high-interest employers not (reliably) in the S&P list,
 * plus alias-rich public names. Kept small and high-signal; extend as needed.
 */
const CURATED: PopularCompany[] = [
  { name: "Alphabet (Google)", aliases: ["Google", "Alphabet", "Google LLC", "Alphabet Inc"], ticker: "GOOGL" },
  { name: "Meta", aliases: ["Facebook", "Meta Platforms", "Facebook Inc", "Instagram", "WhatsApp"], ticker: "META" },
  { name: "Amazon", aliases: ["Amazon.com", "AWS", "Amazon Web Services"], ticker: "AMZN" },
  { name: "Apple", aliases: ["Apple Inc"], ticker: "AAPL" },
  { name: "Microsoft", aliases: ["Microsoft Corporation", "MSFT", "Azure"], ticker: "MSFT" },
  { name: "Twitter / X", aliases: ["Twitter", "X", "X Corp", "X (Twitter)"] },
  { name: "NVIDIA", aliases: ["Nvidia", "Nvidia Corporation"], ticker: "NVDA" },
  { name: "Tesla", aliases: ["Tesla Inc", "Tesla Motors"], ticker: "TSLA" },
  // Popular private / pre-IPO employers
  { name: "OpenAI" },
  { name: "Anthropic" },
  { name: "Databricks" },
  { name: "Stripe" },
  { name: "Canva" },
  { name: "Notion" },
  { name: "Figma" },
  { name: "Discord" },
  { name: "Reddit", ticker: "RDDT" },
  { name: "Plaid" },
  { name: "Ramp" },
  { name: "Brex" },
  { name: "Rippling" },
  { name: "Scale AI" },
  { name: "SpaceX" },
  { name: "Epic Games" },
  { name: "Chime" },
  { name: "Instacart", ticker: "CART" },
  { name: "DoorDash", ticker: "DASH" },
  { name: "Coinbase", aliases: ["Coinbase Global"], ticker: "COIN" },
  { name: "Palantir", aliases: ["Palantir Technologies"], ticker: "PLTR" },
  { name: "Shopify", ticker: "SHOP" },
  { name: "Block", aliases: ["Square", "Block Inc"], ticker: "XYZ" },
  { name: "Atlassian", ticker: "TEAM" },
  { name: "Datadog", ticker: "DDOG" },
  { name: "Cloudflare", ticker: "NET" },
  { name: "MongoDB", ticker: "MDB" },
  { name: "Roblox", ticker: "RBLX" },
  { name: "Pinterest", ticker: "PINS" },
  { name: "Lyft", ticker: "LYFT" },
  { name: "Robinhood", ticker: "HOOD" },
];

/** Names from CURATED so we can avoid duplicating them when folding in SP500. */
const CURATED_KEYS = new Set(CURATED.map((c) => normalizeKey(c.name)));

/**
 * The full seed list: curated entries plus every S&P 500 name not already
 * covered by a curated entry (matched on normalized name).
 */
export const POPULAR_COMPANIES: PopularCompany[] = [
  ...CURATED,
  ...SP500_COMPANIES.filter((n) => !CURATED_KEYS.has(normalizeKey(n))).map((name) => ({ name })),
];

/** Lowercase, collapse whitespace, strip punctuation that varies by typing. */
function normalizeKey(s: string | undefined): string {
  return (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "");
}

/**
 * Build the alias → canonical-name lookup once. Maps the canonical name itself,
 * each alias, the ticker, and (for "Canonical (Alt)" patterns) the parenthetical
 * and the lead-in, so "Alphabet (Google)", "Alphabet", and "Google" all resolve.
 */
const ALIAS_TO_CANONICAL: Map<string, string> = (() => {
  const m = new Map<string, string>();
  const add = (key: string | undefined, canonical: string) => {
    const k = normalizeKey(key);
    if (k && !m.has(k)) m.set(k, canonical);
  };
  for (const c of POPULAR_COMPANIES) {
    add(c.name, c.name);
    c.aliases?.forEach((a) => add(a, c.name));
    if (c.ticker) add(c.ticker, c.name);
    // "Canonical (Alt)" → also map "Canonical" and "Alt".
    const paren = c.name.match(/^(.*?)\s*\((.+)\)\s*$/);
    if (paren) {
      add(paren[1], c.name);
      add(paren[2], c.name);
    }
  }
  return m;
})();

/**
 * Resolve any user-typed company string to its canonical name when we recognize
 * it; otherwise return the trimmed input unchanged. Pure — safe to call on every
 * cache lookup.
 */
export function canonicalCompanyName(input: string | undefined): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";
  return ALIAS_TO_CANONICAL.get(normalizeKey(trimmed)) ?? trimmed;
}

/** Canonical name → PopularCompany (with ticker/aliases), for quick lookups. */
const CANONICAL_TO_COMPANY: Map<string, PopularCompany> = (() => {
  const m = new Map<string, PopularCompany>();
  for (const c of POPULAR_COMPANIES) m.set(c.name, c);
  return m;
})();

/**
 * Public stock tickers for the S&P-500 names in `SP500_COMPANIES` (which carries
 * names only). Keyed by canonical name. Private/unlisted entries (Stripe,
 * Fidelity, Twitter / X) are intentionally omitted so their chart stays hidden.
 * The CURATED list's own `ticker` fields take precedence over this map.
 */
const SP500_TICKERS: Record<string, string> = {
  "3M": "MMM", "Abbott Laboratories": "ABT", "Adobe": "ADBE", "Advanced Micro Devices": "AMD",
  "Agilent Technologies": "A", "Airbnb": "ABNB", "Akamai Technologies": "AKAM", "Albemarle": "ALB",
  "American Express": "AXP", "American Tower": "AMT", "Amgen": "AMGN", "Analog Devices": "ADI",
  "Applied Materials": "AMAT", "AT&T": "T", "Autodesk": "ADSK", "Bank of America": "BAC",
  "Berkshire Hathaway": "BRK.B", "BlackRock": "BLK", "Boeing": "BA", "Broadcom": "AVGO",
  "Capital One": "COF", "Caterpillar": "CAT", "Chevron": "CVX", "Cigna": "CI", "Cisco Systems": "CSCO",
  "Citigroup": "C", "Coca-Cola": "KO", "Cognizant": "CTSH", "Colgate-Palmolive": "CL", "Comcast": "CMCSA",
  "ConocoPhillips": "COP", "Costco": "COST", "CVS Health": "CVS", "Danaher": "DHR", "Deere & Company": "DE",
  "Dell Technologies": "DELL", "DocuSign": "DOCU", "Dow": "DOW", "DuPont": "DD", "Eaton": "ETN",
  "eBay": "EBAY", "Eli Lilly": "LLY", "Emerson Electric": "EMR", "ExxonMobil": "XOM", "FedEx": "FDX",
  "Ford Motor": "F", "General Dynamics": "GD", "General Electric": "GE", "General Mills": "GIS",
  "General Motors": "GM", "Goldman Sachs": "GS", "Honeywell": "HON", "HP": "HPQ", "Humana": "HUM",
  "IBM": "IBM", "Intel": "INTC", "Intuit": "INTU", "Johnson & Johnson": "JNJ", "JPMorgan Chase": "JPM",
  "KLA Corporation": "KLAC", "Kraft Heinz": "KHC", "Lam Research": "LRCX", "Lockheed Martin": "LMT",
  "Lowe's": "LOW", "Mastercard": "MA", "McDonald's": "MCD", "Medtronic": "MDT", "Merck": "MRK",
  "Morgan Stanley": "MS", "Netflix": "NFLX", "Nike": "NKE", "Northrop Grumman": "NOC", "Oracle": "ORCL",
  "Palo Alto Networks": "PANW", "PayPal": "PYPL", "PepsiCo": "PEP", "Pfizer": "PFE", "Philip Morris": "PM",
  "Procter & Gamble": "PG", "Qualcomm": "QCOM", "Raytheon Technologies": "RTX", "Salesforce": "CRM",
  "ServiceNow": "NOW", "Simon Property Group": "SPG", "Snap": "SNAP", "Snowflake": "SNOW", "Spotify": "SPOT",
  "Starbucks": "SBUX", "Target": "TGT", "Texas Instruments": "TXN", "The Home Depot": "HD",
  "Thermo Fisher Scientific": "TMO", "T-Mobile": "TMUS", "Uber": "UBER", "Union Pacific": "UNP",
  "United Health Group": "UNH", "UPS": "UPS", "Verizon": "VZ", "Visa": "V", "Walmart": "WMT",
  "Walt Disney": "DIS", "Wells Fargo": "WFC", "Workday": "WDAY", "Zoom": "ZM",
};

/**
 * Resolve a user-typed company to its public stock ticker when we know it
 * (curated list + S&P-500 set). Returns undefined for private companies or
 * anything we don't recognize. Pure.
 */
export function tickerForCompany(input: string | undefined): string | undefined {
  const canonical = canonicalCompanyName(input);
  return CANONICAL_TO_COMPANY.get(canonical)?.ticker ?? SP500_TICKERS[canonical];
}

/**
 * The cache identity for a company — canonical name, lowercased, whitespace
 * collapsed. Mirrors `normCompany` in `companyResearchCache.ts` and is what the
 * seeder compares against the `company` column to decide what's already warm.
 */
export function companyCacheIdentity(input: string | undefined): string {
  return canonicalCompanyName(input).toLowerCase().replace(/\s+/g, " ");
}

/**
 * Decide which popular companies still need seeding: those whose cache identity
 * is NOT present in `alreadyWarm` (the set of identities already fresh in the
 * shared cache). Pure, so the seeder's "what's left to do" logic is testable.
 */
export function selectCompaniesToSeed(alreadyWarm: Set<string>): PopularCompany[] {
  return POPULAR_COMPANIES.filter((c) => !alreadyWarm.has(companyCacheIdentity(c.name)));
}
