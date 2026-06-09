import React, { useMemo, useState } from "react";
import {
  Search, Plus, X, Star, Building, Link2, Loader2, Sparkles,
  Trash2, ExternalLink, Target, Briefcase, FileText, Mail, ArrowRight,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { useJobPostings, type NewPosting } from "@/hooks/useJobPostings";
import {
  scanJobs, searchAggregators, importJobFromUrl, detectAtsFromUrl, type ImportedJobDraft,
} from "@/services/jobScanService";
import { generateWorkflowData } from "@/services/geminiService";
import { generateId } from "@/types/userProfile";
import {
  JOB_STATUSES, type JobPosting, type JobStatus, type ScannedJob,
  type AggregatorJob, type TargetRole, type TargetCompany,
} from "@/types/jobPosting";
import type { ViewId } from "@/components/Sidebar";

/* ── Status presentation ─────────────────────────────────────────────────── */
const STATUS_META: Record<JobStatus, { label: string; fg: string; bg: string; border: string }> = {
  saved:        { label: "Saved",        fg: "#71717A", bg: "rgba(113,113,122,0.10)", border: "rgba(113,113,122,0.25)" },
  applied:      { label: "Applied",      fg: "#3B82F6", bg: "rgba(59,130,246,0.10)",  border: "rgba(59,130,246,0.25)" },
  interviewing: { label: "Interviewing", fg: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)" },
  offer:        { label: "Offer",        fg: "#10B981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.25)" },
  accepted:     { label: "Accepted",     fg: "#2F6B4F", bg: "rgba(47,107,79,0.12)",   border: "rgba(47,107,79,0.30)" },
  rejected:     { label: "Rejected",     fg: "#F43F5E", bg: "rgba(244,63,94,0.10)",   border: "rgba(244,63,94,0.25)" },
  archived:     { label: "Archived",     fg: "#A1A1AA", bg: "rgba(161,161,170,0.10)", border: "rgba(161,161,170,0.22)" },
};

type SortKey = "recent" | "match" | "company" | "title";

interface Props {
  onNavigate?: (view: ViewId) => void;
}

/* ── Shared inline styles ────────────────────────────────────────────────── */
const cardStyle: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24,
  padding: 24, boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
};
const inputStyle: React.CSSProperties = {
  height: 44, background: "var(--muted)", border: "1px solid var(--border)",
  borderRadius: 12, padding: "0 14px", fontFamily: "inherit", fontSize: 14,
  color: "var(--foreground)", outline: "none", width: "100%",
};
const primaryBtn: React.CSSProperties = {
  height: 44, padding: "0 18px", background: "var(--primary)", color: "#FFF",
  border: "1px solid var(--primary)", borderRadius: 12, fontFamily: "inherit",
  fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex",
  alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(217,119,87,0.25)",
};
const ghostBtn: React.CSSProperties = {
  height: 44, padding: "0 16px", background: "var(--muted)", color: "var(--foreground)",
  border: "1px solid var(--border)", borderRadius: 12, fontFamily: "inherit",
  fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex",
  alignItems: "center", gap: 8,
};

