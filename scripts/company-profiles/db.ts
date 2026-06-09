/**
 * Shared DB helpers for the company-profile pipeline. Importing this module has
 * no side effects (unlike the CLI scripts), so it's safe to use from sync.ts,
 * refresh.ts, build.ts, and tests.
 */
import type { CompanyProfile } from "../../src/types/companyProfile.ts";

/** Loose handle to the Supabase service-role client (real type lives in supabase-js). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AdminClient = { from: (table: string) => any; rpc?: (fn: string, args: Record<string, unknown>) => Promise<any> };

/** Row shape for the company_profiles table. */
export function toRow(p: CompanyProfile) {
  return {
    slug: p.slug,
    name: p.name,
    data: p as unknown as Record<string, unknown>,
    sources: p.sources,
    fetched_at: p.fetchedAt,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Build a service-role Supabase client from env, or null when env is absent.
 * Loaded dynamically so scripts without DB access don't need the dependency.
 */
export async function getAdmin(): Promise<AdminClient | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false } }) as unknown as AdminClient;
}

/** Upsert profiles into company_profiles in bounded chunks. */
export async function upsertProfiles(admin: AdminClient, profiles: CompanyProfile[], chunk = 50): Promise<number> {
  const rows = profiles.map(toRow);
  let synced = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const batch = rows.slice(i, i + chunk);
    const { error } = await admin.from("company_profiles").upsert(batch, { onConflict: "slug" });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
    synced += batch.length;
  }
  return synced;
}
