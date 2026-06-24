import React, { useMemo, useState } from "react";
import {
  Building2, Plus, Briefcase, Megaphone, Pencil, Trash2, Rocket, Star, MapPin,
} from "lucide-react";
import type { ViewId } from "@/components/Sidebar";
import { useEmployerProfiles, type NewCompanyProfile } from "@/hooks/useEmployerProfiles";
import { useEmployerListings, type NewJobListing } from "@/hooks/useEmployerListings";
import type { EmployerCompanyProfile } from "@/types/employerProfile";
import type { EmployerJobListing } from "@/types/employerListing";
import { isBoostActive, LISTING_STATUS_META } from "@/types/employerListing";
import { toast } from "@/components/ui/toast";
import { CompanyProfileEditor } from "./CompanyProfileEditor";
import { JobListingEditor } from "./JobListingEditor";
import { PromoteDrawer } from "./PromoteDrawer";
import { BoostCheckoutModal } from "./BoostCheckoutModal";
import { cardStyle, primaryBtn, ghostBtn, pillBtn, featuredBadge } from "./styles";

interface Props {
  onNavigate?: (view: ViewId) => void;
}

type Mode =
  | { kind: "dashboard" }
  | { kind: "company"; company: EmployerCompanyProfile | null }
  | { kind: "listing"; listing: EmployerJobListing | null; companyId: string };

