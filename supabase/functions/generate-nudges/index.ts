import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildFollowUpNudges,
  buildThankYouNudges,
  type StalePostingCandidate,
} from "../_shared/followUpNudges.ts";

// ── Nightly coach-nudge generator (Coach OS F1 Slice B) ────────────────────
// Triggered by pg_cron (see migration). Deterministic, template-only, no AI:
// for every user's stale applied/interviewing job_postings, upserts
// `follow_up` and `thank_you` coach_nudges rows (idempotent via the unique
// (user_id, kind, subject_id) index — ON CONFLICT DO NOTHING so a dismissed
// nudge is never recreated). See
// docs/superpowers/specs/2026-07-07-coach-os-f1-design.md §7.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

Deno.serve(async (req) => {
  // Cron auth: the pg_cron job sends Authorization: Bearer <CRON_SECRET>.
  const auth = req.headers.get("Authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: postings, error } = await admin
    .from("job_postings")
    .select("id, user_id, status, title, company, applied_at, interviewing_at, updated_at")
    .in("status", ["applied", "interviewing"]);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const candidates = (postings ?? []) as StalePostingCandidate[];
  const rows = [...buildFollowUpNudges(candidates, new Date()), ...buildThankYouNudges(candidates, new Date())];

  let inserted = 0;
  if (rows.length > 0) {
    const { error: insertError, count } = await admin
      .from("coach_nudges")
      .upsert(rows, { onConflict: "user_id,kind,subject_id", ignoreDuplicates: true, count: "exact" });
    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
    }
    inserted = count ?? 0;
  }

  return new Response(
    JSON.stringify({ ok: true, candidates: rows.length, inserted }),
    { headers: { "Content-Type": "application/json" } },
  );
});
