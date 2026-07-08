import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { recordEvent } from "@/services/coachMemory";
import type {
  InterviewSession,
  InterviewScores,
  ChatTurn,
  MockWorkflowId,
  QuestionFeedback,
} from "@/types/interviewSession";

// Interview practice history data hook — reads/writes the `interview_sessions`
// table. Mirrors the useJobPostings shape (list + add + delete).

function rowToSession(row: Record<string, unknown>): InterviewSession {
  return {
    id: row.id as string,
    workflow: row.workflow as MockWorkflowId,
    role: (row.role as string) ?? undefined,
    focus: (row.focus as string) ?? undefined,
    transcript: (row.transcript as ChatTurn[]) ?? [],
    scores: (row.scores as InterviewScores) ?? undefined,
    overallScore: (row.overall_score as number) ?? undefined,
    summary: (row.summary as string) ?? undefined,
    strengths: (row.strengths as string[]) ?? undefined,
    improvements: (row.improvements as string[]) ?? undefined,
    questionFeedback: (row.question_feedback as QuestionFeedback[]) ?? undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

export type NewInterviewSession = Omit<InterviewSession, "id" | "createdAt">;

/** Minimum answered questions for an interview to be worth remembering. */
export const MIN_MEMORABLE_ANSWERS = 2;

/**
 * Whether an interview is substantive enough to write to long-term coach memory:
 * it produced a real score AND the user actually answered a couple of questions.
 * Trivial or barely-started attempts are still saved to history, just not
 * memorized (so they don't pollute what the coach "remembers about you").
 */
export function isMemorableInterview(
  s: Pick<InterviewSession, "overallScore" | "transcript">,
): boolean {
  const answered = (s.transcript ?? []).filter((t) => t.role === "user").length;
  return s.overallScore != null && answered >= MIN_MEMORABLE_ANSWERS;
}

/** Compact event summary for the Coach OS memory-writer (see coachMemory). */
function summarizeInterview(s: InterviewSession): string {
  const parts = [
    `Completed a ${s.workflow} interview${s.role ? ` for ${s.role}` : ""}${
      s.focus ? ` (focus: ${s.focus})` : ""
    }.`,
    s.overallScore != null ? `Overall score: ${s.overallScore}/100.` : "",
    s.scores
      ? `Dimension scores — ${Object.entries(s.scores)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")}.`
      : "",
    s.improvements?.length ? `Areas to improve: ${s.improvements.slice(0, 3).join("; ")}.` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

export function useInterviewSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("interview_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setSessions(data.map(rowToSession));
        setLoading(false);
      });
  }, [user?.id]);

  const addSession = useCallback(
    async (session: NewInterviewSession): Promise<InterviewSession | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("interview_sessions")
        .insert({
          user_id: user.id,
          workflow: session.workflow,
          role: session.role ?? null,
          focus: session.focus ?? null,
          transcript: session.transcript,
          scores: session.scores ?? null,
          overall_score: session.overallScore ?? null,
          summary: session.summary ?? null,
          strengths: session.strengths ?? null,
          improvements: session.improvements ?? null,
          question_feedback: session.questionFeedback ?? null,
        })
        .select()
        .single();
      if (error || !data) return null;
      const mapped = rowToSession(data);
      setSessions((prev) => [mapped, ...prev]);
      // Coach OS: remember this interview only if it was substantive (see
      // isMemorableInterview) — fire-and-forget. Trivial attempts stay in history
      // but are not written to long-term coach memory.
      if (isMemorableInterview(mapped)) {
        void recordEvent("mock_interview", summarizeInterview(mapped));
      }
      return mapped;
    },
    [user],
  );

  const deleteSession = useCallback(async (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("interview_sessions").delete().eq("id", id);
  }, []);

  return { sessions, loading, addSession, deleteSession };
}
