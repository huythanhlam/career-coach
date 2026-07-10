import { supabase } from "@/lib/supabaseClient";

/**
 * Client-side store for Coach OS nudges (`coach_nudges`, Roadmap F1 Slice B;
 * draftKind/snooze added in F3 Slice A). Rows are server-generated only
 * (nightly `generate-nudges` cron, service-role insert) — the client reads,
 * dismisses, marks done, and snoozes. Fail-soft: reading/mutating must never
 * break the Dashboard render.
 */

export interface CoachNudge {
  id: string;
  kind: string;
  subjectId: string | null;
  title: string;
  body: string;
  ctaView: string | null;
  createdAt: string;
  /** Non-null when this nudge has a real AI-draftable action attached. */
  draftKind: "follow_up" | "thank_you" | null;
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
    draftKind: (row.draft_kind as CoachNudge["draftKind"]) ?? null,
  };
}

/**
 * Active, non-snoozed nudges for the current user, most recent first.
 * `[]` on error.
 */
export async function listActiveNudges(): Promise<CoachNudge[]> {
  const { data, error } = await supabase
    .from("coach_nudges")
    .select("id, kind, subject_id, title, body, cta_view, created_at, draft_kind")
    .eq("status", "active")
    .or(`snoozed_until.is.null,snoozed_until.lt.${new Date().toISOString()}`)
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

/** Mark a nudge as done (the user completed the action). Best-effort. */
export async function markNudgeDone(id: string): Promise<void> {
  const { error } = await supabase.from("coach_nudges").update({ status: "done" }).eq("id", id);
  if (error) console.error("markNudgeDone failed:", error.message);
}

/** Hide a nudge for `days` days, after which it resurfaces (unless dismissed/done meanwhile). */
export async function snoozeNudge(id: string, days: number): Promise<void> {
  const snoozedUntil = new Date(Date.now() + days * 86_400_000).toISOString();
  const { error } = await supabase
    .from("coach_nudges")
    .update({ snoozed_until: snoozedUntil })
    .eq("id", id);
  if (error) console.error("snoozeNudge failed:", error.message);
}
