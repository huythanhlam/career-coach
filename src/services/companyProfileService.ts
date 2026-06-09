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

/**
 * Look up a deterministic profile by company name. Canonicalizes aliases
 * ("Google" → "Alphabet (Google)") before slugifying so we hit the same row
 * regardless of how the user typed it. Returns null on miss.
 */
export async function getCompanyProfile(name: string): Promise<CompanyProfile | null> {
  const slug = slugifyCompany(canonicalCompanyName(name));
  if (!slug) return null;
  try {
    const { data, error } = await supabase
      .from("company_profiles")
      .select("data")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data?.data) return null;
    return data.data as CompanyProfile;
  } catch {
    return null;
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
