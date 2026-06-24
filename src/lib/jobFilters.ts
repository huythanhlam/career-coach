// Job discovery facets — location, seniority level, and workplace type.
//
// The location matcher is country-gated: it first resolves the job's country and
// rejects anything in a *different* country than the query. This fixes the bug
// where searching "United States" returned "United Kingdom" roles (both share the
// word "United", and the old matcher matched on any shared word). Matching is
// phrase/alias based, never on loose word overlap.

/* ───────────────────────────── Reference data ───────────────────────────── */

interface Country { name: string; aliases: string[] } // aliases: phrases (substring) or ≤3-char codes (token)

// Canonical geo reference data — shared single source of truth. `src/lib/locations.ts`
// imports these to build location normalization; keep this the only definition.
export const COUNTRIES: Country[] = [
  { name: "United States", aliases: ["united states of america", "united states", "usa", "u s a", "us"] },
  { name: "United Kingdom", aliases: ["united kingdom", "great britain", "northern ireland", "england", "scotland", "wales", "britain", "uk"] },
  { name: "Canada", aliases: ["canada"] },
  { name: "Mexico", aliases: ["mexico"] },
  { name: "Brazil", aliases: ["brazil", "brasil"] },
  { name: "Argentina", aliases: ["argentina"] },
  { name: "Ireland", aliases: ["ireland"] },
  { name: "Germany", aliases: ["germany", "deutschland"] },
  { name: "France", aliases: ["france"] },
  { name: "Spain", aliases: ["spain", "españa"] },
  { name: "Portugal", aliases: ["portugal"] },
  { name: "Italy", aliases: ["italy", "italia"] },
  { name: "Netherlands", aliases: ["netherlands", "holland"] },
  { name: "Belgium", aliases: ["belgium"] },
  { name: "Switzerland", aliases: ["switzerland"] },
  { name: "Austria", aliases: ["austria"] },
  { name: "Sweden", aliases: ["sweden"] },
  { name: "Norway", aliases: ["norway"] },
  { name: "Denmark", aliases: ["denmark"] },
  { name: "Finland", aliases: ["finland"] },
  { name: "Poland", aliases: ["poland"] },
  { name: "Czechia", aliases: ["czechia", "czech republic"] },
  { name: "Romania", aliases: ["romania"] },
  { name: "Ukraine", aliases: ["ukraine"] },
  { name: "Greece", aliases: ["greece"] },
  { name: "India", aliases: ["india"] },
  { name: "China", aliases: ["china"] },
  { name: "Japan", aliases: ["japan"] },
  { name: "South Korea", aliases: ["south korea", "korea"] },
  { name: "Singapore", aliases: ["singapore"] },
  { name: "Hong Kong", aliases: ["hong kong"] },
  { name: "Taiwan", aliases: ["taiwan"] },
  { name: "Indonesia", aliases: ["indonesia"] },
  { name: "Philippines", aliases: ["philippines"] },
  { name: "Vietnam", aliases: ["vietnam"] },
  { name: "Thailand", aliases: ["thailand"] },
  { name: "Malaysia", aliases: ["malaysia"] },
  { name: "Australia", aliases: ["australia"] },
  { name: "New Zealand", aliases: ["new zealand"] },
  { name: "United Arab Emirates", aliases: ["united arab emirates", "uae", "dubai", "abu dhabi"] },
  { name: "Israel", aliases: ["israel"] },
  { name: "Saudi Arabia", aliases: ["saudi arabia"] },
  { name: "Turkey", aliases: ["turkey", "türkiye"] },
  { name: "South Africa", aliases: ["south africa"] },
  { name: "Nigeria", aliases: ["nigeria"] },
  { name: "Kenya", aliases: ["kenya"] },
  { name: "Egypt", aliases: ["egypt"] },
];

export const COUNTRY_SHORT: Record<string, string> = {
  "United States": "USA",
  "United Kingdom": "UK",
  "United Arab Emirates": "UAE",
};

