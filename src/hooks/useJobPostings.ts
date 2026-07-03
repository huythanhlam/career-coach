import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import type { JobPosting, JobStatus } from "@/types/jobPosting";

// Targeted Job Postings data hook. Replaces the old useJobApplications hook,
// reading/writing the richer `job_postings` table.

function rowToPosting(row: Record<string, unknown>): JobPosting {
  return {
    id: row.id as string,
    title: row.title as string,
    company: (row.company as string) ?? undefined,
    location: (row.location as string) ?? undefined,
    description: (row.description as string) ?? undefined,
    url: (row.url as string) ?? undefined,
    source: (row.source as JobPosting["source"]) ?? "manual",
    externalId: (row.external_id as string) ?? undefined,
    employmentType: (row.employment_type as string) ?? undefined,
    remote: (row.remote as boolean) ?? undefined,
    targetRoleId: (row.target_role_id as string) ?? undefined,
    targetCompanyId: (row.target_company_id as string) ?? undefined,
    matchScore: (row.match_score as number) ?? undefined,
    status: (row.status as JobStatus) ?? "saved",
    favorite: (row.favorite as boolean) ?? false,
    appliedResumeId: (row.applied_resume_id as string) ?? undefined,
    appliedCoverLetterId: (row.applied_cover_letter_id as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    appliedAt: (row.applied_at as string) ?? undefined,
    postingData: (row.posting_data as Record<string, unknown>) ?? {},
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

/** Map a camelCase posting (partial) to a snake_case DB row for insert/update. */
function postingToRow(p: Partial<JobPosting>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set("title", p.title);
  set("company", p.company ?? null);
  set("location", p.location ?? null);
  set("description", p.description ?? null);
  set("url", p.url ?? null);
  set("source", p.source);
  set("external_id", p.externalId ?? null);
  set("employment_type", p.employmentType ?? null);
  set("remote", p.remote ?? null);
  set("target_role_id", p.targetRoleId ?? null);
  set("target_company_id", p.targetCompanyId ?? null);
  set("match_score", p.matchScore ?? null);
  set("status", p.status);
  set("favorite", p.favorite);
  set("applied_resume_id", p.appliedResumeId ?? null);
  set("applied_cover_letter_id", p.appliedCoverLetterId ?? null);
  set("notes", p.notes ?? null);
  set("applied_at", p.appliedAt ?? null);
  set("posting_data", p.postingData);
  return row;
}

export type NewPosting = Omit<
  JobPosting,
  "id" | "createdAt" | "updatedAt" | "status" | "favorite"
> &
  Partial<Pick<JobPosting, "status" | "favorite">>;

export function useJobPostings() {
  const { user } = useAuth();
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("job_postings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setPostings(data.map(rowToPosting));
        setLoading(false);
      });
  }, [user?.id]);

  const addPosting = useCallback(
    async (posting: NewPosting): Promise<JobPosting | null> => {
      if (!user) return null;
      // Idempotent: if this exact posting is already on the board (saved or
      // suggested), promote/return it instead of hitting the
      // (user_id, source, external_id) unique index and failing silently.
      if (posting.externalId) {
        const dup = postings.find(
          (p) => p.source === posting.source && p.externalId === posting.externalId,
        );
        if (dup) {
          if (dup.status === "suggested") {
            await supabase.from("job_postings").update({ status: "saved" }).eq("id", dup.id);
            const promoted = { ...dup, status: "saved" as JobStatus };
            setPostings((prev) => prev.map((p) => (p.id === dup.id ? promoted : p)));
            return promoted;
          }
          return dup;
        }
      }
      const { data, error } = await supabase
        .from("job_postings")
        .insert({ user_id: user.id, status: "saved", favorite: false, ...postingToRow(posting) })
        .select()
        .single();
      if (error || !data) return null;
      const mapped = rowToPosting(data);
      setPostings((prev) => [mapped, ...prev]);
      return mapped;
    },
    [user, postings],
  );

  /** Bulk-save scan/import results, skipping ones already saved (by source+externalId). */
  const addPostings = useCallback(
    async (newOnes: NewPosting[]): Promise<number> => {
      if (!user || newOnes.length === 0) return 0;
      const existingKeys = new Set(
        postings.filter((p) => p.externalId).map((p) => `${p.source}:${p.externalId}`),
      );
      const seen = new Set<string>();
      const toInsert = newOnes.filter((p) => {
        if (!p.externalId) return true;
        const key = `${p.source}:${p.externalId}`;
        if (existingKeys.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (toInsert.length === 0) return 0;
      const rows = toInsert.map((p) => ({
        user_id: user.id,
        status: "saved",
        favorite: false,
        ...postingToRow(p),
      }));
      const { data } = await supabase.from("job_postings").insert(rows).select();
      if (data) setPostings((prev) => [...data.map(rowToPosting), ...prev]);
      return data?.length ?? 0;
    },
    [user, postings],
  );

  const updatePosting = useCallback(async (id: string, patch: Partial<JobPosting>) => {
    setPostings((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    await supabase.from("job_postings").update(postingToRow(patch)).eq("id", id);
  }, []);

  const deletePosting = useCallback(async (id: string) => {
    setPostings((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("job_postings").delete().eq("id", id);
  }, []);

  return { postings, loading, addPosting, addPostings, updatePosting, deletePosting };
}
