/**
 * Direct weekly refresh: for every company already in the app (the defined
 * list), fetch its research from the structured sources and UPSERT it straight
 * into the company_profiles table — no PR, no commit. This is the automated
 * "fetch all the company research and store it in the DB, weekly" process.
 *
 * (The PR-gated build.ts + sync.ts flow remains for REVIEWING new additions.)
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/company-profiles/refresh.ts
 *   npx tsx scripts/company-profiles/refresh.ts --only apple,microsoft
 *   npx tsx scripts/company-profiles/refresh.ts --limit 40        # cron batching
 *   npx tsx scripts/company-profiles/refresh.ts --dry-run         # fetch + print, don't write
 */
import { realHttpGet, sleep } from "./lib.ts";
import { loadList, filterTargets, parseListArgs } from "./list.ts";
import { loadTickerMap } from "./sources/sec.ts";
import { buildProfile } from "./buildProfile.ts";
import { getAdmin, upsertProfiles } from "./db.ts";
import type { CompanyProfile } from "../../src/types/companyProfile.ts";

const DELAY_MS = 400; // polite gap between companies

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const { only, limit } = parseListArgs(argv);

  const targets = filterTargets(loadList(), { only, limit });
  if (!targets.length) { console.log("No companies in the list to refresh."); return; }

  const admin = dryRun ? null : await getAdmin();
  if (!dryRun && !admin) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (use --dry-run to fetch without writing).");
    process.exit(1);
  }

  console.log(`Refreshing ${targets.length} compan${targets.length === 1 ? "y" : "ies"}${dryRun ? " (dry run)" : ""}…`);
  const tickerMap = await loadTickerMap(realHttpGet).catch(() => ({}));

  const profiles: CompanyProfile[] = [];
  let ok = 0;
  for (const entry of targets) {
    try {
      const profile = await buildProfile(entry, { httpGet: realHttpGet, tickerMap });
      profiles.push(profile);
      const facts = [profile.overview && "overview", profile.financials.length && "financials", profile.news.length && "news"].filter(Boolean).join("+") || "links-only";
      console.log(`  ✓ ${entry.slug} (${facts})`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${entry.slug}: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(DELAY_MS);
  }

  if (dryRun) {
    console.log(`Dry run: fetched ${ok}/${targets.length}; would upsert ${profiles.length} into company_profiles.`);
    return;
  }

  const synced = await upsertProfiles(admin!, profiles);
  console.log(`Done: fetched ${ok}/${targets.length}, upserted ${synced} into company_profiles.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
