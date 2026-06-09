/**
 * Shared access to the defined company list + JSON profile files. No side
 * effects on import.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { CompanyListEntry } from "../../src/types/companyProfile.ts";

export const DIR = join(process.cwd(), "data", "companyProfiles");
export const LIST_FILE = join(DIR, "_list.json");

export function ensureDir(): void {
  mkdirSync(DIR, { recursive: true });
}

export function loadList(): CompanyListEntry[] {
  if (!existsSync(LIST_FILE)) return [];
  return JSON.parse(readFileSync(LIST_FILE, "utf8")) as CompanyListEntry[];
}

export function saveList(list: CompanyListEntry[]): void {
  const sorted = [...list].sort((a, b) => a.slug.localeCompare(b.slug));
  writeFileSync(LIST_FILE, JSON.stringify(sorted, null, 2) + "\n");
}

/** Filter the list by an optional slug allow-list and an optional cap. Pure. */
export function filterTargets(
  list: CompanyListEntry[],
  opts: { only?: string[]; limit?: number } = {},
): CompanyListEntry[] {
  let out = list;
  if (opts.only && opts.only.length) {
    const set = new Set(opts.only);
    out = out.filter((e) => set.has(e.slug));
  }
  if (opts.limit && opts.limit > 0) out = out.slice(0, opts.limit);
  return out;
}

/** Parse the shared CLI flags: --only a,b  --limit N. */
export function parseListArgs(argv: string[]): { only?: string[]; limit?: number } {
  const out: { only?: string[]; limit?: number } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") out.only = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === "--limit") out.limit = Number(argv[++i]);
  }
  return out;
}
