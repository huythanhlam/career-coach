import { supabase } from "@/lib/supabaseClient";

/**
 * Client-side store for Coach OS nudges (`coach_nudges`, Roadmap F1 Slice B).
 * Rows are server-generated only (nightly `generate-nudges` cron, service-role
 * insert) — the client only reads and dismisses. Fail-soft: reading/dismissing
 * must never break the Dashboard render. The `coach_nudges` table is still in
 * `supabase/pending_migrations/`, so it is referenced by name (untyped client).
 */

export interface CoachNudge {
  id: string;
  kind: string;
  subjectId: string | null;
  title: string;
  body: string;
  ctaView: string | null;
  createdAt: string;
}

function rowToNudge(row: Record<string, unknown>): CoachNudge {
  return {
    id: row.id as string,
    kind: row.kind as string,
    subjectId: (row.subject_id as string) ?? null,
    title: row.title as string,
    body: row.body as string,
    ctaView: (row.cta_view as string) ?? null,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

/** Active nudges for the current user, most recent first. `[]` on error. */
export async function listActiveNudges(): Promise<CoachNudge[]> {
  const { data, error } = await supabase
    .from("coach_nudges")
    .select("id, kind, subject_id, title, body, cta_view, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error || !data) {
    if (error) console.error("listActiveNudges failed:", error.message);
    return [];
  }
  return (data as Record<string, unknown>[]).map(rowToNudge);
}

/** Dismiss a nudge so it never resurfaces. Best-effort; errors are logged, not thrown. */
export async function dismissNudge(id: string): Promise<void> {
  const { error } = await supabase
    .from("coach_nudges")
    .update({ status: "dismissed" })
    .eq("id", id);
  if (error) console.error("dismissNudge failed:", error.message);
}
