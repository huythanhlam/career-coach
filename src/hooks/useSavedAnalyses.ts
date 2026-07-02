import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

export interface SavedAnalysis {
  id: string;
  jobInput: string;
  yoe: string | null;
  level: string | null;
  marketData: unknown;
  companyIntel: string | null;
  resumeFit: unknown;
  interviewStrategy: string | null;
  resumeFileName: string | null;
  createdAt: string;
}

function rowToAnalysis(row: Record<string, unknown>): SavedAnalysis {
  return {
    id: row.id as string,
    jobInput: row.job_input as string,
    yoe: (row.yoe as string) ?? null,
    level: (row.level as string) ?? null,
    marketData: row.market_data ?? null,
    companyIntel: (row.company_intel as string) ?? null,
    resumeFit: row.resume_fit ?? null,
    interviewStrategy: (row.interview_strategy as string) ?? null,
    resumeFileName: (row.resume_file_name as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function useSavedAnalyses() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("saved_analyses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setAnalyses(data.map(rowToAnalysis));
        setLoading(false);
      });
  }, [user?.id]);

  const saveAnalysis = useCallback(
    async (data: {
      jobInput: string;
      yoe: string;
      level: string;
      marketData: unknown;
      companyIntel: unknown;
      resumeFit: unknown;
      interviewStrategy: unknown;
      resumeFileName: string | null;
    }) => {
      if (!user) return;
      const { data: row } = await supabase
        .from("saved_analyses")
        .insert({
          user_id: user.id,
          job_input: data.jobInput,
          yoe: data.yoe || null,
          level: data.level || null,
          market_data: data.marketData ?? null,
          company_intel: typeof data.companyIntel === "string" ? data.companyIntel : null,
          resume_fit: data.resumeFit ?? null,
          interview_strategy:
            typeof data.interviewStrategy === "string" ? data.interviewStrategy : null,
          resume_file_name: data.resumeFileName,
        })
        .select()
        .single();
      if (row) setAnalyses((prev) => [rowToAnalysis(row), ...prev]);
    },
    [user],
  );

  const deleteAnalysis = useCallback(async (id: string) => {
    await supabase.from("saved_analyses").delete().eq("id", id);
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { analyses, loading, saveAnalysis, deleteAnalysis };
}
