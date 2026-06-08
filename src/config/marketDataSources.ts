/**
 * Curated registry of authoritative compensation & cost-of-living sources.
 *
 * The Market Compensation workflow is AI-generated, so to keep figures grounded
 * we hand the model a short list of real, well-known publishers (with resolvable
 * URLs) and ask it to attribute each metric to one of them rather than inventing
 * citations. `buildSourceGuidance()` produces the prompt fragment injected per
 * request based on the chosen role + location(s).
 */

export interface SourceLink {
  label: string;
  url: string;
}

/** Canonical salary / total-compensation publishers. */
export const COMPENSATION_SOURCES: SourceLink[] = [
  { label: "Levels.fyi", url: "https://www.levels.fyi" },
  { label: "BLS OEWS", url: "https://www.bls.gov/oes/" },
  { label: "Glassdoor Salaries", url: "https://www.glassdoor.com/Salaries/index.htm" },
  { label: "Robert Half Salary Guide", url: "https://www.roberthalf.com/us/en/insights/salary-guide" },
  { label: "Stack Overflow Developer Survey", url: "https://survey.stackoverflow.co/" },
  { label: "Hired State of Salaries", url: "https://hired.com/state-of-salaries-report/" },
];

/**
 * Canonical cost-of-living publishers — government / official statistics first.
 * Numbeo and other crowd-sourced sites are intentionally excluded in favour of
 * authoritative U.S. government data.
 */
export const COST_OF_LIVING_SOURCES: SourceLink[] = [
  { label: "BLS Consumer Expenditure Survey", url: "https://www.bls.gov/cex/" },
  { label: "BEA Regional Price Parities", url: "https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area" },
  { label: "HUD Fair Market Rents", url: "https://www.huduser.gov/portal/datasets/fmr.html" },
  { label: "BLS Consumer Price Index (CPI)", url: "https://www.bls.gov/cpi/" },
];

/**
 * Per-location wage references: the BLS OEWS metro page for each market (real,
 * stable government deep links). Government cost-of-living sources are added
 * globally via COST_OF_LIVING_SOURCES. Keyed by the exact values in
 * COMMON_LOCATIONS (src/config/workflows.ts).
 */
export const LOCATION_SOURCE_MAP: Record<string, SourceLink[]> = {
  "San Francisco, CA": [
    { label: "BLS OEWS — San Francisco metro", url: "https://www.bls.gov/oes/current/oes_41860.htm" },
  ],
  "New York, NY": [
    { label: "BLS OEWS — New York metro", url: "https://www.bls.gov/oes/current/oes_35620.htm" },
  ],
  "Seattle, WA": [
    { label: "BLS OEWS — Seattle metro", url: "https://www.bls.gov/oes/current/oes_42660.htm" },
  ],
  "Austin, TX": [
    { label: "BLS OEWS — Austin metro", url: "https://www.bls.gov/oes/current/oes_12420.htm" },
  ],
  "Boston, MA": [
    { label: "BLS OEWS — Boston metro", url: "https://www.bls.gov/oes/current/oes_14460.htm" },
  ],
  "Los Angeles, CA": [
    { label: "BLS OEWS — Los Angeles metro", url: "https://www.bls.gov/oes/current/oes_31080.htm" },
  ],
  "London, UK": [
    { label: "ONS — UK inflation & cost of living", url: "https://www.ons.gov.uk/economy/inflationandpriceindices" },
    { label: "Glassdoor UK Salaries", url: "https://www.glassdoor.co.uk/Salaries/index.htm" },
  ],
  "Remote (US)": [
    { label: "BLS OEWS — National", url: "https://www.bls.gov/oes/current/oes_nat.htm" },
  ],
};

/** Levels.fyi role landing pages for the most common tech roles. */
const ROLE_SOURCE_MAP: Record<string, SourceLink> = {
  "Software Engineer": { label: "Levels.fyi — Software Engineer", url: "https://www.levels.fyi/t/software-engineer" },
  "Frontend Engineer": { label: "Levels.fyi — Software Engineer", url: "https://www.levels.fyi/t/software-engineer" },
  "Backend Engineer": { label: "Levels.fyi — Software Engineer", url: "https://www.levels.fyi/t/software-engineer" },
  "Full Stack Engineer": { label: "Levels.fyi — Software Engineer", url: "https://www.levels.fyi/t/software-engineer" },
  "Product Manager": { label: "Levels.fyi — Product Manager", url: "https://www.levels.fyi/t/product-manager" },
  "Data Scientist": { label: "Levels.fyi — Data Scientist", url: "https://www.levels.fyi/t/data-scientist" },
  "Data Engineer": { label: "Levels.fyi — Software Engineer", url: "https://www.levels.fyi/t/software-engineer" },
  "Machine Learning Engineer": { label: "Levels.fyi — ML Engineer", url: "https://www.levels.fyi/t/software-engineer/focus/ml-ai" },
  "DevOps Engineer": { label: "Levels.fyi — Software Engineer", url: "https://www.levels.fyi/t/software-engineer" },
  "Engineering Manager": { label: "Levels.fyi — Engineering Manager", url: "https://www.levels.fyi/t/engineering-manager" },
  "UX/UI Designer": { label: "Levels.fyi — Product Designer", url: "https://www.levels.fyi/t/product-designer" },
  "QA Engineer": { label: "Levels.fyi — Software Engineer", url: "https://www.levels.fyi/t/software-engineer" },
};

function dedupe(links: SourceLink[]): SourceLink[] {
  const seen = new Set<string>();
  return links.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)));
}

/**
 * Collect the preferred source links for a given role + location(s) — used both
 * for prompt guidance and as a fallback reference list in the UI.
 */
export function getSourcesFor(role?: string, location?: string, secondaryLocation?: string): SourceLink[] {
  const links: SourceLink[] = [];
  if (role && ROLE_SOURCE_MAP[role]) links.push(ROLE_SOURCE_MAP[role]);
  for (const loc of [location, secondaryLocation]) {
    if (loc && LOCATION_SOURCE_MAP[loc]) links.push(...LOCATION_SOURCE_MAP[loc]);
  }
  // Always include the top general comp anchors + government cost-of-living anchors.
  links.push(COMPENSATION_SOURCES[0], COMPENSATION_SOURCES[1], COST_OF_LIVING_SOURCES[0], COST_OF_LIVING_SOURCES[1]);
  return dedupe(links);
}

/**
 * Prompt fragment instructing the model to ground citations in the curated
 * sources for the selected role + location(s).
 */
export function buildSourceGuidance(role?: string, location?: string, secondaryLocation?: string): string {
  const links = getSourcesFor(role, location, secondaryLocation);
  const list = links.map((l) => `- ${l.label}: ${l.url}`).join("\n");
  return `\n\nPREFERRED SOURCES — attribute each metric's \`source\` to one of these real publishers (use the exact label and URL; do NOT invent URLs). If you rely on another well-known publisher, use its real homepage URL.\n${list}\n`;
}