export function EmployerStudio(_props: Props) {
  const { profiles, loading: companiesLoading, addProfile, updateProfile, deleteProfile } = useEmployerProfiles();
  const { listings, addListing, updateListing, deleteListing, boostListing } = useEmployerListings();

  const [mode, setMode] = useState<Mode>({ kind: "dashboard" });
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [promoteListing, setPromoteListing] = useState<EmployerJobListing | null>(null);
  const [boostTarget, setBoostTarget] = useState<EmployerJobListing | null>(null);

  const selectedCompany = useMemo(
    () => profiles.find((c) => c.id === (selectedCompanyId ?? profiles[0]?.id)) ?? null,
    [profiles, selectedCompanyId],
  );
  const companyListings = useMemo(
    () => (selectedCompany ? listings.filter((l) => l.companyId === selectedCompany.id) : []),
    [listings, selectedCompany],
  );
  const activeBoosts = useMemo(() => listings.filter((l) => isBoostActive(l.boostedUntil)).length, [listings]);

  // Keep the promote drawer / boost target in sync with the latest listing data.
  const liveBoostTarget = boostTarget ? listings.find((l) => l.id === boostTarget.id) ?? boostTarget : null;
  const livePromote = promoteListing ? listings.find((l) => l.id === promoteListing.id) ?? promoteListing : null;
  const companyNameOf = (l: EmployerJobListing) => profiles.find((c) => c.id === l.companyId)?.name ?? "";

  /* ── Editors ──────────────────────────────────────────────────────────── */
  if (mode.kind === "company") {
    return (
      <CompanyProfileEditor
        company={mode.company}
        onCancel={() => setMode({ kind: "dashboard" })}
        onSave={async (draft) => {
          if (mode.company) {
            await updateProfile(mode.company.id, draft);
            toast("Company profile saved.", "success");
          } else {
            const created = await addProfile(draft as NewCompanyProfile);
            setSelectedCompanyId(created.id);
            toast("Company created.", "success");
          }
          setMode({ kind: "dashboard" });
        }}
      />
    );
  }

  if (mode.kind === "listing") {
    const company = profiles.find((c) => c.id === mode.companyId);
    return (
      <JobListingEditor
        listing={mode.listing}
        companyId={mode.companyId}
        companyName={company?.name ?? ""}
        onCancel={() => setMode({ kind: "dashboard" })}
        onSave={async (draft) => {
          if (mode.listing) {
            await updateListing(mode.listing.id, draft);
            toast("Listing saved.", "success");
          } else {
            await addListing(draft as NewJobListing);
            toast("Listing created.", "success");
          }
          setMode({ kind: "dashboard" });
        }}
      />
    );
  }

  /* ── Dashboard ────────────────────────────────────────────────────────── */
  const deleteCompany = (company: EmployerCompanyProfile) => {
    const n = listings.filter((l) => l.companyId === company.id).length;
    const msg = n > 0
      ? `Delete "${company.name}" and its ${n} listing${n === 1 ? "" : "s"}? This can't be undone.`
      : `Delete "${company.name}"? This can't be undone.`;
    if (!window.confirm(msg)) return;
    deleteProfile(company.id);
    if (selectedCompanyId === company.id) setSelectedCompanyId(null);
    toast("Company deleted.", "info");
  };

  return (
    <div className="flex-1 h-full overflow-y-auto no-scrollbar px-4 py-6 sm:px-10 sm:py-8 pb-20" style={{ background: "var(--background)" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }} className="animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Hire</div>
            <h1 className="font-display" style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)", margin: 0 }}>
              Employer Studio
            </h1>
            <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 8, maxWidth: 640, lineHeight: 1.6 }}>
              Build your company profile, write job listings with AI, then promote and boost them to reach candidates.
            </p>
          </div>
          <button style={primaryBtn} onClick={() => setMode({ kind: "company", company: null })}>
            <Plus className="w-4 h-4" /> New company
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatChip icon={Building2} label="Companies" value={profiles.length} />
          <StatChip icon={Briefcase} label="Listings" value={listings.length} />
          <StatChip icon={Rocket} label="Active boosts" value={activeBoosts} accent />
        </div>

        {/* Empty state */}
        {!companiesLoading && profiles.length === 0 && (
          <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(217,119,87,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Building2 className="w-7 h-7" style={{ color: "var(--primary)" }} />
            </div>
            <h3 className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", margin: "0 0 6px" }}>Create your first company</h3>
            <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: "0 auto 18px", maxWidth: 420, lineHeight: 1.6 }}>
              Set up a company profile to start posting jobs. The AI can draft your About, mission, culture, and benefits.
            </p>
            <button style={{ ...primaryBtn, margin: "0 auto" }} onClick={() => setMode({ kind: "company", company: null })}>
              <Plus className="w-4 h-4" /> New company
            </button>
          </div>
        )}

        {/* Company selector */}
        {profiles.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {profiles.map((c) => {
              const active = selectedCompany?.id === c.id;
              return (
                <button key={c.id} onClick={() => setSelectedCompanyId(c.id)}
                  style={{ ...pillBtn, height: 36, background: active ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--card)", borderColor: active ? "var(--primary)" : "var(--border)", color: active ? "var(--primary)" : "var(--foreground)", fontWeight: active ? 700 : 600 }}>
                  <Building2 className="w-3.5 h-3.5" /> {c.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Selected company + its listings */}
        {selectedCompany && (
          <>
            <div style={{ ...cardStyle, display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="font-display" style={{ fontSize: 20, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{selectedCompany.name}</h2>
                {selectedCompany.tagline && <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "4px 0 0" }}>{selectedCompany.tagline}</p>}
                <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", fontSize: 12, color: "var(--muted-foreground)" }}>
                  {selectedCompany.industry && <span>{selectedCompany.industry}</span>}
                  {selectedCompany.size && <span>· {selectedCompany.size} employees</span>}
                  {selectedCompany.headquarters && <span>· {selectedCompany.headquarters}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...ghostBtn, height: 36 }} onClick={() => setMode({ kind: "company", company: selectedCompany })}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button aria-label="Delete company" style={{ ...ghostBtn, height: 36, width: 40, padding: 0, color: "var(--destructive, #B3422F)" }} onClick={() => deleteCompany(selectedCompany)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                  Job listings <span style={{ fontSize: 14, color: "var(--muted-foreground)", fontWeight: 500 }}>· {companyListings.length}</span>
                </h3>
                <button style={{ ...primaryBtn, height: 38 }} onClick={() => setMode({ kind: "listing", listing: null, companyId: selectedCompany.id })}>
                  <Plus className="w-4 h-4" /> New listing
                </button>
              </div>

              {companyListings.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: "center", color: "var(--muted-foreground)", fontSize: 14, padding: 32 }}>
                  No listings yet. Create one — the AI can draft it from a short brief.
                </div>
              ) : (
                <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
                  {companyListings.map((l, i) => {
                    const boosted = isBoostActive(l.boostedUntil);
                    const meta = LISTING_STATUS_META[l.status];
                    return (
                      <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: i === companyListings.length - 1 ? "none" : "1px solid var(--border)" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
                            {boosted && <span style={featuredBadge}><Star className="w-3 h-3" fill="currentColor" /> Featured</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: 12, color: "var(--muted-foreground)" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 20, padding: "0 8px", borderRadius: 9999, fontSize: 11, fontWeight: 700, color: meta.fg, background: meta.bg, border: `1px solid ${meta.border}` }}>{meta.label}</span>
                            {l.location && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MapPin className="w-3 h-3" /> {l.location}</span>}
                          </div>
                        </div>
                        <button style={{ ...ghostBtn, height: 34, padding: "0 12px" }} onClick={() => setMode({ kind: "listing", listing: l, companyId: l.companyId })}>
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button style={{ ...primaryBtn, height: 34, padding: "0 12px" }} onClick={() => setPromoteListing(l)}>
                          <Megaphone className="w-3.5 h-3.5" /> Promote
                        </button>
                        <button aria-label="Delete listing" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: 4, flexShrink: 0 }}
                          onClick={() => { if (window.confirm(`Delete "${l.title}"?`)) { deleteListing(l.id); toast("Listing deleted.", "info"); } }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {livePromote && (
        <PromoteDrawer
          listing={livePromote}
          companyName={companyNameOf(livePromote)}
          onClose={() => setPromoteListing(null)}
          onUpdate={(patch) => updateListing(livePromote.id, patch)}
          onBoostClick={() => setBoostTarget(livePromote)}
        />
      )}

      {liveBoostTarget && (
        <BoostCheckoutModal
          listing={liveBoostTarget}
          onClose={() => setBoostTarget(null)}
          onConfirm={async (tierId) => {
            try {
              await boostListing(liveBoostTarget.id, tierId);
              toast("Listing boosted — it's now featured.", "success");
            } catch (e) {
              toast(e instanceof Error ? e.message : "Couldn't boost the listing.", "error");
            }
          }}
        />
      )}
    </div>
  );
}

function StatChip({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number; accent?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 14, background: "var(--card)", border: "1px solid var(--border)", minWidth: 130 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: accent ? "rgba(217,119,87,0.12)" : "var(--muted)" }}>
        <Icon className="w-4 h-4" style={{ color: accent ? "var(--primary)" : "var(--muted-foreground)" }} />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}
