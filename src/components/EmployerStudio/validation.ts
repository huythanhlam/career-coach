import type { EmployerCompanyProfile } from "@/types/employerProfile";

/** Field-level errors for the company profile editor, keyed by field name. */
export interface CompanyDraftErrors {
  name?: string;
  tagline?: string;
  website?: string;
  logoUrl?: string;
}

const MAX_NAME = 100;
const MAX_TAGLINE = 160;

/** True when `value` parses as an absolute http(s) URL. */
export function isValidHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

/**
 * Validate a company profile before save. Name is required; the website and logo
 * URLs, when provided, must be absolute http(s) URLs.
 */
export function validateCompanyDraft(draft: Partial<EmployerCompanyProfile>): CompanyDraftErrors {
  const errors: CompanyDraftErrors = {};

  const name = draft.name?.trim() ?? "";
  if (!name) errors.name = "A company name is required.";
  else if (name.length > MAX_NAME) errors.name = `Keep the name under ${MAX_NAME} characters.`;

  if ((draft.tagline?.trim().length ?? 0) > MAX_TAGLINE) {
    errors.tagline = `Keep the tagline under ${MAX_TAGLINE} characters.`;
  }

  if (draft.website?.trim() && !isValidHttpUrl(draft.website)) {
    errors.website = "Enter a valid URL starting with http:// or https://.";
  }
  if (draft.logoUrl?.trim() && !isValidHttpUrl(draft.logoUrl)) {
    errors.logoUrl = "Enter a valid image URL starting with http:// or https://.";
  }

  return errors;
}
