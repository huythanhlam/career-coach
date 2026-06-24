import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import type { EmployerJobListing } from "@/types/employerListing";
import { rowToListing } from "@/hooks/useEmployerListings";

/** A featured listing joined with its company name for seeker-facing display. */
export interface FeaturedListing extends EmployerJobListing {
  companyName?: string;
}

/**
 * Read-only feed of boosted, published employer listings for the seeker side.
 * The "public featured read" RLS policy permits authenticated users to SELECT
 * rows that are published with an unexpired boost; we still filter client-side
 * on `boosted_until` so an expired boost drops out immediately on refetch.
 */
export function useFeaturedListings() {
  const { user } = useAuth();
  const [listings, setListings] = useState<FeaturedListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("employer_job_listings")
      .select("*, employer_company_profiles(name)")
      .eq("status", "published")
      .gt("boosted_until", new Date().toISOString())
      .order("boosted_until", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setListings(
            data.map((row: Record<string, unknown>) => {
              const company = row.employer_company_profiles as { name?: string } | null;
              return { ...rowToListing(row), companyName: company?.name };
            }),
          );
        }
        setLoading(false);
      });
  }, [user?.id]);

  return { listings, loading };
}
