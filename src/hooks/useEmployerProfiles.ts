import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { describeDbError } from "@/lib/supabaseError";
import type { EmployerCompanyProfile } from "@/types/employerProfile";

// Employer-owned company profiles. Mirrors the optimistic CRUD + snake/camel
// mapper pattern of useJobPostings, scoped to the signed-in user.

export function rowToCompany(row: Record<string, unknown>): EmployerCompanyProfile {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    tagline: (row.tagline as string) ?? undefined,
    website: (row.website as string) ?? undefined,
    industry: (row.industry as string) ?? undefined,
    size: (row.size as string) ?? undefined,
    headquarters: (row.headquarters as string) ?? undefined,
    logoUrl: (row.logo_url as string) ?? undefined,
    about: (row.about as string) ?? undefined,
    mission: (row.mission as string) ?? undefined,
    culture: (row.culture as string) ?? undefined,
    benefits: (row.benefits as string) ?? undefined,
    extra: (row.extra as Record<string, unknown>) ?? {},
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

/**
 * Map a camelCase (partial) company to a snake_case row for insert/update.
 * Only keys present in the patch are written — absent keys are omitted so a
 * partial update never nulls out columns the caller didn't touch. On insert,
 * omitted nullable columns fall back to their DB defaults.
 */
export function companyToRow(p: Partial<EmployerCompanyProfile>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set("name", p.name);
  set("tagline", p.tagline);
  set("website", p.website);
  set("industry", p.industry);
  set("size", p.size);
  set("headquarters", p.headquarters);
  set("logo_url", p.logoUrl);
  set("about", p.about);
  set("mission", p.mission);
  set("culture", p.culture);
  set("benefits", p.benefits);
  set("extra", p.extra);
  return row;
}

export type NewCompanyProfile = Omit<EmployerCompanyProfile, "id" | "createdAt" | "updatedAt">;

export function useEmployerProfiles() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<EmployerCompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("employer_company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setProfiles(data.map(rowToCompany));
        setLoading(false);
      });
  }, [user?.id]);

  const addProfile = useCallback(
    async (profile: NewCompanyProfile): Promise<EmployerCompanyProfile> => {
      if (!user) throw new Error("You must be signed in to create a company.");
      const { data, error } = await supabase
        .from("employer_company_profiles")
        .insert({ user_id: user.id, ...companyToRow(profile) })
        .select()
        .single();
      if (error || !data) {
        console.error("addProfile failed:", error);
        throw new Error(describeDbError(error));
      }
      const mapped = rowToCompany(data);
      setProfiles((prev) => [mapped, ...prev]);
      return mapped;
    },
    [user],
  );

  const updateProfile = useCallback(async (id: string, patch: Partial<EmployerCompanyProfile>) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from("employer_company_profiles").update(companyToRow(patch)).eq("id", id);
    if (error) console.error("updateProfile failed:", error);
  }, []);

  const deleteProfile = useCallback(async (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    // FK cascade removes this company's listings and their boost orders too.
    const { error } = await supabase.from("employer_company_profiles").delete().eq("id", id);
    if (error) console.error("deleteProfile failed:", error);
  }, []);

  return { profiles, loading, addProfile, updateProfile, deleteProfile };
}
