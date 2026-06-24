export type ListingStatus = "draft" | "published" | "closed";

export const LISTING_STATUSES: ListingStatus[] = ["draft", "published", "closed"];

/** Canonical employment types offered in the listing editor dropdown. */
export const EMPLOYMENT_TYPES: { label: string; value: string }[] = [
  { label: "Full-time", value: "Full-time" },
  { label: "Part-time", value: "Part-time" },
  { label: "Contract", value: "Contract" },
  { label: "Internship", value: "Internship" },
  { label: "Temporary", value: "Temporary" },
  { label: "Freelance", value: "Freelance" },
];

export const LISTING_STATUS_META: Record<ListingStatus, { label: string; fg: string; bg: string; border: string }> = {
  draft:     { label: "Draft",     fg: "#71717A", bg: "rgba(113,113,122,0.10)", border: "rgba(113,113,122,0.25)" },
  published: { label: "Published", fg: "#2F6B4F", bg: "rgba(47,107,79,0.12)",   border: "rgba(47,107,79,0.30)" },
  closed:    { label: "Closed",    fg: "#A1A1AA", bg: "rgba(161,161,170,0.10)", border: "rgba(161,161,170,0.22)" },
};

/** AI-generated promotional copy saved onto a listing. */
export interface PromoAssets {
  socialPost?: string;
  outreachEmail?: string;
  blurb?: string;
  /** Richer multi-channel bundle unlocked when a listing is boosted. */
  pack?: PromoPack;
}

/** A boosted listing's enhanced, multi-channel promo bundle. */
export interface PromoPack {
  linkedinPost?: string;
  twitterPost?: string;
  /** Two short A/B variants of the headline blurb. */
  headlineVariants?: string[];
  /** Targeted one-liners aimed at specific candidate segments. */
  targetingBlurbs?: string[];
}

export interface EmployerJobListing {
  id: string;
  companyId: string;
  title: string;
  location?: string;
  employmentType?: string;
  remote?: boolean;
  seniority?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  description?: string;
  requirements?: string;
  responsibilities?: string;
  status: ListingStatus;
  /** ISO timestamp until which a paid boost is active; undefined if never boosted. */
  boostedUntil?: string;
  boostTier?: string;
  promoAssets?: PromoAssets;
  extra?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** True when a listing currently has an unexpired boost. */
export function isBoostActive(boostedUntil?: string): boolean {
  if (!boostedUntil) return false;
  const until = new Date(boostedUntil).getTime();
  return Number.isFinite(until) && until > Date.now();
}

export interface ListingDraftErrors {
  title?: string;
  companyId?: string;
  salary?: string;
}

/**
 * Validate a listing before save. Title and company are required; salary bounds
 * (when present) must be non-negative and, if both are set, max must be ≥ min.
 */
export function validateListingDraft(draft: {
  title?: string;
  companyId?: string;
  salaryMin?: number;
  salaryMax?: number;
}): ListingDraftErrors {
  const errors: ListingDraftErrors = {};
  if (!draft.title?.trim()) errors.title = "A job title is required.";
  if (!draft.companyId) errors.companyId = "Choose a company for this listing.";

  const minSet = typeof draft.salaryMin === "number" && !Number.isNaN(draft.salaryMin);
  const maxSet = typeof draft.salaryMax === "number" && !Number.isNaN(draft.salaryMax);
  if ((minSet && (draft.salaryMin as number) < 0) || (maxSet && (draft.salaryMax as number) < 0)) {
    errors.salary = "Salary can't be negative.";
  } else if (minSet && maxSet && (draft.salaryMax as number) < (draft.salaryMin as number)) {
    errors.salary = "Maximum salary must be greater than or equal to the minimum.";
  }
  return errors;
}
