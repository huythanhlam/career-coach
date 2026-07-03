import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import type {
  ApplicationPackage,
  NewApplicationPackage,
  PackageStatus,
} from "@/types/applicationPackage";

// Application Autopilot package store — reads/writes `application_packages`.
// Upserts on (user_id, job_posting_id) so re-generating replaces the same row.

function rowToPackage(row: Record<string, unknown>): ApplicationPackage {
  return {
    id: row.id as string,
    jobPostingId: row.job_posting_id as string,
    fitScore: (row.fit_score as number) ?? undefined,
    tailoredResumeText: (row.tailored_resume_text as string) ?? undefined,
    tailoredResumeStoragePath: (row.tailored_resume_storage_path as string) ?? undefined,
    coverLetterText: (row.cover_letter_text as string) ?? undefined,
    packageStatus: (row.package_status as PackageStatus) ?? "generated",
    error: (row.error as string) ?? undefined,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
  };
}

export function useApplicationPackages() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<ApplicationPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("application_packages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setPackages((data as Record<string, unknown>[]).map(rowToPackage));
        setLoading(false);
      });
  }, [user?.id]);

  /** Insert or replace the package for a posting (one active package per posting). */
  const upsertPackage = useCallback(
    async (pkg: NewApplicationPackage): Promise<ApplicationPackage | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("application_packages")
        .upsert(
          {
            user_id: user.id,
            job_posting_id: pkg.jobPostingId,
            fit_score: pkg.fitScore ?? null,
            tailored_resume_text: pkg.tailoredResumeText ?? null,
            tailored_resume_storage_path: pkg.tailoredResumeStoragePath ?? null,
            cover_letter_text: pkg.coverLetterText ?? null,
            package_status: pkg.packageStatus,
            error: pkg.error ?? null,
          },
          { onConflict: "user_id,job_posting_id" },
        )
        .select()
        .single();
      if (error || !data) return null;
      const mapped = rowToPackage(data as Record<string, unknown>);
      setPackages((prev) => [
        mapped,
        ...prev.filter((p) => p.jobPostingId !== mapped.jobPostingId),
      ]);
      return mapped;
    },
    [user],
  );

  const updatePackage = useCallback(async (id: string, patch: Partial<ApplicationPackage>) => {
    setPackages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const dbPatch: Record<string, unknown> = {};
    if (patch.packageStatus !== undefined) dbPatch.package_status = patch.packageStatus;
    if (patch.tailoredResumeText !== undefined)
      dbPatch.tailored_resume_text = patch.tailoredResumeText;
    if (patch.tailoredResumeStoragePath !== undefined)
      dbPatch.tailored_resume_storage_path = patch.tailoredResumeStoragePath;
    if (patch.coverLetterText !== undefined) dbPatch.cover_letter_text = patch.coverLetterText;
    if (Object.keys(dbPatch).length === 0) return;
    await supabase.from("application_packages").update(dbPatch).eq("id", id);
  }, []);

  const deletePackage = useCallback(async (id: string) => {
    setPackages((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("application_packages").delete().eq("id", id);
  }, []);

  return { packages, loading, upsertPackage, updatePackage, deletePackage };
}
