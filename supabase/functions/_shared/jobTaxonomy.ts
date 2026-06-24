// Job-family taxonomy for the keyless aggregator search (job-search).
//
// A compact mirror of `classifyJobFamily` in src/lib/jobFilters.ts, duplicated
// here because Supabase Edge Functions (Deno) can't import from the Vite `src`
// tree. Keep the keyword rules in sync with that file — the frontend dropdown
// filters by the same families, so divergence would surface as "I searched
// Legal but got nothing".
//
// Two jobs:
//  1. inferFamily(title)        — bucket a title into one of 12 families.
//  2. museCategoriesForQuery(q) — map a free-text query to The Muse's category
//     facet. The Muse has 400k+ postings spanning every family but NO keyword
//     search, so we reach its non-tech inventory (legal, healthcare, finance,
//     HR, customer service, …) by translating the role into a category.

export type JobFamily =
  | "engineering" | "data" | "design" | "product" | "marketing" | "sales"
  | "finance" | "operations" | "people" | "legal" | "support" | "other";

function norm(s: string): string {
  return " " + s.toLowerCase().replace(/[.,/()\-_|]/g, " ").replace(/\s+/g, " ").trim() + " ";
}

/**
 * Infer a job's functional family from its title. Ordered most-specific first so
 * "Data Engineer" lands in Data (not Engineering); falls back to "other" when no
 * family keyword matches. Mirrors src/lib/jobFilters.ts `classifyJobFamily`.
 */
export function inferFamily(title: string): JobFamily {
  const t = norm(title);
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

/**
 * The single highest-inventory Muse category per family (names verified live
 * against themuse.com/api/public/jobs — all carry 1k+ open postings). A wrong
 * name simply returns zero rows, so this degrades gracefully.
 */
export const MUSE_CATEGORY_BY_FAMILY: Record<Exclude<JobFamily, "other">, string> = {
  engineering: "Software Engineering",
  data: "Data and Analytics",
  design: "Design and UX",
  product: "Product Management",
  marketing: "Advertising and Marketing",
  sales: "Sales",
  finance: "Accounting and Finance",
  operations: "Business Operations",
  people: "Human Resources and Recruitment",
  legal: "Legal Services",
  support: "Customer Service",
};

// Roles that fall into "other" under inferFamily but map cleanly to a Muse
// category — lets the catch-all dropdown family surface real healthcare /
// education / skilled-trade inventory instead of only remote-tech leftovers.
const OTHER_QUERY_CATEGORIES: { re: RegExp; category: string }[] = [
  { re: /\b(nurse|nursing|physician|doctor|clinical|medical|health ?care|therapist|pharmacist|caregiver|dental|surgeon|paramedic|veterinari)/i, category: "Healthcare" },
  { re: /\b(teacher|tutor|professor|lecturer|instructor|educator|faculty|curriculum|teaching|principal)/i, category: "Education" },
  { re: /\b(retail|cashier|store manager|merchandis|sales associate)/i, category: "Retail" },
];

/**
 * Map a free-text role query to the Muse category facet(s) to fetch. Returns the
 * family's category when the query maps to a known family, a best-effort
 * healthcare/education/retail category for common "other" roles, or [] when the
 * query is too generic to target (we then rely on the keyword sources alone).
 */
export function museCategoriesForQuery(query: string): string[] {
  const fam = inferFamily(query);
  if (fam !== "other") return [MUSE_CATEGORY_BY_FAMILY[fam]];
  for (const { re, category } of OTHER_QUERY_CATEGORIES) {
    if (re.test(query)) return [category];
  }
  return [];
}
