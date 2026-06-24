import React, { useState } from "react";
import { Rocket, Loader2, X, Check, ShieldCheck } from "lucide-react";
import type { EmployerJobListing } from "@/types/employerListing";
import { BOOST_TIERS, formatPrice } from "@/types/boostOrder";
import { primaryBtn, ghostBtn } from "./styles";

interface Props {
  listing: EmployerJobListing;
  onConfirm: (tierId: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Simulated boost checkout. Presents the boost packages and a clearly-labeled
 * mock payment step — no card is charged. Confirming calls back into the hook,
 * which records the order and features the listing.
 */
export function BoostCheckoutModal({ listing, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState(BOOST_TIERS[0].tier);
  const [paying, setPaying] = useState(false);

  const tier = BOOST_TIERS.find((t) => t.tier === selected)!;

  const handlePay = async () => {
    setPaying(true);
    try {
      await onConfirm(selected);
      onClose();
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4" style={{ background: "rgba(31,27,22,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 22, boxShadow: "0 24px 80px rgba(31,27,22,0.22)" }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <Rocket className="w-5 h-5" style={{ color: "var(--primary)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>Boost this listing</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{listing.title}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: 4 }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          {BOOST_TIERS.map((t) => {
            const active = t.tier === selected;
            return (
              <button
                key={t.tier}
                onClick={() => setSelected(t.tier)}
                style={{
                  textAlign: "left", cursor: "pointer", borderRadius: 14, padding: "14px 16px",
                  border: active ? "2px solid var(--primary)" : "1px solid var(--border)",
                  background: active ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--muted)",
                  display: "flex", alignItems: "flex-start", gap: 12,
                }}
              >
                <div style={{ width: 20, height: 20, borderRadius: 9999, border: active ? "6px solid var(--primary)" : "2px solid var(--border)", flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{t.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--primary)" }}>{formatPrice(t.amountCents)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3, lineHeight: 1.5 }}>{t.blurb}</div>
                </div>
              </button>
            );
          })}

          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted-foreground)", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
            <ShieldCheck className="w-4 h-4" style={{ color: "var(--forest, #2F6B4F)", flexShrink: 0 }} />
            <span>Simulated checkout — this is a demo and <strong>no real payment</strong> is processed.</span>
          </div>

          <button onClick={handlePay} disabled={paying} style={{ ...primaryBtn, height: 48, opacity: paying ? 0.7 : 1, cursor: paying ? "not-allowed" : "pointer" }}>
            {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {paying ? "Processing…" : `Pay ${formatPrice(tier.amountCents)} & feature for ${tier.days} days`}
          </button>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
