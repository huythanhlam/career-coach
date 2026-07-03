import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { describeDbError } from "@/lib/supabaseError";
import type { EmployerJobListing, ListingStatus, PromoAssets } from "@/types/employerListing";
import { findBoostTier } from "@/types/boostOrder";

// Employer-owned job listings, mirroring useJobPostings' optimistic CRUD +
// mapper pattern. `boostListing` performs the simulated-checkout commit.

export function rowToListing(row: Record<string, unknown>): EmployerJobListing {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    title: (row.title as string) ?? "",
    location: (row.location as string) ?? undefined,
    employmentType: (row.employment_type as string) ?? undefined,
    remote: (row.remote as boolean) ?? undefined,
    seniority: (row.seniority as string) ?? undefined,
    salaryMin: (row.salary_min as number) ?? undefined,
    salaryMax: (row.salary_max as number) ?? undefined,
    salaryCurrency: (row.salary_currency as string) ?? undefined,
    description: (row.description as string) ?? undefined,
    requirements: (row.requirements as string) ?? undefined,
    responsibilities: (row.responsibilities as string) ?? undefined,
    status: (row.status as ListingStatus) ?? "draft",
    boostedUntil: (row.boosted_until as string) ?? undefined,
    boostTier: (row.boost_tier as string) ?? undefined,
    promoAssets: (row.promo_assets as PromoAssets) ?? {},
    extra: (row.extra as Record<string, unknown>) ?? {},
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

/**
 * Map a camelCase (partial) listing to a snake_case row for insert/update.
 * Only keys present in the patch are written — absent keys are omitted so a
 * partial update (e.g. just status, or just boost fields) never nulls out
 * columns the caller didn't touch. On insert, omitted nullable columns fall
 * back to their DB defaults.
 */
export function listingToRow(p: Partial<EmployerJobListing>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };
  set("company_id", p.companyId);
  set("title", p.title);
  set("location", p.location);
  set("employment_type", p.employmentType);
  set("remote", p.remote);
  set("seniority", p.seniority);
  set("salary_min", p.salaryMin);
  set("salary_max", p.salaryMax);
  set("salary_currency", p.salaryCurrency);
  set("description", p.description);
  set("requirements", p.requirements);
  set("responsibilities", p.responsibilities);
  set("status", p.status);
  set("boosted_until", p.boostedUntil);
  set("boost_tier", p.boostTier);
  set("promo_assets", p.promoAssets);
  set("extra", p.extra);
  return row;
}

export type NewJobListing = Omit<EmployerJobListing, "id" | "createdAt" | "updatedAt" | "status"> &
  Partial<Pick<EmployerJobListing, "status">>;

export function useEmployerListings(companyId?: string) {
  const { user } = useAuth();
  const [listings, setListings] = useState<EmployerJobListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("employer_job_listings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (companyId) query = query.eq("company_id", companyId);
    query.then(({ data }) => {
      if (data) setListings(data.map(rowToListing));
      setLoading(false);
    });
  }, [user?.id, companyId]);

  const addListing = useCallback(
    async (listing: NewJobListing): Promise<EmployerJobListing> => {
      if (!user) throw new Error("You must be signed in to create a listing.");
      const { data, error } = await supabase
        .from("employer_job_listings")
        .insert({ user_id: user.id, status: "draft", ...listingToRow(listing) })
        .select()
        .single();
      if (error || !data) {
        console.error("addListing failed:", error);
        throw new Error(describeDbError(error));
      }
      const mapped = rowToListing(data);
      setListings((prev) => [mapped, ...prev]);
      return mapped;
    },
    [user],
  );

  const updateListing = useCallback(async (id: string, patch: Partial<EmployerJobListing>) => {
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error } = await supabase
      .from("employer_job_listings")
      .update(listingToRow(patch))
      .eq("id", id);
    if (error) console.error("updateListing failed:", error);
  }, []);

  const deleteListing = useCallback(async (id: string) => {
    setListings((prev) => prev.filter((l) => l.id !== id));
    const { error } = await supabase.from("employer_job_listings").delete().eq("id", id);
    if (error) console.error("deleteListing failed:", error);
  }, []);

  /**
   * Simulated-checkout commit: records a boost order and features the listing for
   * the tier's window. This is the single seam a real Stripe Checkout + webhook
   * would replace (the webhook would write the order and set boosted_until).
   */
  const boostListing = useCallback(
    async (id: string, tierId: string): Promise<EmployerJobListing | null> => {
      if (!user) return null;
      const tier = findBoostTier(tierId);
      if (!tier) return null;
      const now = Date.now();
      const expiresAt = new Date(now + tier.days * 24 * 60 * 60 * 1000).toISOString();

      const { error: orderError } = await supabase.from("employer_boost_orders").insert({
        user_id: user.id,
        listing_id: id,
        tier: tier.tier,
        days: tier.days,
        amount_cents: tier.amountCents,
        currency: "USD",
        status: "paid",
        expires_at: expiresAt,
      });
      if (orderError) {
        console.error("boostListing (order) failed:", orderError);
        throw new Error(describeDbError(orderError));
      }

      // Boosting a listing publishes it so it can surface to seekers.
      const patch: Partial<EmployerJobListing> = {
        boostedUntil: expiresAt,
        boostTier: tier.tier,
        status: "published",
      };
      setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      const { error: updateError } = await supabase
        .from("employer_job_listings")
        .update(listingToRow(patch))
        .eq("id", id);
      if (updateError) console.error("boostListing (update) failed:", updateError);
      return listings.find((l) => l.id === id)
        ? { ...listings.find((l) => l.id === id)!, ...patch }
        : null;
    },
    [user, listings],
  );

  return { listings, loading, addListing, updateListing, deleteListing, boostListing };
}
