import { createClient } from "npm:@supabase/supabase-js@2";

// ── Weekly "Suggested this week" refresher ─────────────────────────────────
// Triggered by pg_cron (see migration). For every user with target roles, runs
// the same keyless discovery (scan-jobs + job-search) server-to-server, dedupes
// against what they've already saved, and replaces their status='suggested'
// rows. The user reviews these in the Suggested lane and Saves the good ones.
// No AI involved — just the free ATS/Workable endpoints.
//
// Profiles saved before target-role auto-derivation shipped (see
// src/lib/targetRoleDerivation.ts) may still have empty target_roles despite
// having a resume/work history — normally that gap closes on their next
// profile save, but this backfills it here too so existing users don't have
// to touch their profile to start getting suggestions. Mirrors the priority
// order of the client-side helper (target_role, then most-recent work
// history) without pulling in the TS module — Edge Functions in this repo
// are self-contained, matching scan-jobs/job-search.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const MAX_ROLES_PER_USER = 3;
const MAX_SUGGESTIONS_PER_USER = 30;

interface DiscoveredJob {
  title: string;
  company?: string | null;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  externalId?: string | null;
  employmentType?: string | null;
  remote?: boolean | null;
  source: string;
}

interface WorkHistoryEntry {
  role?: string;
  current?: boolean;
}

/** Minimal mirror of src/lib/targetRoleDerivation.ts's priority order. */
function deriveTargetRolesInline(
  targetRole: string | null,
  workHistory: unknown,
): { id: string; title: string }[] {
  const candidates: string[] = [];
  if (targetRole?.trim()) candidates.push(targetRole.trim());
  const history = Array.isArray(workHistory) ? (workHistory as WorkHistoryEntry[]) : [];
  const currentFirst = [...history].sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0));
  for (const w of currentFirst) {
    if (w.role?.trim()) candidates.push(w.role.trim());
  }

  const seen = new Set<string>();
  const roles: { id: string; title: string }[] = [];
  for (const title of candidates) {
    const key = title.trim().toLowerCase().replace(/\s+/g, " ");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    roles.push({ id: crypto.randomUUID(), title });
    if (roles.length >= MAX_ROLES_PER_USER) break;
  }
  return roles;
}

async function callFn(name: string, body: unknown): Promise<{ results?: DiscoveredJob[] }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": CRON_SECRET,
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { results: [] };
    return await res.json();
  } catch {
    return { results: [] };
  }
}

Deno.serve(async (req) => {
  // Cron auth: the pg_cron job sends Authorization: Bearer <CRON_SECRET>.
  const auth = req.headers.get("Authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, target_roles, target_companies, target_role, work_history");

  let inserted = 0;
  let usersProcessed = 0;
  let backfilled = 0;

  for (const p of profiles ?? []) {
    let roles = Array.isArray(p.target_roles) ? p.target_roles : [];
    if (roles.length === 0) {
      const derived = deriveTargetRolesInline(p.target_role, p.work_history);
      if (derived.length === 0) continue;
      const { error } = await admin
        .from("profiles")
        .update({ target_roles: derived })
        .eq("id", p.id);
      if (error) continue;
      roles = derived;
      backfilled++;
    }
    usersProcessed++;
    const companies = Array.isArray(p.target_companies) ? p.target_companies : [];

    // 1. Discover across this user's roles.
    const collected: (DiscoveredJob & { targetRoleId?: string })[] = [];
    for (const role of roles.slice(0, MAX_ROLES_PER_USER)) {
      const keywords = [role.title, ...(role.keywords ?? [])].filter(Boolean);
      const exclude = role.exclude ?? [];
      const [scan, web] = await Promise.all([
        callFn("scan-jobs", { companies, keywords, exclude, includeSeed: true }),
        callFn("job-search", { query: role.title, exclude }),
      ]);
      for (const j of scan.results ?? []) collected.push({ ...j, targetRoleId: role.id });
      for (const j of web.results ?? []) collected.push({ ...j, targetRoleId: role.id });
    }

    // 2. Skip anything the user already has saved (non-suggested).
    const { data: existing } = await admin
      .from("job_postings")
      .select("source, external_id")
      .eq("user_id", p.id)
      .neq("status", "suggested");
    const savedKeys = new Set(
      (existing ?? [])
        .filter((e: { external_id: string | null }) => e.external_id)
        .map((e: { source: string; external_id: string }) => `${e.source}:${e.external_id}`),
    );

    // 3. Dedupe + cap, build rows.
    const seen = new Set<string>();
    const rows: Record<string, unknown>[] = [];
    for (const j of collected) {
      if (!j.title || !j.url) continue;
      const extKey = j.externalId ? `${j.source}:${j.externalId}` : "";
      if (extKey && savedKeys.has(extKey)) continue;
      const dedupeKey = extKey || `${(j.company ?? "").toLowerCase()}|${j.title.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      rows.push({
        user_id: p.id,
        title: j.title,
        company: j.company ?? null,
        location: j.location ?? null,
        description: j.description ?? null,
        url: j.url ?? null,
        source: j.source,
        external_id: j.externalId ?? null,
        employment_type: j.employmentType ?? null,
        remote: j.remote ?? null,
        target_role_id: j.targetRoleId ?? null,
        status: "suggested",
      });
      if (rows.length >= MAX_SUGGESTIONS_PER_USER) break;
    }

    // 4. Replace this user's suggested set with the fresh batch.
    await admin.from("job_postings").delete().eq("user_id", p.id).eq("status", "suggested");
    if (rows.length > 0) {
      const { error } = await admin.from("job_postings").insert(rows);
      if (!error) inserted += rows.length;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, usersProcessed, inserted, backfilled }),
    { headers: { "Content-Type": "application/json" } },
  );
});
