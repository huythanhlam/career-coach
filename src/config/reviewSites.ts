/**
 * Verified employee-review LINKS (no scores). We deliberately do NOT show rating
 * numbers: Glassdoor/Indeed/Blind/Comparably expose no free, reliable rating API,
 * so any precise score would be a guess. Instead we link the user straight to the
 * real source to read the current, authoritative rating themselves.
 *
 * Pure + dependency-free so both the app and the scripts pipeline can use it.
 */
export interface ReviewLink {
  label: string;
  url: string;
}

export function buildReviewLinks(company: string): ReviewLink[] {
  const c = (company ?? "").trim();
  const q = encodeURIComponent(c);
  const dashed = encodeURIComponent(c.replace(/\s+/g, "-"));
  const slug = c
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return [
    {
      label: "Glassdoor reviews",
      url: `https://www.glassdoor.com/Search/results.htm?keyword=${q}`,
    },
    { label: "Indeed company reviews", url: `https://www.indeed.com/cmp/${dashed}/reviews` },
    { label: "Blind", url: `https://www.teamblind.com/search/${q}` },
    { label: "Comparably", url: `https://www.comparably.com/companies/${slug}` },
  ];
}
