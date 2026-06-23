/** One simulated-checkout purchase that featured a listing for a window. */
export interface BoostOrder {
  id: string;
  listingId: string;
  tier: string;
  days: number;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  expiresAt?: string;
}

export interface BoostTier {
  tier: string;
  label: string;
  days: number;
  amountCents: number;
  blurb: string;
}

/** Boost packages offered at checkout. Amounts are display-only (simulated). */
export const BOOST_TIERS: BoostTier[] = [
  {
    tier: "standard",
    label: "Standard",
    days: 7,
    amountCents: 4900,
    blurb: "Featured for 7 days — top of the studio + surfaced to seekers.",
  },
  {
    tier: "premium",
    label: "Premium",
    days: 30,
    amountCents: 14900,
    blurb: "Featured for 30 days, plus the AI-enhanced multi-channel promo pack.",
  },
];

export function findBoostTier(tier: string): BoostTier | undefined {
  return BOOST_TIERS.find((t) => t.tier === tier);
}

/** Format cents as a currency string, e.g. 4900 → "$49.00". */
export function formatPrice(amountCents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountCents / 100);
}
