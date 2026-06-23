// One-off coverage check for the keyless Job Postings sources.
//
// Replicates what supabase/functions/job-search does (Workable global, Remotive,
// Jobicy, Arbeitnow keyword search + The Muse category search) against the LIVE
// APIs, then buckets every returned posting by job family exactly as the app's
// dropdown filter does. Prints a per-family table so we can confirm all 12
// families return real inventory.
//
//   npx tsx scripts/verify-job-sources.ts
//
// Not part of CI — it makes real network calls. Run manually when touching the
// sources or the taxonomy.

import { inferFamily, museCategoriesForQuery, type JobFamily } from "../supabase/functions/_shared/jobTaxonomy.ts";

const UA = { "User-Agent": "TechCoachBot/1.0", Accept: "application/json" };

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

type Row = { title: string; provider: string };

async function workable(q: string): Promise<Row[]> {
  const d = await getJson(`https://jobs.workable.com/api/v1/jobs?query=${encodeURIComponent(q)}`);
  return (d.jobs ?? []).map((j: any) => ({ title: j.title ?? "", provider: "Workable" }));
}
async function remotive(q: string): Promise<Row[]> {
  const d = await getJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=25`);
  return (d.jobs ?? []).map((j: any) => ({ title: j.title ?? "", provider: "Remotive" }));
}
async function jobicy(q: string): Promise<Row[]> {
  const d = await getJson(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(q)}`);
  return (d.jobs ?? []).map((j: any) => ({ title: j.jobTitle ?? "", provider: "Jobicy" }));
}
async function arbeitnow(q: string): Promise<Row[]> {
  const d = await getJson(`https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(q)}`);
  return (d.data ?? []).map((j: any) => ({ title: j.title ?? "", provider: "Arbeitnow" }));
}
async function muse(q: string): Promise<Row[]> {
  const cats = museCategoriesForQuery(q);
  const out: Row[] = [];
  for (const c of cats.slice(0, 2)) {
    for (let p = 0; p < 2; p++) {
      const d = await getJson(`https://www.themuse.com/api/public/jobs?category=${encodeURIComponent(c)}&page=${p}`);
      for (const j of d.results ?? []) out.push({ title: j.name ?? "", provider: "The Muse" });
      if ((d.results ?? []).length < 20) break;
    }
  }
  return out;
}

// One representative query per dropdown family.
const QUERIES: { family: JobFamily; query: string }[] = [
  { family: "engineering", query: "software engineer" },
  { family: "data", query: "data analyst" },
  { family: "design", query: "product designer" },
  { family: "product", query: "product manager" },
  { family: "marketing", query: "marketing manager" },
  { family: "sales", query: "account executive" },
  { family: "finance", query: "financial analyst" },
  { family: "operations", query: "operations manager" },
  { family: "people", query: "recruiter" },
  { family: "legal", query: "lawyer" },
  { family: "support", query: "customer support" },
  { family: "other", query: "registered nurse" },
];

async function run() {
  let allCovered = true;
  console.log("family        query                 inFamily  byProvider");
  console.log("─".repeat(78));
  for (const { family, query } of QUERIES) {
    const settled = await Promise.allSettled([
      workable(query), remotive(query), jobicy(query), arbeitnow(query), muse(query),
    ]);
    const rows = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
    const inFamily = rows.filter((r) => r.title && inferFamily(r.title) === family);
    const byProvider: Record<string, number> = {};
    for (const r of inFamily) byProvider[r.provider] = (byProvider[r.provider] ?? 0) + 1;
    const ok = inFamily.length > 0;
    if (!ok) allCovered = false;
    const provStr = Object.entries(byProvider).map(([p, n]) => `${p}:${n}`).join(" ") || "—";
    console.log(
      `${ok ? "✓" : "✗"} ${family.padEnd(11)} ${query.padEnd(21)} ${String(inFamily.length).padStart(4)}     ${provStr}`,
    );
  }
  console.log("─".repeat(78));
  console.log(allCovered ? "ALL 12 FAMILIES COVERED ✓" : "SOME FAMILIES EMPTY ✗");
  process.exit(allCovered ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
