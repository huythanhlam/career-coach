import { supabase } from "@/lib/supabaseClient";

/**
 * Client-side helpers for the `ai_conversations` / `ai_messages` tables (AI Core
 * v2, Slice 3). The client CREATES a conversation and READS its messages under
 * owner-only RLS; the gateway APPENDS turns to `ai_messages` with the service
 * key when a `conversationId` is passed to a streaming call. This is the minimal
 * persistence substrate the stateful coach (Roadmap F1) builds on — a refresh no
 * longer loses in-flight chat.
 *
 * The Supabase client is untyped (no generated `Database` generic), so these
 * tables — still in `supabase/pending_migrations/` — are referenced by name like
 * the employer/blog tables. All helpers fail soft: persistence is best-effort and
 * must never break a chat send.
 */

export interface ConversationMessage {
  role: "user" | "model";
  text: string;
}

/**
 * Create a conversation header for a workflow and return its id, or `null` if
 * the user isn't signed in or the insert fails (chat still works without it).
 */
export async function createConversation(
  workflowId: string,
  title?: string,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: user.id, workflow_id: workflowId, title: title ?? null })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createConversation failed:", error?.message);
    return null;
  }
  return data.id as string;
}

/**
 * Load a conversation's turns in order (oldest first), mapped to the UI's
 * `{ role, text }` shape. Returns `[]` on any error.
 */
export async function loadMessages(conversationId: string): Promise<ConversationMessage[]> {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    if (error) console.error("loadMessages failed:", error.message);
    return [];
  }
  return (data as { role: string; content: string }[])
    .filter((m) => m.role === "user" || m.role === "model")
    .map((m) => ({ role: m.role as "user" | "model", text: m.content }));
}
