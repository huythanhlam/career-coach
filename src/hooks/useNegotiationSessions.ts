import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import type {
  NegotiationSession,
  NewNegotiationSession,
  NegotiationScores,
  Counterpart,
  MoveFeedback,
  ChatTurn,
} from "@/types/negotiationSession";

// Negotiation roleplay history — reads/writes `negotiation_sessions`.
// Mirrors useInterviewSessions (list + add + delete).

function rowToSession(row: Record<string, unknown>): NegotiationSession {
  return {
    id: row.id as string,
    role: (row.role as string) ?? undefined,
    counterpart: (row.counterpart as Counterpart) ?? undefined,
    scenario: (row.scenario as string) ?? undefined,
    transcript: (row.transcript as ChatTurn[]) ?? [],
    scores: (row.scores as NegotiationScores) ?? undefined,
    overallScore: (row.overall_score as number) ?? undefined,
    summary: (row.summary as string) ?? undefined,
    strengths: (row.strengths as string[]) ?? undefined,
    improvements: (row.improvements as string[]) ?? undefined,
    moveFeedback: (row.move_feedback as MoveFeedback[]) ?? undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

export function useNegotiationSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<NegotiationSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("negotiation_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setSessions((data as Record<string, unknown>[]).map(rowToSession));
        setLoading(false);
      });
  }, [user?.id]);

  const addSession = useCallback(
    async (session: NewNegotiationSession): Promise<NegotiationSession | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("negotiation_sessions")
        .insert({
          user_id: user.id,
          role: session.role ?? null,
          counterpart: session.counterpart ?? null,
          scenario: session.scenario ?? null,
          transcript: session.transcript,
          scores: session.scores ?? null,
          overall_score: session.overallScore ?? null,
          summary: session.summary ?? null,
          strengths: session.strengths ?? null,
          improvements: session.improvements ?? null,
          move_feedback: session.moveFeedback ?? null,
        })
        .select()
        .single();
      if (error || !data) return null;
      const mapped = rowToSession(data as Record<string, unknown>);
      setSessions((prev) => [mapped, ...prev]);
      return mapped;
    },
    [user],
  );

  const deleteSession = useCallback(async (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("negotiation_sessions").delete().eq("id", id);
  }, []);

  return { sessions, loading, addSession, deleteSession };
}