interface UsState { name: string; code: string }
export const US_STATES: UsState[] = [
  { name: "Alabama", code: "AL" }, { name: "Alaska", code: "AK" }, { name: "Arizona", code: "AZ" },
  { name: "Arkansas", code: "AR" }, { name: "California", code: "CA" }, { name: "Colorado", code: "CO" },
  { name: "Connecticut", code: "CT" }, { name: "Delaware", code: "DE" }, { name: "Florida", code: "FL" },
  { name: "Georgia", code: "GA" }, { name: "Hawaii", code: "HI" }, { name: "Idaho", code: "ID" },
  { name: "Illinois", code: "IL" }, { name: "Indiana", code: "IN" }, { name: "Iowa", code: "IA" },
  { name: "Kansas", code: "KS" }, { name: "Kentucky", code: "KY" }, { name: "Louisiana", code: "LA" },
  { name: "Maine", code: "ME" }, { name: "Maryland", code: "MD" }, { name: "Massachusetts", code: "MA" },
  { name: "Michigan", code: "MI" }, { name: "Minnesota", code: "MN" }, { name: "Mississippi", code: "MS" },
  { name: "Missouri", code: "MO" }, { name: "Montana", code: "MT" }, { name: "Nebraska", code: "NE" },
  { name: "Nevada", code: "NV" }, { name: "New Hampshire", code: "NH" }, { name: "New Jersey", code: "NJ" },
  { name: "New Mexico", code: "NM" }, { name: "New York", code: "NY" }, { name: "North Carolina", code: "NC" },
  { name: "North Dakota", code: "ND" }, { name: "Ohio", code: "OH" }, { name: "Oklahoma", code: "OK" },
  { name: "Oregon", code: "OR" }, { name: "Pennsylvania", code: "PA" }, { name: "Rhode Island", code: "RI" },
  { name: "South Carolina", code: "SC" }, { name: "South Dakota", code: "SD" }, { name: "Tennessee", code: "TN" },
  { name: "Texas", code: "TX" }, { name: "Utah", code: "UT" }, { name: "Vermont", code: "VT" },
  { name: "Virginia", code: "VA" }, { name: "Washington", code: "WA" }, { name: "West Virginia", code: "WV" },
  { name: "Wisconsin", code: "WI" }, { name: "Wyoming", code: "WY" }, { name: "District of Columbia", code: "DC" },
];

