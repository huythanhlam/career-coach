/**
 * Read-side access to the DETERMINISTIC company profiles (the reliable, non-AI
 * data). The Research Company workspace consults this first and only falls back
 * to the legacy AI path when no profile exists yet.
 */
import { supabase } from "@/lib/supabaseClient";
import { canonicalCompanyName } from "@/data/popularCompanies";
import type { CompanyProfile } from "@/types/companyProfile";

/** Mirror of scripts/company-profiles/lib.ts slugify() (kept in sync). */
export function slugifyCompany(name: string): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

// Profiles are rebuilt offline and change rarely, so a short in-memory TTL
// cache (misses included) avoids a Supabase round-trip per company per render.
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const profileCache = new Map<string, { data: CompanyProfile | null; ts: number }>();

/**
 * Look up a deterministic profile by company name. Canonicalizes aliases
 * ("Google" → "Alphabet (Google)") before slugifying so we hit the same row
 * regardless of how the user typed it. Returns null on miss.
 */
export async function getCompanyProfile(name: string): Promise<CompanyProfile | null> {
  const slug = slugifyCompany(canonicalCompanyName(name));
  if (!slug) return null;
  const cached = profileCache.get(slug);
  if (cached && Date.now() - cached.ts < PROFILE_CACHE_TTL_MS) return cached.data;
  try {
    const { data, error } = await supabase
      .from("company_profiles")
      .select("data")
      .eq("slug", slug)
      .maybeSingle();
    const profile = error || !data?.data ? null : (data.data as CompanyProfile);
    profileCache.set(slug, { data: profile, ts: Date.now() });
    return profile;
  } catch {
    return null;
  }
}

/** Lightweight row for the "browse companies" grid. */
export interface CompanyProfileSummary {
  slug: string;
  name: string;
  logoUrl?: string;
  industry?: string;
}

/**
 * List the companies that already have a deterministic profile in the app
 * (the `company_profiles` library), for the browse view. Returns [] on error
 * or when the table is empty.
 */
export async function listCompanyProfiles(): Promise<CompanyProfileSummary[]> {
  try {
    const { data, error } = await supabase
      .from("company_profiles")
      .select("slug, name, logoUrl:data->>logoUrl, industry:data->keyFacts->>industry")
      .order("name");
    if (error || !data) return [];
    return (
      data as { slug: string; name: string; logoUrl: string | null; industry: string | null }[]
    ).map((r) => ({
      slug: r.slug,
      name: r.name,
      logoUrl: r.logoUrl ?? undefined,
      industry: r.industry ?? undefined,
    }));
  } catch {
    return [];
  }
}

export type RequestProfileResult = "queued" | "exists" | "duplicate" | "error";

/**
 * Ask for a company to be added to the defined list. Inserts a pending request
 * (via the RPC) that the build routine will pick up and turn into a PR.
 */
export async function requestCompanyProfile(name: string): Promise<RequestProfileResult> {
  try {
    const { data, error } = await supabase.rpc("request_company_profile", { p_company: name });
    if (error) return "error";
    return (data as RequestProfileResult) ?? "queued";
  } catch {
    return "error";
  }
}
