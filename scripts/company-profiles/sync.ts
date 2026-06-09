/**
 * Sync committed company profiles into the DB. Runs after a profile PR is merged
 * to main (see company-profiles-sync.yml) — this is the step that "pushes the
 * data into the DB" for reviewed additions. Service-role upsert; idempotent.
 *
 * (For automatic WEEKLY refresh of companies already in the app, see refresh.ts,
 * which fetches and upserts directly — no PR.)
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/company-profiles/sync.ts
 *   npx tsx scripts/company-profiles/sync.ts --dry-run   # print, don't write
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DIR } from "./list.ts";
import { getAdmin, upsertProfiles } from "./db.ts";
import type { CompanyProfile } from "../../src/types/companyProfile.ts";

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

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const profiles = loadProfiles();
  console.log(`Found ${profiles.length} committed profiles.`);
  if (!profiles.length) return;

  if (dryRun) {
    for (const p of profiles) console.log(`  would upsert ${p.slug} (${p.name})`);
    return;
  }

  const admin = await getAdmin();
  if (!admin) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

  const synced = await upsertProfiles(admin, profiles);

  // Mark any matching requests as fulfilled.
  const slugs = profiles.map((p) => p.slug);
  await admin.from("company_profile_requests").update({ status: "done" }).in("status", ["pending", "processing"]).in("company_slug", slugs);

  console.log(`Synced ${synced} profiles into company_profiles.`);
}

// Run only as a CLI entrypoint — not when imported.
if (!process.env.VITEST) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
