import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, Building2, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { POPULAR_COMPANIES } from "@/data/popularCompanies";
import { listCompanyProfiles, slugifyCompany, type CompanyProfileSummary } from "@/services/companyProfileService";
import { MentorCard } from "./shared";

interface Props {
  /** Research the chosen / typed company. */
  onPick: (name: string) => void;
}

interface CatalogEntry {
  slug: string;
  name: string;
  logoUrl?: string;
  industry?: string;
  /** Has a verified deterministic profile already in the DB. */
  ready: boolean;
}

/**
 * Entry view for Research Company: browse the companies that already exist in
 * the app (the verified `company_profiles` library, plus the shipped catalog)
 * and pick one — or search to look up any other company. No forms.
 */
export function CompanyBrowser({ onPick }: Props) {
  const [query, setQuery] = useState("");
  const [db, setDb] = useState<CompanyProfileSummary[]>([]);

  useEffect(() => {
    let alive = true;
    listCompanyProfiles().then((rows) => { if (alive) setDb(rows); });
    return () => { alive = false; };
  }, []);

  // Merge the shipped catalog with the DB library (DB adds logo/industry + "ready").
  const catalog = useMemo<CatalogEntry[]>(() => {
    const bySlug = new Map<string, CatalogEntry>();
    for (const c of POPULAR_COMPANIES) {
      const slug = slugifyCompany(c.name);
      if (slug && !bySlug.has(slug)) bySlug.set(slug, { slug, name: c.name, ready: false });
    }
    for (const r of db) {
      const existing = bySlug.get(r.slug);
      if (existing) Object.assign(existing, { ready: true, logoUrl: r.logoUrl, industry: r.industry });
      else bySlug.set(r.slug, { slug: r.slug, name: r.name, ready: true, logoUrl: r.logoUrl, industry: r.industry });
    }
    return [...bySlug.values()].sort((a, b) =>
      a.ready === b.ready ? a.name.localeCompare(b.name) : a.ready ? -1 : 1,
    );
  }, [db]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? catalog.filter((c) => c.name.toLowerCase().includes(q)) : catalog),
    [catalog, q],
  );
  const readyCount = catalog.filter((c) => c.ready).length;
  const exactMatch = catalog.some((c) => c.name.toLowerCase() === q);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Search / lookup */}
      <MentorCard style={{ overflow: "hidden" }}>
        <div style={{ padding: "18px 20px" }}>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>
            Research a company
          </div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 14 }}>
            Pick one from the library below{readyCount ? ` (${readyCount} with verified profiles)` : ""}, or search for any company.
          </div>
          <div style={{ position: "relative" }}>
            <Search className="w-4 h-4" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && query.trim()) onPick(query.trim()); }}
              placeholder="Search companies, or type any company name…"
              style={{
                width: "100%", height: 48, padding: "0 14px 0 40px", borderRadius: 12,
                background: "var(--muted)", border: "1px solid var(--border)", outline: "none",
                fontFamily: "inherit", fontSize: 14, color: "var(--foreground)",
              }}
            />
          </div>
          {q && !exactMatch && (
            <button
              onClick={() => onPick(query.trim())}
              style={{
                marginTop: 12, height: 44, width: "100%", borderRadius: 12, border: "1px solid var(--primary)",
                background: "var(--primary)", color: "#FFF", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Sparkles className="w-4 h-4" /> Research “{query.trim()}” <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </MentorCard>

      {/* Browse grid */}
      {filtered.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {filtered.map((c, i) => (
            <motion.button
              key={c.slug}
              onClick={() => onPick(c.name)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 20) * 0.02, duration: 0.25, ease: "easeOut" }}
              whileHover={{ y: -2 }}
              style={{
                textAlign: "left", cursor: "pointer", background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
                fontFamily: "inherit", boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
              }}
            >
              {c.logoUrl ? (
                <img src={c.logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 9, objectFit: "contain", background: "#fff", border: "1px solid var(--border)", flexShrink: 0 }} />
              ) : (
                <span style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--muted)" }}>
                  <Building2 className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                </span>
              )}
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                {c.ready ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#2F6B4F", marginTop: 2 }}>
                    <ShieldCheck className="w-3 h-3" /> Verified profile
                  </span>
                ) : (
                  <span style={{ display: "block", fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.industry ?? "Tap to research"}
                  </span>
                )}
              </span>
            </motion.button>
          ))}
        </div>
      ) : (
        !q && (
          <MentorCard style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--muted-foreground)" }}>No companies in the library yet — search above to research one.</div>
          </MentorCard>
        )
      )}
    </div>
  );
}
