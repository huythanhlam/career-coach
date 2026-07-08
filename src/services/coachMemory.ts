import { supabase } from "@/lib/supabaseClient";
import { runWorkflow } from "@/ai/client";
import {
  memoryWriterWorkflow,
  type MemorySourceFeature,
  type ExtractedMemory,
} from "@/ai/workflows/memoryWriter";

/**
 * Client-side store for Coach OS memories (`user_memories`, Roadmap F1). The
 * memory-writer workflow runs through the gateway, then the extracted notes are
 * inserted under owner-only RLS. Every helper is FAIL-SOFT: persisting or reading
 * memory must never break the event that triggered it (matching
 * `src/ai/conversation.ts`). The `user_memories` table is still in
 * `supabase/pending_migrations/`, so it is referenced by name (untyped client).
 */

export interface UserMemory {
  id: string;
  kind: "fact" | "preference" | "episode";
  content: string;
  sourceFeature: string | null;
  salience: number;
  createdAt: string;
}

const DEFAULT_TOP_K = 6;

function rowToMemory(row: Record<string, unknown>): UserMemory {
  return {
    id: row.id as string,
    kind: row.kind as UserMemory["kind"],
    content: row.content as string,
    sourceFeature: (row.source_feature as string) ?? null,
    salience: (row.salience as number) ?? 3,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

/**
 * Run the memory-writer over a compact event summary and persist whatever notes
 * it extracts. Fire-and-forget from the caller's perspective — resolves quietly
 * on any failure (no sign-in, gateway error, insert error, or zero extractions).
 */
export async function recordEvent(
  sourceFeature: MemorySourceFeature,
  eventSummary: string,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const result = await runWorkflow(memoryWriterWorkflow, { sourceFeature, eventSummary });
    if (result.status !== "ok") return;
    const memories = result.data.memories;
    if (!memories.length) return;

    // The output schema is permissive (Gemini rejects numeric/length constraints),
    // so clamp here: salience must satisfy the DB CHECK (between 1 and 5), and we
    // keep at most 5 notes per event.
    const rows = memories.slice(0, 5).map((m: ExtractedMemory) => {
      const s = Number(m.salience);
      return {
        user_id: user.id,
        kind: m.kind,
        content: m.content,
        source_feature: sourceFeature,
        // Default only when non-numeric; 0 must clamp to 1, not fall through to 3.
        salience: Math.max(1, Math.min(5, Math.round(Number.isFinite(s) ? s : 3))),
      };
    });
    const { error } = await supabase.from("user_memories").insert(rows);
    if (error) console.error("recordEvent insert failed:", error.message);
  } catch (err) {
    console.error("recordEvent failed:", err);
  }
}

/** All of the user's memories, most salient then most recent. `[]` on error. */
export async function listMemories(): Promise<UserMemory[]> {
  const { data, error } = await supabase
    .from("user_memories")
    .select("id, kind, content, source_feature, salience, created_at")
    .order("salience", { ascending: false })
    .order("created_at", { ascending: false });
  if (error || !data) {
    if (error) console.error("listMemories failed:", error.message);
    return [];
  }
  return (data as Record<string, unknown>[]).map(rowToMemory);
}

/** The top-k memories for injection into a coach turn. `[]` on error. */
export async function topMemories(k: number = DEFAULT_TOP_K): Promise<UserMemory[]> {
  const { data, error } = await supabase
    .from("user_memories")
    .select("id, kind, content, source_feature, salience, created_at")
    .order("salience", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(k);
  if (error || !data) {
    if (error) console.error("topMemories failed:", error.message);
    return [];
  }
  return (data as Record<string, unknown>[]).map(rowToMemory);
}

/** Delete one memory. Best-effort; errors are logged, not thrown. */
export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from("user_memories").delete().eq("id", id);
  if (error) console.error("deleteMemory failed:", error.message);
}