interface City { city: string; stateCode?: string; country: string }
export const CITIES: City[] = [
  // United States
  { city: "New York", stateCode: "NY", country: "United States" },
  { city: "Brooklyn", stateCode: "NY", country: "United States" },
  { city: "Los Angeles", stateCode: "CA", country: "United States" },
  { city: "San Francisco", stateCode: "CA", country: "United States" },
  { city: "San Jose", stateCode: "CA", country: "United States" },
  { city: "Oakland", stateCode: "CA", country: "United States" },
  { city: "Palo Alto", stateCode: "CA", country: "United States" },
  { city: "Mountain View", stateCode: "CA", country: "United States" },
  { city: "San Diego", stateCode: "CA", country: "United States" },
  { city: "Sacramento", stateCode: "CA", country: "United States" },
  { city: "Santa Monica", stateCode: "CA", country: "United States" },
  { city: "Irvine", stateCode: "CA", country: "United States" },
  { city: "Chicago", stateCode: "IL", country: "United States" },
  { city: "Houston", stateCode: "TX", country: "United States" },
  { city: "Dallas", stateCode: "TX", country: "United States" },
  { city: "Austin", stateCode: "TX", country: "United States" },
  { city: "San Antonio", stateCode: "TX", country: "United States" },
  { city: "Phoenix", stateCode: "AZ", country: "United States" },
  { city: "Philadelphia", stateCode: "PA", country: "United States" },
  { city: "Pittsburgh", stateCode: "PA", country: "United States" },
  { city: "Seattle", stateCode: "WA", country: "United States" },
  { city: "Denver", stateCode: "CO", country: "United States" },
  { city: "Boston", stateCode: "MA", country: "United States" },
  { city: "Cambridge", stateCode: "MA", country: "United States" },
  { city: "Washington", stateCode: "DC", country: "United States" },
  { city: "Arlington", stateCode: "VA", country: "United States" },
  { city: "Atlanta", stateCode: "GA", country: "United States" },
  { city: "Miami", stateCode: "FL", country: "United States" },
  { city: "Jacksonville", stateCode: "FL", country: "United States" },
  { city: "Portland", stateCode: "OR", country: "United States" },
  { city: "Las Vegas", stateCode: "NV", country: "United States" },
  { city: "Detroit", stateCode: "MI", country: "United States" },
  { city: "Minneapolis", stateCode: "MN", country: "United States" },
  { city: "Nashville", stateCode: "TN", country: "United States" },
  { city: "Charlotte", stateCode: "NC", country: "United States" },
  { city: "Raleigh", stateCode: "NC", country: "United States" },
  { city: "Columbus", stateCode: "OH", country: "United States" },
  { city: "Indianapolis", stateCode: "IN", country: "United States" },
  { city: "Salt Lake City", stateCode: "UT", country: "United States" },
  { city: "Kansas City", stateCode: "MO", country: "United States" },
  // International
  { city: "London", country: "United Kingdom" },
  { city: "Manchester", country: "United Kingdom" },
  { city: "Edinburgh", country: "United Kingdom" },
  { city: "Dublin", country: "Ireland" },
  { city: "Paris", country: "France" },
  { city: "Berlin", country: "Germany" },
  { city: "Munich", country: "Germany" },
  { city: "Amsterdam", country: "Netherlands" },
  { city: "Madrid", country: "Spain" },
  { city: "Barcelona", country: "Spain" },
  { city: "Lisbon", country: "Portugal" },
  { city: "Zurich", country: "Switzerland" },
  { city: "Stockholm", country: "Sweden" },
  { city: "Toronto", country: "Canada" },
  { city: "Vancouver", country: "Canada" },
  { city: "Montreal", country: "Canada" },
  { city: "Sydney", country: "Australia" },
  { city: "Melbourne", country: "Australia" },
  { city: "Bengaluru", country: "India" },
  { city: "Bangalore", country: "India" },
  { city: "Mumbai", country: "India" },
  { city: "Hyderabad", country: "India" },
  { city: "Tokyo", country: "Japan" },
  { city: "Seoul", country: "South Korea" },
  { city: "Tel Aviv", country: "Israel" },
  { city: "Dubai", country: "United Arab Emirates" },
  { city: "São Paulo", country: "Brazil" },
  { city: "Mexico City", country: "Mexico" },
  { city: "Warsaw", country: "Poland" },
];

/* ───────────────────────────── Normalization ────────────────────────────── */

