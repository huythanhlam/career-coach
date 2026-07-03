// Company logo resolution — keyless, no API token required.
//
// We derive the company's web domain (preferring its own careers domain from the
// job URL, otherwise guessing from the company name) and return an ordered list of
// logo URLs to try: Clearbit's public logo CDN first (clean square logos), then
// Google's favicon service as a reliable fallback. The UI falls back to a letter
// monogram if every source fails, so a logo slot is always filled.

// Hosts that are applicant-tracking systems / aggregators, NOT the employer's own
// site — their domain would yield the ATS logo, so we derive from the name instead.
const ATS_HOSTS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workable.com",
  "smartrecruiters.com",
  "myworkdayjobs.com",
  "workday.com",
  "remotive.com",
  "remoteok.com",
  "remoteok.io",
  "bamboohr.com",
  "jobvite.com",
  "icims.com",
  "taleo.net",
  "breezy.hr",
  "recruitee.com",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
];

const NAME_SUFFIXES =
  /\b(inc|incorporated|corp|corporation|company|co|group|holdings|llc|ltd|limited|plc|gmbh|sa|ag|nv|bv)\b/g;

/** Best-effort web domain for a company, used to look up its logo. */
export function logoDomain(company?: string | null, jobUrl?: string | null): string | null {
  // 1) The employer's own domain, if the posting lives on it (not an ATS).
  if (jobUrl) {
    try {
      const host = new URL(jobUrl).hostname.replace(/^www\./, "").toLowerCase();
      if (host && !ATS_HOSTS.some((a) => host === a || host.endsWith(`.${a}`))) return host;
    } catch {
      /* not a valid URL — fall through to name */
    }
  }
  // 2) Guess from the company name: "McDonald's" → mcdonalds.com, "Bosch" → bosch.com.
  const name = (company ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(NAME_SUFFIXES, " ")
    .replace(/[^a-z0-9]+/g, "");
  return name ? `${name}.com` : null;
}

/** Ordered logo image URLs to try for a company. Empty when nothing can be derived. */
export function companyLogoSources(company?: string | null, jobUrl?: string | null): string[] {
  const domain = logoDomain(company, jobUrl);
  if (!domain) return [];
  return [
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ];
}

const MONOGRAM_COLORS = [
  "#D97757",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#6366F1",
  "#EF4444",
  "#0EA5E9",
];

/** Stable accent color + initial for a company's fallback monogram. */
export function companyMonogram(company?: string | null): { letter: string; color: string } {
  const name = (company ?? "").trim();
  const letter = name ? name.charAt(0).toUpperCase() : "?";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return { letter, color: MONOGRAM_COLORS[hash % MONOGRAM_COLORS.length] };
}
