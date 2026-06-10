/**
 * One-off seed: derive the defined company list (`data/companyProfiles/_list.json`)
 * from the existing curated POPULAR_COMPANIES. After this, `_list.json` is the
 * independent source of truth that PRs add to.
 *
 *   npx tsx scripts/company-profiles/seedList.ts
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { POPULAR_COMPANIES } from "../../src/data/popularCompanies.ts";
import { slugify } from "./lib.ts";
import type { CompanyListEntry } from "../../src/types/companyProfile.ts";

const OUT_DIR = join(process.cwd(), "data", "companyProfiles");
const OUT_FILE = join(OUT_DIR, "_list.json");

function buildList(): CompanyListEntry[] {
  const bySlug = new Map<string, CompanyListEntry>();
  for (const c of POPULAR_COMPANIES) {
    const slug = slugify(c.name);
    if (!slug || bySlug.has(slug)) continue;
    const entry: CompanyListEntry = { slug, name: c.name };
    if (c.ticker) entry.ticker = c.ticker;
    bySlug.set(slug, entry);
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const list = buildList();

  // Preserve any manual edits (wikidataTitle, etc.) already present.
  if (existsSync(OUT_FILE)) {
    const existing = JSON.parse(readFileSync(OUT_FILE, "utf8")) as CompanyListEntry[];
    const prev = new Map(existing.map((e) => [e.slug, e]));
    for (const e of list) {
      const p = prev.get(e.slug);
      if (p?.wikidataTitle) e.wikidataTitle = p.wikidataTitle;
      if (p?.ticker && !e.ticker) e.ticker = p.ticker;
    }
  }

  writeFileSync(OUT_FILE, JSON.stringify(list, null, 2) + "\n");
  console.log(`Wrote ${list.length} companies to ${OUT_FILE}`);
}

main();