function norm(s?: string | null): string {
  return (s ?? "").toLowerCase().replace(/[.,/()\-_|]/g, " ").replace(/\s+/g, " ").trim();
}
/** Whole-word token test (for short ambiguous codes like "us", "ny"). */
function hasToken(n: string, tok: string): boolean {
  return new RegExp(`(^| )${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(n);
}
function matchesAlias(n: string, alias: string): boolean {
  return alias.length <= 3 ? hasToken(n, alias) : n.includes(alias);
}

/* ───────────────────────────── Country resolution ───────────────────────── */

/** Resolve the country a job location refers to, or null if undeterminable. */
export function jobCountryOf(loc?: string | null): string | null {
  const n = norm(loc);
  if (!n) return null;
  for (const c of COUNTRIES) {
    for (const a of c.aliases) if (matchesAlias(n, a)) return c.name;
  }
  for (const s of US_STATES) {
    if (n.includes(s.name.toLowerCase()) || hasToken(n, s.code.toLowerCase())) return "United States";
  }
  for (const c of CITIES) {
    if (n.includes(c.city.toLowerCase())) return c.country;
  }
  return null;
}

/* ───────────────────────────── Query parsing ────────────────────────────── */

type Target =
  | { type: "country"; country: string }
  | { type: "state"; country: "United States"; state: string; code: string }
  | { type: "city"; country: string; city: string }
  | { type: "text"; raw: string };

function parseLocationQuery(query: string): Target | null {
  const n = norm(query);
  if (!n) return null;
  for (const c of COUNTRIES) {
    for (const a of c.aliases) if (matchesAlias(n, a)) return { type: "country", country: c.name };
  }
  for (const s of US_STATES) {
    if (n === s.code.toLowerCase() || n.includes(s.name.toLowerCase())) {
      return { type: "state", country: "United States", state: s.name, code: s.code };
    }
  }
  for (const c of CITIES) {
    if (n.includes(c.city.toLowerCase())) return { type: "city", country: c.country, city: c.city };
  }
  return { type: "text", raw: n };
}

/**
 * Build a reusable location matcher for a query. Returns a predicate over a job's
 * location string + remote flag. Country-gated: a job positively identified as a
 * different country than the query is always rejected.
 */
export function makeLocationMatcher(query: string): (loc?: string | null, remote?: boolean | null) => boolean {
  const target = parseLocationQuery(query);
  if (!target) return () => true;
  return (loc) => {
    const n = norm(loc);
    const jc = jobCountryOf(loc);
    // Country gate — the core fix for cross-country false positives.
    if ("country" in target && jc && jc !== target.country) return false;
    switch (target.type) {
      case "country":
        return true; // same country, or undeterminable (e.g. "Remote")
      case "state": {
        if (!n) return true;
        if (n.includes(target.state.toLowerCase())) return true;
        if (hasToken(n, target.code.toLowerCase())) return true;
        if (CITIES.some((c) => c.stateCode === target.code && n.includes(c.city.toLowerCase()))) return true;
        return jc === null;
      }
      case "city": {
        if (!n) return true;
        if (n.includes(target.city.toLowerCase())) return true;
        return jc === null;
      }
      case "text": {
        if (!n) return true;
        return n.includes(target.raw) || jc === null;
      }
    }
  };
}

/* ───────────────────────────── Suggestions ──────────────────────────────── */

function countryShort(country: string): string {
  return COUNTRY_SHORT[country] ?? country;
}

const ALL_SUGGESTIONS: string[] = [
  "Remote",
  ...COUNTRIES.map((c) => c.name),
  ...US_STATES.map((s) => `${s.name}, USA`),
  ...CITIES.map((c) => (c.stateCode ? `${c.city}, ${c.stateCode}, USA` : `${c.city}, ${countryShort(c.country)}`)),
];

const POPULAR_SUGGESTIONS = [
  "Remote", "United States", "New York, NY, USA", "San Francisco, CA, USA",
  "Seattle, WA, USA", "Austin, TX, USA", "London, UK", "Toronto, Canada",
];

/** Location autocomplete suggestions for a partial query (city / state / country). */
export function suggestLocations(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return POPULAR_SUGGESTIONS.slice(0, limit);
  const matches = ALL_SUGGESTIONS.filter((s) => s.toLowerCase().includes(q));
  matches.sort((a, b) => {
    const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1;
    return aStarts - bStarts || a.length - b.length;
  });
  return matches.slice(0, limit);
}

/* ───────────────────────────── Seniority level ──────────────────────────── */

export type JobLevel = "intern" | "entry" | "mid" | "senior" | "lead" | "manager";

/** Levels with their typical years-of-experience range, for user clarity. */
export const JOB_LEVELS: { value: JobLevel; label: string; years: string }[] = [
  { value: "intern", label: "Internship", years: "Student / pre-career" },
  { value: "entry", label: "Entry level", years: "0–2 yrs" },
  { value: "mid", label: "Mid level", years: "2–5 yrs" },
  { value: "senior", label: "Senior", years: "5–8 yrs" },
  { value: "lead", label: "Lead / Staff / Principal", years: "8+ yrs" },
  { value: "manager", label: "Manager / Director+", years: "8+ yrs, leads people" },
];

/**
 * Infer a seniority level from a job title. Explicit seniority prefixes win over
 * the ambiguous function word "manager" — e.g. "Senior Product Manager" is a
 * senior IC role, not people management. IC "* Manager" titles (Product/Program/
 * Project/Account/etc.) are excluded from the people-manager bucket.
 */
export function classifyLevel(title: string): JobLevel {
  const t = " " + norm(title) + " ";
  if (/\b(intern|internship|co op|coop|apprentice|apprenticeship)\b/.test(t)) return "intern";
  if (/\b(senior|sr|snr)\b/.test(t)) return "senior";
  if (/\b(lead|principal|staff|architect|distinguished|fellow)\b/.test(t)) return "lead";
  if (/\b(junior|jr|entry|graduate|grad|associate|trainee|early career)\b/.test(t)) return "entry";
  if (/\b(vp|svp|evp|vice president|head of|director|chief|cto|ceo|cfo|coo|cmo|president)\b/.test(t)) return "manager";
  if (/\bmanager\b/.test(t) && !/\b(product|program|project|account|community|social media|brand|content|product marketing) manager\b/.test(t)) return "manager";
  return "mid";
}

/* ───────────────────────────── Workplace type ───────────────────────────── */

export type Workplace = "remote" | "hybrid" | "onsite";

export const WORKPLACE_TYPES: { value: Workplace; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

/** Classify a job's workplace type from its location/description/remote flag. */
export function classifyWorkplace(opts: { location?: string | null; description?: string | null; remote?: boolean | null }): Workplace {
  const text = norm(`${opts.location ?? ""} ${opts.description ?? ""}`);
  if (/\bhybrid\b/.test(text)) return "hybrid";
  if (opts.remote === true || /\bremote\b|\bwork from home\b|\bwfh\b|\bfully remote\b|\bremote first\b/.test(text)) return "remote";
  return "onsite";
}

/* ───────────────────────────── Job family / type ────────────────────────── */

export type JobFamily =
  | "engineering" | "data" | "design" | "product" | "marketing" | "sales"
  | "finance" | "operations" | "people" | "legal" | "support" | "other";

export const JOB_FAMILIES: { value: JobFamily; label: string }[] = [
  { value: "engineering", label: "Engineering" },
  { value: "data", label: "Data & Analytics" },
  { value: "design", label: "Design" },
  { value: "product", label: "Product" },
  { value: "marketing", label: "Marketing" },
  { value: "sales", label: "Sales & Business Dev" },
  { value: "finance", label: "Finance & Accounting" },
  { value: "operations", label: "Operations" },
  { value: "people", label: "People & HR" },
  { value: "legal", label: "Legal & Compliance" },
  { value: "support", label: "Customer Support" },
  { value: "other", label: "Other" },
];

/**
 * Infer a job's functional family from its title. Ordered most-specific first so
 * "Data Engineer" lands in Data (not Engineering); falls back to "other" when no
 * family keyword matches. Title-only by design — it's the reliable signal.
 */
export function classifyJobFamily(title: string): JobFamily {
  const t = " " + norm(title) + " ";
  if (/\b(data scientist|data engineer|data analyst|machine learning|deep learning|ml|ai|analytics|statistician|business intelligence|bi)\b/.test(t)) return "data";
  if (/\b(engineer|engineering|developer|programmer|swe|sde|devops|sre|sdet|qa|frontend|front end|backend|back end|full stack|fullstack)\b/.test(t)) return "engineering";
  if (/\b(designer|design|ux|ui|creative|illustrator|animator)\b/.test(t)) return "design";
  if (/\b(product manager|product owner|product lead|product management|head of product)\b/.test(t)) return "product";
  if (/\b(sales|account executive|account manager|account director|business development|partnerships|sdr|bdr)\b/.test(t)) return "sales";
  if (/\b(marketing|seo|sem|content|brand|growth|social media|communications|copywriter|pr)\b/.test(t)) return "marketing";
  if (/\b(finance|financial|accountant|accounting|controller|auditor|treasury|bookkeeper)\b/.test(t)) return "finance";
  if (/\b(recruiter|recruiting|talent|human resources|hr|people operations|people ops)\b/.test(t)) return "people";
  if (/\b(legal|lawyer|attorney|counsel|paralegal|compliance)\b/.test(t)) return "legal";
  if (/\b(customer support|customer success|customer service|support|help desk|technical support)\b/.test(t)) return "support";
  if (/\b(operations|ops|logistics|supply chain|procurement|warehouse)\b/.test(t)) return "operations";
  return "other";
}

/* ───────────────────────────── Industry ─────────────────────────────────── */

export type Industry =
  | "technology" | "finance" | "healthcare" | "retail" | "education" | "manufacturing"
  | "media" | "energy" | "realestate" | "government" | "nonprofit" | "other";

export const INDUSTRIES: { value: Industry; label: string }[] = [
  { value: "technology", label: "Technology & Software" },
  { value: "finance", label: "Finance & Insurance" },
  { value: "healthcare", label: "Healthcare & Life Sciences" },
  { value: "retail", label: "Retail & Consumer" },
  { value: "education", label: "Education" },
  { value: "manufacturing", label: "Manufacturing & Industrial" },
  { value: "media", label: "Media & Entertainment" },
  { value: "energy", label: "Energy & Utilities" },
  { value: "realestate", label: "Real Estate & Construction" },
  { value: "government", label: "Government & Public Sector" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "other", label: "Other" },
];

/**
 * Infer the employer's industry from the company name, title, and description.
 * Keyword/heuristic based and best-effort — industry is rarely stated explicitly,
 * so the generic "technology" bucket is checked last (its keywords like "software"
 * appear across many sectors) and undeterminable jobs fall back to "other".
 */
export function classifyIndustry(opts: { company?: string | null; title?: string | null; description?: string | null }): Industry {
  const t = norm(`${opts.company ?? ""} ${opts.title ?? ""} ${opts.description ?? ""}`);
  const has = (re: RegExp) => re.test(t);
  if (has(/\b(hospital|clinic|clinical|pharmaceutical|pharma|biotech|biotechnology|life sciences|medical|medtech|healthcare|health care|patient|therapeutics|nursing)\b/)) return "healthcare";
  if (has(/\b(bank|banking|insurance|investment|hedge fund|asset management|fintech|trading|brokerage|financial services|wealth management|venture capital|private equity)\b/)) return "finance";
  if (has(/\b(university|college|education|edtech|academic|curriculum|e learning|elearning|lecturer|professor)\b/)) return "education";
  if (has(/\b(retail|e commerce|ecommerce|consumer goods|apparel|fashion|merchandising|grocery|restaurant|hospitality|cpg)\b/)) return "retail";
  if (has(/\b(manufacturing|automotive|aerospace|industrial|factory|machinery|semiconductor|electronics|robotics)\b/)) return "manufacturing";
  if (has(/\b(media|entertainment|gaming|video game|publishing|advertising|film|music|streaming|broadcast|journalism)\b/)) return "media";
  if (has(/\b(energy|oil|gas|renewable|solar|wind power|utilities|power grid|nuclear)\b/)) return "energy";
  if (has(/\b(real estate|property management|construction|housing|proptech)\b/)) return "realestate";
  if (has(/\b(government|public sector|federal|municipal|defense|military|civic)\b/)) return "government";
  if (has(/\b(nonprofit|non profit|ngo|charity|foundation|humanitarian|philanthropy)\b/)) return "nonprofit";
  if (has(/\b(software|saas|cloud|platform|technology|tech|cybersecurity|developer|api|data|ai|machine learning|internet|computing|digital)\b/)) return "technology";
  return "other";
}
