/** A company profile owned and edited by an employer account. */
export interface EmployerCompanyProfile {
  id: string;
  name: string;
  tagline?: string;
  website?: string;
  industry?: string;
  /** Headcount band, e.g. "11-50". */
  size?: string;
  headquarters?: string;
  logoUrl?: string;
  /** Long-form, AI-assisted copy fields. */
  about?: string;
  mission?: string;
  culture?: string;
  benefits?: string;
  /** Forward-compat slot for fields not yet promoted to columns. */
  extra?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** The long-form company fields that have an "improve / generate with AI" affordance. */
export type CompanyCopyField = "about" | "mission" | "culture" | "benefits";

export const COMPANY_SIZES: { label: string; value: string }[] = [
  { label: "1-10", value: "1-10" },
  { label: "11-50", value: "11-50" },
  { label: "51-200", value: "51-200" },
  { label: "201-500", value: "201-500" },
  { label: "501-1,000", value: "501-1000" },
  { label: "1,001-5,000", value: "1001-5000" },
  { label: "5,000+", value: "5000+" },
];
