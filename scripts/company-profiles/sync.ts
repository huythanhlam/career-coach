/**
 * Sync committed company profiles into the DB. Runs after a profile PR is merged
 * to main (see company-profiles-sync.yml) — this is the step that "pushes the
 * data into the DB". Service-role upsert; idempotent.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/company-profiles/sync.ts
 *   npx tsx scripts/company-profiles/sync.ts --dry-run   # print, don't write
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CompanyProfile } from "../../src/types/companyProfile.ts";

const DIR = join(process.cwd(), "data", "companyProfiles");

function loadProfiles(): CompanyProfile[] {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const out: CompanyProfile[] = [];
  for (const f of files) {
    try {
      const p = JSON.parse(readFileSync(join(DIR, f), "utf8")) as CompanyProfile;
      if (p?.slug && p?.name) out.push(p);
    } catch (e) {
      console.warn(`• Skipping ${f}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}

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

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const profiles = loadProfiles();
  console.log(`Found ${profiles.length} committed profiles.`);
  if (!profiles.length) return;

  if (dryRun) {
    for (const p of profiles) console.log(`  would upsert ${p.slug} (${p.name})`);
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const rows = profiles.map(toRow);
  // Upsert in chunks to stay well under payload limits.
  const CHUNK = 50;
  let synced = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await admin.from("company_profiles").upsert(batch, { onConflict: "slug" });
    if (error) { console.error("Upsert failed:", error.message); process.exit(1); }
    synced += batch.length;
  }

  // Mark any matching requests as fulfilled.
  const slugs = profiles.map((p) => p.slug);
  await admin.from("company_profile_requests").update({ status: "done" }).in("status", ["pending", "processing"]).in("company_slug", slugs);

  console.log(`Synced ${synced} profiles into company_profiles.`);
}

// Run only as a CLI entrypoint — not when imported (e.g. by tests for `toRow`).
if (!process.env.VITEST) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
