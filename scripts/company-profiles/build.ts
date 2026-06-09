/**
 * Build/refresh deterministic company profiles and write them as committed JSON
 * (`data/companyProfiles/<slug>.json`). This is the "method" the routine runs;
 * its output is what a PR pushes for review.
 *
 * Sources of work:
 *   - the defined list (`_list.json`), and
 *   - pending rows in `company_profile_requests` (when Supabase env is present),
 *     which are appended to the list and marked `processing`.
 *
 * Usage:
 *   npx tsx scripts/company-profiles/build.ts                 # whole list (+ requests)
 *   npx tsx scripts/company-profiles/build.ts --only apple,meta
 *   npx tsx scripts/company-profiles/build.ts --requests-only # only pending requests
 *   npx tsx scripts/company-profiles/build.ts --limit 20      # cap (for cron batches)
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { realHttpGet, slugify, sleep } from "./lib.ts";
import { loadTickerMap } from "./sources/sec.ts";
import { buildProfile } from "./buildProfile.ts";
import type { CompanyListEntry, CompanyProfile } from "../../src/types/companyProfile.ts";

const DIR = join(process.cwd(), "data", "companyProfiles");
const LIST_FILE = join(DIR, "_list.json");
const DELAY_MS = 400; // polite gap between companies

interface Args { only?: string[]; limit?: number; requestsOnly: boolean }

function parseArgs(argv: string[]): Args {
  const args: Args = { requestsOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") args.only = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === "--limit") args.limit = Number(argv[++i]);
    else if (argv[i] === "--requests-only") args.requestsOnly = true;
  }
  return args;
}

function loadList(): CompanyListEntry[] {
  if (!existsSync(LIST_FILE)) return [];
  return JSON.parse(readFileSync(LIST_FILE, "utf8")) as CompanyListEntry[];
}

function saveList(list: CompanyListEntry[]): void {
  const sorted = [...list].sort((a, b) => a.slug.localeCompare(b.slug));
  writeFileSync(LIST_FILE, JSON.stringify(sorted, null, 2) + "\n");
}

/** Optional Supabase admin client (service role). Returns null without env. */
async function getAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Pull pending requests, merge new companies into the list, mark them processing. */
async function intakeRequests(list: CompanyListEntry[]): Promise<CompanyListEntry[]> {
  const admin = await getAdmin();
  if (!admin) {
    console.log("• No Supabase env — skipping request intake.");
    return [];
  }
  const { data, error } = await admin
    .from("company_profile_requests")
    .select("id, company")
    .eq("status", "pending")
    .limit(50);
  if (error) { console.warn("• Request intake failed:", error.message); return []; }

  const known = new Set(list.map((e) => e.slug));
  const added: CompanyListEntry[] = [];
  const ids: number[] = [];
  for (const row of data ?? []) {
    const name = String(row.company ?? "").trim();
    const slug = slugify(name);
    if (!slug) continue;
    ids.push(row.id);
    if (!known.has(slug)) {
      const entry: CompanyListEntry = { slug, name };
      list.push(entry);
      added.push(entry);
      known.add(slug);
    }
  }
  if (ids.length) await admin.from("company_profile_requests").update({ status: "processing" }).in("id", ids);
  if (added.length) { saveList(list); console.log(`• Intake added ${added.length} requested companies.`); }
  return added;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(DIR, { recursive: true });

  const list = loadList();
  const requested = await intakeRequests(list);

  let targets: CompanyListEntry[];
  if (args.requestsOnly) targets = requested;
  else if (args.only) targets = list.filter((e) => args.only!.includes(e.slug));
  else targets = list;
  if (args.limit) targets = targets.slice(0, args.limit);

  if (!targets.length) { console.log("Nothing to build."); return; }
  console.log(`Building ${targets.length} profile(s)…`);

  const tickerMap = await loadTickerMap(realHttpGet).catch(() => ({}));
  let ok = 0;
  for (const entry of targets) {
    try {
      const profile: CompanyProfile = await buildProfile(entry, { httpGet: realHttpGet, tickerMap });
      writeFileSync(join(DIR, `${entry.slug}.json`), JSON.stringify(profile, null, 2) + "\n");
      const facts = [profile.overview && "overview", profile.financials.length && "financials", profile.news.length && "news"].filter(Boolean).join("+") || "links-only";
      console.log(`  ✓ ${entry.slug} (${facts})`);
      ok++;
    } catch (e) {
      console.error(`  ✗ ${entry.slug}: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`Done: ${ok}/${targets.length} profiles written to ${DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