export function JobPostingsWorkspace({ onNavigate }: Props) {
  const { profile, updateProfile } = useUserProfile();
  const { postings, addPosting, addPostings, updatePosting, deletePosting } = useJobPostings();

  const targetRoles = profile.targetRoles ?? [];
  const targetCompanies = profile.targetCompanies ?? [];

  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [detailId, setDetailId] = useState<string | null>(null);

  /* ── Filters & sort ───────────────────────────────────────────────────── */
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [favOnly, setFavOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  const visible = useMemo(() => {
    let list = [...postings];
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (sourceFilter !== "all") list = list.filter((p) => p.source === sourceFilter);
    if (favOnly) list = list.filter((p) => p.favorite);
    list.sort((a, b) => {
      switch (sortKey) {
        case "match": return (b.matchScore ?? -1) - (a.matchScore ?? -1);
        case "company": return (a.company ?? "").localeCompare(b.company ?? "");
        case "title": return a.title.localeCompare(b.title);
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return list;
  }, [postings, statusFilter, sourceFilter, favOnly, sortKey]);

  const detail = postings.find((p) => p.id === detailId) ?? null;
  const selectedRole = targetRoles.find((r) => r.id === selectedRoleId) ?? targetRoles[0];

  /* ── Target role / company mutations ──────────────────────────────────── */
  const saveRoles = (roles: TargetRole[]) => updateProfile({ targetRoles: roles });
  const saveCompanies = (companies: TargetCompany[]) => updateProfile({ targetCompanies: companies });

  return (
    <div className="flex-1 h-full overflow-y-auto no-scrollbar" style={{ background: "var(--background)", padding: "32px 40px 80px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}
        className="animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Header */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Apply</div>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)", margin: 0 }}>
            Targeted Job Postings
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 8, maxWidth: 640, lineHeight: 1.6 }}>
            Add a target role and we'll surface live postings across many employers — then tailor your
            resume and cover letter for each one. We never auto-apply — you stay in control.
          </p>
        </div>

        <TargetsPanel
          roles={targetRoles}
          companies={targetCompanies}
          onSaveRoles={saveRoles}
          onSaveCompanies={saveCompanies}
        />

        <DiscoverPanel
          roles={targetRoles}
          companies={targetCompanies}
          selectedRole={selectedRole}
          selectedRoleId={selectedRole?.id ?? ""}
          onSelectRole={setSelectedRoleId}
          existing={postings}
          onAdd={addPosting}
          onAddMany={addPostings}
          onConfigure={() => onNavigate?.("profile_settings")}
        />

        <TrackedBoard
          postings={visible}
          total={postings.length}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
          favOnly={favOnly} setFavOnly={setFavOnly}
          sortKey={sortKey} setSortKey={setSortKey}
          onOpen={setDetailId}
          onToggleFav={(p) => updatePosting(p.id, { favorite: !p.favorite })}
          onStatus={(p, s) => updatePosting(p.id, { status: s, appliedAt: s === "applied" && !p.appliedAt ? new Date().toISOString() : p.appliedAt })}
        />
      </div>

      {detail && (
        <DetailDrawer
          posting={detail}
          profile={profile}
          onClose={() => setDetailId(null)}
          onUpdate={(patch) => updatePosting(detail.id, patch)}
          onDelete={() => { deletePosting(detail.id); setDetailId(null); }}
          onNavigate={onNavigate}
          onSaveCoverLetter={(cl) => updateProfile({ savedCoverLetters: [...(profile.savedCoverLetters ?? []), cl] })}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Targets panel — manage target roles + companies
   ───────────────────────────────────────────────────────────────────────── */
function TargetsPanel({
  roles, companies, onSaveRoles, onSaveCompanies,
}: {
  roles: TargetRole[];
  companies: TargetCompany[];
  onSaveRoles: (r: TargetRole[]) => void;
  onSaveCompanies: (c: TargetCompany[]) => void;
}) {
  const [roleTitle, setRoleTitle] = useState("");
  const [roleKeywords, setRoleKeywords] = useState("");
  const [roleLocation, setRoleLocation] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [showCompanies, setShowCompanies] = useState(companies.length > 0);

  const addRole = () => {
    const title = roleTitle.trim();
    if (!title) return;
    const role: TargetRole = {
      id: generateId(),
      title,
      keywords: roleKeywords.split(",").map((k) => k.trim()).filter(Boolean),
      location: roleLocation.trim() || undefined,
    };
    onSaveRoles([...roles, role]);
    setRoleTitle(""); setRoleKeywords(""); setRoleLocation("");
  };

  const addCompany = () => {
    setCompanyError("");
    const detected = detectAtsFromUrl(companyUrl);
    if (!detected) {
      setCompanyError("Paste a Greenhouse, Lever, or Ashby careers URL (e.g. boards.greenhouse.io/acme).");
      return;
    }
    const name = companyName.trim() || detected.boardToken;
    onSaveCompanies([...companies, { id: generateId(), name, ats: detected.ats, boardToken: detected.boardToken }]);
    setCompanyUrl(""); setCompanyName("");
  };

  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Roles — the only required input */}
      <div>
        <SectionHeading icon={Target} title="Target roles" sub="The only thing you need — drives search + scans" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {roles.length === 0 && <Empty text="Add a role to get started — e.g. “Product Manager”." />}
          {roles.map((r) => (
            <Chip key={r.id} onRemove={() => onSaveRoles(roles.filter((x) => x.id !== r.id))}>
              <strong>{r.title}</strong>
              {r.keywords && r.keywords.length > 0 && (
                <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}> · {r.keywords.join(", ")}</span>
              )}
              {r.location && <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}> · {r.location}</span>}
            </Chip>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...inputStyle, flex: "2 1 220px" }} placeholder="Role title (e.g. Senior Product Manager)" value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()} />
          <input style={{ ...inputStyle, flex: "2 1 180px" }} placeholder="Keywords, comma-separated (optional)" value={roleKeywords}
            onChange={(e) => setRoleKeywords(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()} />
          <input style={{ ...inputStyle, flex: "1 1 120px" }} placeholder="Location (optional)" value={roleLocation}
            onChange={(e) => setRoleLocation(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRole()} />
          <button style={{ ...primaryBtn, flexShrink: 0 }} onClick={addRole}><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>
      </div>

      {/* Companies — optional advanced add-on (we already scan a default set) */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <button onClick={() => setShowCompanies((s) => !s)}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
          <Building className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Watch specific companies</span>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            Optional{companies.length > 0 ? ` · ${companies.length} added` : " — we already scan popular boards"}
          </span>
          {showCompanies ? <ChevronUp className="w-4 h-4" style={{ color: "var(--muted-foreground)", marginLeft: "auto" }} />
            : <ChevronDown className="w-4 h-4" style={{ color: "var(--muted-foreground)", marginLeft: "auto" }} />}
        </button>

        {showCompanies && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {companies.map((c) => (
                <Chip key={c.id} onRemove={() => onSaveCompanies(companies.filter((x) => x.id !== c.id))}>
                  <strong>{c.name}</strong>
                  <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}> · {c.ats}</span>
                </Chip>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input style={{ ...inputStyle, flex: "2 1 260px" }} placeholder="Careers URL (boards.greenhouse.io/acme, jobs.lever.co/acme…)"
                value={companyUrl} onChange={(e) => { setCompanyUrl(e.target.value); setCompanyError(""); }}
                onKeyDown={(e) => e.key === "Enter" && addCompany()} />
              <input style={{ ...inputStyle, flex: "1 1 140px" }} placeholder="Display name (optional)" value={companyName}
                onChange={(e) => setCompanyName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCompany()} />
              <button style={{ ...primaryBtn, flexShrink: 0 }} onClick={addCompany}><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            {companyError && <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 8 }}>{companyError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Discover panel — scan companies + web search
   ───────────────────────────────────────────────────────────────────────── */
function DiscoverPanel({
  roles, companies, selectedRole, selectedRoleId, onSelectRole, existing, onAdd, onAddMany, onConfigure,
}: {
  roles: TargetRole[];
  companies: TargetCompany[];
  selectedRole?: TargetRole;
  selectedRoleId: string;
  onSelectRole: (id: string) => void;
  existing: JobPosting[];
  onAdd: (p: NewPosting) => Promise<JobPosting | null>;
  onAddMany: (p: NewPosting[]) => Promise<number>;
  onConfigure: () => void;
}) {
  const [mode, setMode] = useState<"search" | "scan">("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scanResults, setScanResults] = useState<ScannedJob[]>([]);
  const [aggResults, setAggResults] = useState<AggregatorJob[]>([]);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [importDraft, setImportDraft] = useState<ImportedJobDraft | null>(null);
  const [urlInput, setUrlInput] = useState("");

  const keywords = useMemo(() => {
    const k = [...(selectedRole?.keywords ?? [])];
    if (selectedRole?.title) k.push(selectedRole.title);
    return k;
  }, [selectedRole]);

  const runScan = async () => {
    if (!selectedRole) { setError("Add a target role first."); return; }
    setError(""); setLoading(true); setScanResults([]);
    try {
      // includeSeed defaults true → scans the built-in board list + any of your companies.
      const { results, errors } = await scanJobs(companies, keywords);
      setScanResults(results);
      if (results.length === 0) {
        setError(errors.length ? `No matches. ${errors.slice(0, 3).map((e) => `${e.company}: ${e.error}`).join("; ")}` : "No roles matched your keywords.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async () => {
    const query = selectedRole?.title ?? "";
    if (!query) { setError("Add a target role first."); return; }
    setError(""); setLoading(true); setAggResults([]);
    try {
      const r = await searchAggregators(query);
      setAggResults(r);
      if (r.length === 0) setError("No matching postings found — try a broader role title.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const scannedToNew = (j: ScannedJob): NewPosting => ({
    title: j.title, company: j.company ?? undefined, location: j.location ?? undefined,
    description: j.description, url: j.url ?? undefined, source: "ats",
    externalId: j.externalId ?? undefined, employmentType: j.employmentType ?? undefined,
    remote: j.remote ?? undefined, targetRoleId: selectedRole?.id,
  });

  const aggToNew = (j: AggregatorJob): NewPosting => ({
    title: j.title, company: j.company ?? undefined, location: j.location ?? undefined,
    description: j.description, url: j.url ?? undefined, source: "web",
    externalId: j.externalId ?? undefined, remote: j.remote ?? undefined, targetRoleId: selectedRole?.id,
  });

  const aggKey = (j: AggregatorJob) => j.url ?? j.externalId ?? j.title;

  const saveAllScan = async () => {
    const n = await onAddMany(scanResults.map(scannedToNew));
    setError(n === 0 ? "All of these are already saved." : "");
  };

  const saveAllAgg = async () => {
    const n = await onAddMany(aggResults.map(aggToNew));
    setSavedKeys((s) => { const next = new Set(s); aggResults.forEach((j) => next.add(aggKey(j))); return next; });
    setError(n === 0 ? "All of these are already saved." : "");
  };

  const startImport = async (url: string) => {
    setError(""); setLoading(true);
    try {
      setImportDraft(await importJobFromUrl(url));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const existingExternal = useMemo(
    () => new Set(existing.filter((p) => p.externalId).map((p) => `${p.source}:${p.externalId}`)),
    [existing],
  );

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <SectionHeading icon={Search} title="Discover postings" sub="Search across employers, or scan company boards" noMargin />
        <div style={{ display: "inline-flex", background: "var(--muted)", borderRadius: 12, padding: 3 }}>
          {(["search", "scan"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{
                height: 34, padding: "0 16px", borderRadius: 9, border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                background: mode === m ? "var(--card)" : "transparent",
                color: mode === m ? "var(--foreground)" : "var(--muted-foreground)",
                boxShadow: mode === m ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}>
              {m === "search" ? "Search roles" : "Scan companies"}
            </button>
          ))}
        </div>
      </div>

      {/* Role selector + run — target role is the only requirement */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        {roles.length === 0 ? (
          <button style={ghostBtn} onClick={onConfigure}><Target className="w-3.5 h-3.5" /> Add a target role to begin</button>
        ) : (
          <>
            <select style={{ ...inputStyle, width: "auto", minWidth: 220, cursor: "pointer" }}
              value={selectedRoleId} onChange={(e) => onSelectRole(e.target.value)}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
            {mode === "search" ? (
              <button style={primaryBtn} onClick={runSearch} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Find jobs
              </button>
            ) : (
              <button style={primaryBtn} onClick={runScan} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Scan boards
              </button>
            )}
          </>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>
        {mode === "search"
          ? "Searches keyless job boards (Remotive, Arbeitnow, RemoteOK) — no setup required."
          : `Scans our built-in list of popular boards${companies.length > 0 ? ` + your ${companies.length} compan${companies.length === 1 ? "y" : "ies"}` : ""}, filtered to this role.`}
      </div>

      {error && <div style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12 }}>{error}</div>}

      {/* Manual URL import (search mode) */}
      {mode === "search" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input style={inputStyle} placeholder="…or paste a specific job URL to import"
            value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && urlInput.trim() && startImport(urlInput.trim())} />
          <button style={{ ...ghostBtn, flexShrink: 0 }} disabled={loading || !urlInput.trim()}
            onClick={() => startImport(urlInput.trim())}><Link2 className="w-3.5 h-3.5" /> Import</button>
        </div>
      )}

      {/* Aggregator search results — full postings, save directly */}
      {mode === "search" && aggResults.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{aggResults.length} postings</span>
            <button style={{ ...ghostBtn, height: 36 }} onClick={saveAllAgg}><Plus className="w-3.5 h-3.5" /> Save all</button>
          </div>
          {aggResults.map((j, i) => (
            <ResultRow key={`${j.externalId ?? j.url}-${i}`}
              title={j.title} sub={[j.company, j.location].filter(Boolean).join(" · ")}
              badge={j.provider} saved={savedKeys.has(aggKey(j))}
              onSave={() => { onAdd(aggToNew(j)); setSavedKeys((s) => new Set(s).add(aggKey(j))); }}
              onOpen={j.url ?? undefined} />
          ))}
        </div>
      )}

      {/* Scan results */}
      {mode === "scan" && scanResults.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{scanResults.length} matching roles</span>
            <button style={{ ...ghostBtn, height: 36 }} onClick={saveAllScan}><Plus className="w-3.5 h-3.5" /> Save all</button>
          </div>
          {scanResults.map((j, i) => {
            const saved = j.externalId ? existingExternal.has(`ats:${j.externalId}`) : false;
            return (
              <ResultRow key={`${j.externalId}-${i}`}
                title={j.title} sub={[j.company, j.location].filter(Boolean).join(" · ")}
                badge={j.ats} saved={saved}
                onSave={() => onAdd(scannedToNew(j))} onOpen={j.url ?? undefined} />
            );
          })}
        </div>
      )}

      {/* Import draft editor */}
      {importDraft && (
        <ImportDraftModal draft={importDraft} onClose={() => setImportDraft(null)}
          onSave={async (p) => {
            await onAdd(p);
            setImportDraft(null);
          }} roleId={selectedRole?.id} />
      )}
    </div>
  );
}

function ResultRow({
  title, sub, badge, saved, onSave, onOpen, saveLabel = "Save",
}: {
  title: string; sub?: string; badge?: string; saved?: boolean;
  onSave: () => void; onOpen?: string; saveLabel?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
      background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
      </div>
      {badge && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>{badge}</span>}
      {onOpen && (
        <a href={onOpen} target="_blank" rel="noreferrer" style={{ color: "var(--muted-foreground)", display: "flex", flexShrink: 0 }}>
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
      <button
        disabled={saved || done}
        onClick={() => { onSave(); setDone(true); }}
        style={{
          height: 34, padding: "0 12px", borderRadius: 9, flexShrink: 0,
          border: "1px solid var(--border)", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
          cursor: saved || done ? "default" : "pointer",
          background: saved || done ? "var(--muted)" : "var(--card)",
          color: saved || done ? "var(--muted-foreground)" : "var(--foreground)",
        }}>
        {saved ? "Saved" : done ? "Added" : saveLabel}
      </button>
    </div>
  );
}

function ImportDraftModal({
  draft, onClose, onSave, roleId,
}: {
  draft: ImportedJobDraft;
  onClose: () => void;
  onSave: (p: NewPosting) => void;
  roleId?: string;
}) {
  const [title, setTitle] = useState(draft.title ?? "");
  const [company, setCompany] = useState(draft.company ?? "");
  const [location, setLocation] = useState(draft.location ?? "");
  const [description, setDescription] = useState(draft.description);

  return (
    <Modal title="Import posting" sub="Review the details, then save to your board." onClose={onClose}>
      <input style={inputStyle} placeholder="Job title *" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <input style={inputStyle} placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <input style={inputStyle} placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <textarea style={{ ...inputStyle, height: 180, padding: 14, resize: "vertical" as const, lineHeight: 1.5 }}
        placeholder="Job description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <button style={primaryBtn} disabled={!title.trim()}
        onClick={() => onSave({
          title: title.trim(), company: company.trim() || undefined, location: location.trim() || undefined,
          description, url: draft.url, source: "web", targetRoleId: roleId,
        })}>
        Save to board
      </button>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Tracked board — sort / filter / favorite / status
   ───────────────────────────────────────────────────────────────────────── */
function TrackedBoard({
  postings, total, statusFilter, setStatusFilter, sourceFilter, setSourceFilter,
  favOnly, setFavOnly, sortKey, setSortKey, onOpen, onToggleFav, onStatus,
}: {
  postings: JobPosting[];
  total: number;
  statusFilter: JobStatus | "all"; setStatusFilter: (s: JobStatus | "all") => void;
  sourceFilter: string; setSourceFilter: (s: string) => void;
  favOnly: boolean; setFavOnly: (b: boolean) => void;
  sortKey: SortKey; setSortKey: (s: SortKey) => void;
  onOpen: (id: string) => void;
  onToggleFav: (p: JobPosting) => void;
  onStatus: (p: JobPosting, s: JobStatus) => void;
}) {
  const selStyle: React.CSSProperties = {
    height: 36, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10,
    padding: "0 10px", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--foreground)", cursor: "pointer",
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--foreground)", margin: 0 }}>
          Your board <span style={{ fontSize: 14, color: "var(--muted-foreground)", fontWeight: 500 }}>· {total}</span>
        </h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select style={selStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as JobStatus | "all")}>
            <option value="all">All statuses</option>
            {JOB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <select style={selStyle} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="all">All sources</option>
            <option value="ats">ATS</option>
            <option value="web">Web</option>
            <option value="manual">Manual</option>
          </select>
          <button style={{ ...selStyle, display: "inline-flex", alignItems: "center", gap: 6, color: favOnly ? "var(--primary)" : "var(--muted-foreground)" }}
            onClick={() => setFavOnly(!favOnly)}>
            <Star className="w-3.5 h-3.5" fill={favOnly ? "var(--primary)" : "none"} /> Favorites
          </button>
          <select style={selStyle} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="recent">Newest</option>
            <option value="match">Best match</option>
            <option value="company">Company A–Z</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "36px 1.8fr 1fr 90px 150px", gap: 14, padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
          {["", "Role · Company", "Location", "Match", "Status"].map((h, i) => <div key={i} className="eyebrow">{h}</div>)}
        </div>

        {postings.length === 0 ? (
          <div style={{ padding: "44px 20px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>
            {total === 0 ? "Nothing saved yet — scan companies or search the web above." : "No postings match these filters."}
          </div>
        ) : postings.map((p, i) => (
          <div key={p.id}
            style={{
              display: "grid", gridTemplateColumns: "36px 1.8fr 1fr 90px 150px", gap: 14, padding: "14px 20px",
              alignItems: "center", borderBottom: i < postings.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer",
            }}
            onClick={() => onOpen(p.id)}
            className="hover:bg-muted/40 transition-colors">
            <button onClick={(e) => { e.stopPropagation(); onToggleFav(p); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: p.favorite ? "var(--primary)" : "var(--muted-foreground)", display: "flex", padding: 0 }}>
              <Star className="w-4 h-4" fill={p.favorite ? "var(--primary)" : "none"} />
            </button>
            <div style={{ minWidth: 0 }}>
              <div className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.company ?? "—"}</div>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.location ?? "—"}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.matchScore != null ? "var(--foreground)" : "var(--muted-foreground)" }}>
              {p.matchScore != null ? `${p.matchScore}` : "—"}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <select
                value={p.status} onChange={(e) => onStatus(p, e.target.value as JobStatus)}
                style={{
                  height: 30, borderRadius: 9999, padding: "0 10px", cursor: "pointer",
                  fontFamily: "inherit", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
                  background: STATUS_META[p.status].bg, color: STATUS_META[p.status].fg,
                  border: `1px solid ${STATUS_META[p.status].border}`, outline: "none",
                }}>
                {JOB_STATUSES.map((s) => <option key={s} value={s} style={{ color: "var(--foreground)", background: "var(--card)" }}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Detail drawer — description + tailor & apply
   ───────────────────────────────────────────────────────────────────────── */
function DetailDrawer({
  posting, profile, onClose, onUpdate, onDelete, onNavigate, onSaveCoverLetter,
}: {
  posting: JobPosting;
  profile: ReturnType<typeof useUserProfile>["profile"];
  onClose: () => void;
  onUpdate: (patch: Partial<JobPosting>) => void;
  onDelete: () => void;
  onNavigate?: (view: ViewId) => void;
  onSaveCoverLetter: (cl: NonNullable<typeof profile.savedCoverLetters>[number]) => void;
}) {
  const [notes, setNotes] = useState(posting.notes ?? "");
  const [scoring, setScoring] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [coverDraft, setCoverDraft] = useState("");
  const [coverSaved, setCoverSaved] = useState(false);

  const resumeText = profile.resumeText
    ?? profile.savedResumes?.find((r) => r.text)?.text
    ?? profile.summary ?? "";

  const scoreFit = async () => {
    setScoring(true);
    try {
      const system = "You are an expert recruiter. Score how well a candidate fits a job from 0-100 based only on the evidence. Reply with ONLY the integer.";
      const prompt = `JOB:\n${posting.title} at ${posting.company ?? ""}\n${posting.description ?? ""}\n\nCANDIDATE:\nTarget role: ${profile.targetRole ?? ""}\nSkills: ${(profile.skills ?? []).join(", ")}\nResume/summary:\n${resumeText.slice(0, 4000)}\n\nReturn ONLY an integer 0-100.`;
      const raw = await generateWorkflowData(system, prompt, "claude-haiku-4-5-20251001");
      const n = parseInt((raw.match(/\d{1,3}/)?.[0] ?? ""), 10);
      if (!Number.isNaN(n)) onUpdate({ matchScore: Math.min(100, Math.max(0, n)) });
    } finally {
      setScoring(false);
    }
  };

  const generateCover = async () => {
    setGenerating(true); setCoverSaved(false);
    try {
      const system = "You are an expert career writer. Write a concise, specific, one-page cover letter tailored to the job using only the candidate's real background. No placeholders like [Your Name]; use the provided name. Output plain text only.";
      const name = profile.fullName || profile.preferredName || "";
      const prompt = `Write a cover letter for this job.\n\nJOB:\n${posting.title} at ${posting.company ?? ""}\n${posting.description ?? ""}\n\nCANDIDATE:\nName: ${name}\nTarget role: ${profile.targetRole ?? ""}\nSkills: ${(profile.skills ?? []).join(", ")}\nBackground:\n${resumeText.slice(0, 4000)}`;
      setCoverDraft(await generateWorkflowData(system, prompt, "claude-sonnet-4-6"));
    } finally {
      setGenerating(false);
    }
  };

  const saveCover = () => {
    onSaveCoverLetter({
      id: generateId(),
      name: `${posting.title} — ${posting.company ?? "cover letter"}`,
      storagePath: "",
      text: coverDraft,
      jobTitle: posting.title,
      company: posting.company ?? "",
      createdAt: new Date().toISOString(),
    });
    setCoverSaved(true);
  };

  const savedResumes = profile.savedResumes ?? [];
  const savedCovers = profile.savedCoverLetters ?? [];
  const meta = STATUS_META[posting.status];

  return (
    <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-200"
      style={{ background: "rgba(31,27,22,0.4)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="animate-in slide-in-from-right duration-300 h-full overflow-y-auto no-scrollbar"
        style={{ background: "var(--card)", width: "100%", maxWidth: 560, boxShadow: "-20px 0 60px rgba(0,0,0,0.18)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--card)", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em", margin: 0 }}>{posting.title}</h2>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
                {[posting.company, posting.location].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => onUpdate({ favorite: !posting.favorite })} title="Favorite"
                style={{ width: 34, height: 34, borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: posting.favorite ? "var(--primary)" : "var(--muted-foreground)" }}>
                <Star className="w-4 h-4" fill={posting.favorite ? "var(--primary)" : "none"} />
              </button>
              <button onClick={onDelete} title="Delete"
                style={{ width: 34, height: 34, borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}>
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={onClose}
                style={{ width: 34, height: 34, borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{ background: meta.bg, color: meta.fg, border: `1px solid ${meta.border}`, padding: "5px 12px", borderRadius: 9999, fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.16em" }}>{meta.label}</span>
            {posting.matchScore != null && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Fit score: <strong style={{ color: "var(--foreground)" }}>{posting.matchScore}</strong></span>}
            {posting.url && (
              <a href={posting.url} target="_blank" rel="noreferrer" style={{ ...primaryBtn, height: 34, textDecoration: "none", marginLeft: "auto" }}>
                Open posting <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Tailor & apply */}
          <section>
            <SectionHeading icon={Sparkles} title="Tailor & apply" sub="Customize for this job — we never auto-apply" />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Score fit */}
              <button style={ghostBtn} onClick={scoreFit} disabled={scoring}>
                {scoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Score my fit
              </button>

              {/* Resume */}
              <div>
                <Label icon={FileText} text="Resume" />
                <div style={{ display: "flex", gap: 8 }}>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={posting.appliedResumeId ?? ""}
                    onChange={(e) => onUpdate({ appliedResumeId: e.target.value || undefined })}>
                    <option value="">Attach a resume…</option>
                    {savedResumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button style={{ ...ghostBtn, flexShrink: 0 }} onClick={() => onNavigate?.("resume_generation")}>
                    Tailor <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Cover letter */}
              <div>
                <Label icon={Mail} text="Cover letter" />
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={posting.appliedCoverLetterId ?? ""}
                    onChange={(e) => onUpdate({ appliedCoverLetterId: e.target.value || undefined })}>
                    <option value="">Attach a cover letter…</option>
                    {savedCovers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button style={{ ...ghostBtn, flexShrink: 0 }} onClick={() => onNavigate?.("cover_letter")}>
                    Builder <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button style={{ ...ghostBtn, width: "100%", justifyContent: "center" }} onClick={generateCover} disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Generate a tailored draft
                </button>
                {coverDraft && (
                  <div style={{ marginTop: 8 }}>
                    <textarea value={coverDraft} onChange={(e) => { setCoverDraft(e.target.value); setCoverSaved(false); }}
                      style={{ ...inputStyle, height: 200, padding: 14, resize: "vertical" as const, lineHeight: 1.5 }} />
                    <button style={{ ...primaryBtn, marginTop: 8 }} onClick={saveCover} disabled={coverSaved}>
                      {coverSaved ? "Saved to your cover letters" : "Save cover letter"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Notes + status */}
          <section>
            <SectionHeading icon={Briefcase} title="Application" sub="Status, dates & notes" />
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={posting.status}
                onChange={(e) => {
                  const s = e.target.value as JobStatus;
                  onUpdate({ status: s, appliedAt: s === "applied" && !posting.appliedAt ? new Date().toISOString() : posting.appliedAt });
                }}>
                {JOB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
            <textarea placeholder="Notes — recruiter name, referral, next steps…" value={notes}
              onChange={(e) => setNotes(e.target.value)} onBlur={() => onUpdate({ notes })}
              style={{ ...inputStyle, height: 100, padding: 14, resize: "vertical" as const, lineHeight: 1.5 }} />
          </section>

          {/* Description */}
          {posting.description && (
            <section>
              <SectionHeading icon={FileText} title="Job description" />
              <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.6, whiteSpace: "pre-wrap", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, maxHeight: 360, overflowY: "auto" }}>
                {posting.description}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Small shared bits ───────────────────────────────────────────────────── */
function SectionHeading({ icon: Icon, title, sub, noMargin }: { icon: React.ElementType; title: string; sub?: string; noMargin?: boolean }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon className="w-4 h-4" style={{ color: "var(--primary)" }} />
        <h3 className="font-display" style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)", margin: 0 }}>{title}</h3>
      </div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3, marginLeft: 24 }}>{sub}</div>}
    </div>
  );
}

function Label({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      <Icon className="w-3.5 h-3.5" /> {text}
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 14, color: "var(--foreground)" }}>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span>
      <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", padding: 0, flexShrink: 0 }}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: "var(--muted-foreground)", padding: "8px 2px" }}>{text}</div>;
}

function Modal({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ background: "rgba(31,27,22,0.4)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="animate-in zoom-in-95 duration-200"
        style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, width: "100%", maxWidth: 520, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "22px 26px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="font-display" style={{ fontSize: 20, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em" }}>{title}</div>
            {sub && <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>{sub}</div>}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, background: "var(--muted)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div style={{ padding: 26, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}
