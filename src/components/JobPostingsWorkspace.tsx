import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search, Plus, X, Star, Link2, Loader2, Sparkles, MapPin,
  Trash2, ExternalLink, Briefcase, FileText, Mail, ArrowRight,
} from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { useJobPostings, type NewPosting } from "@/hooks/useJobPostings";
import {
  searchAggregators, scanJobs, importJobFromUrl, type ImportedJobDraft,
} from "@/services/jobScanService";
import { scoreJobFit, fitLabel, buildDefaultQuery, canScoreProfile, RECOMMENDED_THRESHOLD, type FitFactor, type ScorableJob } from "@/services/jobRecommendation";
import {
  makeLocationMatcher, suggestLocations, classifyLevel, classifyWorkplace,
  JOB_LEVELS, WORKPLACE_TYPES, type JobLevel, type Workplace,
} from "@/lib/jobFilters";
import { companyLogoSources, companyMonogram } from "@/lib/companyLogo";
import { expandRoleQuery, roleSearchTerms } from "@/lib/roleSynonyms";
import { JobDescription } from "@/components/JobDescription";
import { generateWorkflowData } from "@/services/geminiService";
import { generateId } from "@/types/userProfile";
import {
  JOB_STATUSES, type JobPosting, type JobStatus, type AggregatorJob, type ScannedJob,
} from "@/types/jobPosting";
import type { ViewId } from "@/components/Sidebar";

/* ── Status presentation ─────────────────────────────────────────────────── */
const STATUS_META: Record<JobStatus, { label: string; fg: string; bg: string; border: string }> = {
  suggested:    { label: "Suggested",    fg: "#D97757", bg: "rgba(217,119,87,0.10)",  border: "rgba(217,119,87,0.25)" },
  saved:        { label: "Saved",        fg: "#71717A", bg: "rgba(113,113,122,0.10)", border: "rgba(113,113,122,0.25)" },
  applied:      { label: "Applied",      fg: "#3B82F6", bg: "rgba(59,130,246,0.10)",  border: "rgba(59,130,246,0.25)" },
  interviewing: { label: "Interviewing", fg: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)" },
  offer:        { label: "Offer",        fg: "#10B981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.25)" },
  accepted:     { label: "Accepted",     fg: "#2F6B4F", bg: "rgba(47,107,79,0.12)",   border: "rgba(47,107,79,0.30)" },
  rejected:     { label: "Rejected",     fg: "#F43F5E", bg: "rgba(244,63,94,0.10)",   border: "rgba(244,63,94,0.25)" },
  archived:     { label: "Archived",     fg: "#A1A1AA", bg: "rgba(161,161,170,0.10)", border: "rgba(161,161,170,0.22)" },
};

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
const filterSelectStyle: React.CSSProperties = {
  height: 38, background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 10,
  padding: "0 12px", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
  color: "var(--foreground)", cursor: "pointer", outline: "none",
};

/** A unified row: either a saved/tracked posting, or a fresh (unsaved) search result. */
interface ListItem {
  key: string;
  title: string;
  company?: string;
  location?: string;
  url?: string;
  score: number;
  factors: FitFactor[];     // per-factor breakdown, shown on hover over the fit score
  posting?: JobPosting;     // present when this job is on the board
  result?: NewPosting;      // present when this is an unsaved search result (either source)
}

export function JobPostingsWorkspace({ onNavigate }: Props) {
  const { profile, updateProfile } = useUserProfile();
  const { postings, addPosting, updatePosting, deletePosting } = useJobPostings();

  const [detailId, setDetailId] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);

  /* ── Search + filters ─────────────────────────────────────────────────── */
  const defaults = useMemo(() => buildDefaultQuery(profile), [profile]);
  const [keyword, setKeyword] = useState(defaults.keyword);
  const [location, setLocation] = useState(defaults.location);
  const [level, setLevel] = useState<JobLevel | "any">("any");
  const [workplace, setWorkplace] = useState<Workplace | "any">("any");
  const [results, setResults] = useState<NewPosting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [importDraft, setImportDraft] = useState<ImportedJobDraft | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<ListItem | null>(null);

  const aggToNew = (j: AggregatorJob): NewPosting => ({
    title: j.title, company: j.company ?? undefined, location: j.location ?? undefined,
    description: j.description, url: j.url ?? undefined, source: "web",
    externalId: j.externalId ?? undefined, remote: j.remote ?? undefined,
  });
  const scannedToNew = (j: ScannedJob): NewPosting => ({
    title: j.title, company: j.company ?? undefined, location: j.location ?? undefined,
    description: j.description, url: j.url ?? undefined, source: "ats",
    externalId: j.externalId ?? undefined, employmentType: j.employmentType ?? undefined,
    remote: j.remote ?? undefined,
  });

  // Search BOTH sources and consolidate: keyless aggregators (Workable global +
  // Remotive) AND the public ATS boards of our seed companies (Stripe, Visa,
  // Anthropic, McDonald's, …) plus any the user follows. The query is first
  // expanded across role synonyms/abbreviations (SWE/SDE → Software Engineer,
  // TPM → Technical Program Manager, …) and each phrase is searched. Everything
  // merges into one deduped list; location/level/workplace are live filters
  // applied afterwards (see the items memo), so changing one never re-fetches.
  const runSearch = async (kw = keyword) => {
    const query = kw.trim();
    if (!query) { setError("Type a job title to search."); return; }
    const phrases = expandRoleQuery(query);
    const terms = roleSearchTerms(phrases);
    setError(""); setLoading(true); setSearched(true);
    try {
      const settled = await Promise.allSettled([
        ...phrases.map((ph) => searchAggregators(ph, [])),
        scanJobs(profile.targetCompanies ?? [], terms, true, []),
      ]);

      const merged: NewPosting[] = [];
      const seen = new Set<string>();
      const push = (p: NewPosting) => {
        const k1 = p.externalId ? `${p.source}:${p.externalId}` : "";
        const k2 = p.url ?? "";
        const k3 = `${(p.company ?? "").toLowerCase()}|${p.title.toLowerCase()}`;
        if ((k1 && seen.has(k1)) || (k2 && seen.has(k2)) || seen.has(k3)) return;
        if (k1) seen.add(k1);
        if (k2) seen.add(k2);
        seen.add(k3);
        merged.push(p);
      };
      settled.forEach((s, i) => {
        if (s.status !== "fulfilled") return;
        if (i < phrases.length) (s.value as AggregatorJob[]).forEach((j) => push(aggToNew(j)));
        else (s.value as { results: ScannedJob[] }).results.forEach((j) => push(scannedToNew(j)));
      });

      setResults(merged);
      if (merged.length === 0) {
        const allFailed = settled.every((s) => s.status === "rejected");
        setError(allFailed ? "Search failed — please try again." : "No matching postings — try a broader title.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  // Auto-populate the board once on load using the profile-derived query, so the
  // user lands on relevant, recommended jobs without lifting a finger.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoRan.current && defaults.keyword) {
      autoRan.current = true;
      runSearch(defaults.keyword);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults.keyword]);

  // Only show fit scores when the profile has enough to personalize against.
  const personalized = useMemo(() => canScoreProfile(profile), [profile]);

  /* ── Unified list — profile-scored only when the profile can be personalized ── */
  const items = useMemo<ListItem[]>(() => {
    const saved = new Set(postings.filter((p) => p.externalId).map((p) => `${p.source}:${p.externalId}`));
    const savedUrls = new Set(postings.filter((p) => p.url).map((p) => p.url));

    const matchesLocation = makeLocationMatcher(location.trim());
    const passesFacets = (j: { title: string; location?: string; description?: string; remote?: boolean }) => {
      if (!matchesLocation(j.location, j.remote)) return false;
      if (level !== "any" && classifyLevel(j.title) !== level) return false;
      if (workplace !== "any" && classifyWorkplace(j) !== workplace) return false;
      return true;
    };
    const fit = (j: { title: string; company?: string | null; description?: string | null }) =>
      personalized ? scoreJobFit(j, profile) : { score: 0, factors: [] as FitFactor[] };

    const fromPostings: ListItem[] = postings
      .filter((p) => passesFacets({ title: p.title, location: p.location, description: p.description, remote: p.remote }))
      .map((p) => {
        const { score, factors } = fit(p);
        return {
          key: `p:${p.id}`, title: p.title, company: p.company, location: p.location,
          url: p.url, score: p.matchScore ?? score, factors, posting: p,
        };
      });

    // Unsaved results from BOTH sources (web + ats), minus anything already saved.
    let fromResults: ListItem[] = savedOnly
      ? []
      : results
          .filter((j) => !(j.externalId && saved.has(`${j.source}:${j.externalId}`)) && !(j.url && savedUrls.has(j.url)))
          .filter((j) => passesFacets({ title: j.title, location: j.location, description: j.description, remote: j.remote }))
          .map((j) => {
            const { score, factors } = fit(j);
            return {
              key: `r:${j.source}:${j.externalId ?? j.url ?? j.title}`, title: j.title,
              company: j.company ?? undefined, location: j.location ?? undefined,
              url: j.url ?? undefined, score, factors, result: j,
            };
          });
    if (personalized) fromResults.sort((a, b) => b.score - a.score);
    fromResults = fromResults.slice(0, 80); // keep the list focused

    // Personalized → best fit first (saved wins ties). Otherwise keep the natural
    // order: tracked jobs first, then the search's own relevance ranking.
    return personalized
      ? [...fromPostings, ...fromResults].sort((a, b) => b.score - a.score || (a.posting ? 0 : 1) - (b.posting ? 0 : 1))
      : [...fromPostings, ...fromResults];
  }, [postings, results, profile, personalized, savedOnly, location, level, workplace]);

  const detail = postings.find((p) => p.id === detailId) ?? null;
  const recommendedCount = items.filter((i) => i.score >= RECOMMENDED_THRESHOLD).length;

  // Clicking a job opens it in-app. Saved postings → the full detail drawer;
  // unsaved search results → a read-only PREVIEW (description + fit) with no
  // commitment, so the user never has to leave the app to read the posting.
  const openItem = (item: ListItem) => {
    if (item.posting) setDetailId(item.posting.id);
    else if (item.result) setPreview(item);
  };

  // Save an unsaved result; optionally jump straight into its tailor-&-apply drawer.
  const saveItem = async (item: ListItem, openDrawer = false) => {
    if (!item.result) return;
    setSavingKey(item.key);
    const p = await addPosting(item.result);
    setSavingKey(null);
    if (openDrawer && p) { setPreview(null); setDetailId(p.id); }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto no-scrollbar" style={{ background: "var(--background)", padding: "32px 40px 80px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}
        className="animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Header */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Apply</div>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)", margin: 0 }}>
            Find your next role
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 8, maxWidth: 640, lineHeight: 1.6 }}>
            Search by title and location — we rank every posting against your profile, skills, and
            experience, then help you tailor a resume and cover letter. We never auto-apply.
          </p>
        </div>

        {/* Search bar — just title + location */}
        <div style={{ ...cardStyle, padding: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "3 1 260px" }}>
              <Search className="w-4 h-4" style={{ position: "absolute", left: 14, top: 14, color: "var(--muted-foreground)" }} />
              <input style={{ ...inputStyle, paddingLeft: 38 }} placeholder="Job title or keywords (e.g. Product Manager)"
                value={keyword} onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()} />
            </div>
            <div style={{ position: "relative", flex: "2 1 180px" }}>
              <MapPin className="w-4 h-4" style={{ position: "absolute", left: 14, top: 14, color: "var(--muted-foreground)" }} />
              <input style={{ ...inputStyle, paddingLeft: 38 }} placeholder="City, state, or country" list="loc-suggestions"
                value={location} onChange={(e) => setLocation(e.target.value)} />
              {location && (
                <button onClick={() => setLocation("")} title="Clear location"
                  style={{ position: "absolute", right: 10, top: 12, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", padding: 0 }}>
                  <X className="w-4 h-4" />
                </button>
              )}
              <datalist id="loc-suggestions">
                {suggestLocations(location).map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <button style={{ ...primaryBtn, flexShrink: 0 }} onClick={() => runSearch()} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Search
            </button>
          </div>

          {/* Facet filters — level + workplace (applied live, no re-search needed) */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <select style={filterSelectStyle} value={level} onChange={(e) => setLevel(e.target.value as JobLevel | "any")}
              title="Experience level — by typical years of experience">
              <option value="any">Any level</option>
              {JOB_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label} · {l.years}</option>)}
            </select>
            <select style={filterSelectStyle} value={workplace} onChange={(e) => setWorkplace(e.target.value as Workplace | "any")}>
              <option value="any">Remote, hybrid or on-site</option>
              {WORKPLACE_TYPES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
            {(level !== "any" || workplace !== "any" || location.trim()) && (
              <button onClick={() => { setLevel("any"); setWorkplace("any"); setLocation(""); }}
                style={{ ...filterSelectStyle, width: "auto", cursor: "pointer", color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
          </div>
          {error && <div style={{ fontSize: 13, color: "var(--primary)", marginTop: 10 }}>{error}</div>}
          <div style={{ marginTop: 10 }}>
            <button onClick={() => setShowImport((s) => !s)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: 12, color: "var(--muted-foreground)" }}>
              <Link2 className="w-3.5 h-3.5" /> Have a specific posting? Add it by URL
            </button>
            {showImport && (
              <UrlImport
                onImport={async (url) => { setImportDraft(await importJobFromUrl(url)); }}
              />
            )}
          </div>
        </div>

        {/* Complete-profile prompt — shown when we can't personalize yet */}
        {!personalized && (
          <div style={{ ...cardStyle, padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", border: "1px solid rgba(217,119,87,0.30)", background: "rgba(217,119,87,0.05)" }}>
            <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: "rgba(217,119,87,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </div>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Get personalized results</div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>
                Add your skills, experience, and work history to your profile, and we'll score and rank every job by how well it fits you.
              </div>
            </div>
            <button style={{ ...primaryBtn, flexShrink: 0 }} onClick={() => onNavigate?.("profile_settings")}>
              Complete profile <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Unified list */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--foreground)", margin: 0 }}>
              {savedOnly ? "Your saved jobs" : personalized ? "Jobs for you" : "Jobs"}
              <span style={{ fontSize: 14, color: "var(--muted-foreground)", fontWeight: 500 }}> · {items.length}</span>
              {!savedOnly && personalized && recommendedCount > 0 && (
                <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600, marginLeft: 10 }}>{recommendedCount} recommended</span>
              )}
            </h3>
            <button
              onClick={() => setSavedOnly((s) => !s)}
              style={{
                height: 36, padding: "0 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6,
                background: savedOnly ? "var(--primary)" : "var(--card)",
                color: savedOnly ? "#FFF" : "var(--muted-foreground)",
                border: `1px solid ${savedOnly ? "var(--primary)" : "var(--border)"}`,
              }}>
              <Star className="w-3.5 h-3.5" fill={savedOnly ? "#FFF" : "none"} /> Saved only
            </button>
          </div>

          <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            {items.length === 0 ? (
              <div style={{ padding: "56px 20px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>
                {loading ? "Finding jobs that fit your profile…"
                  : savedOnly ? "No saved jobs yet — search above and save the ones you like."
                  : (level !== "any" || workplace !== "any" || location.trim()) ? "No jobs match these filters — try clearing the location, level, or workplace filter."
                  : searched ? "No jobs to show — try a different search."
                  : "Search by job title above to see roles ranked for you."}
              </div>
            ) : items.map((item, i) => (
              <JobRow key={item.key} item={item} last={i === items.length - 1}
                saving={savingKey === item.key}
                showScore={personalized}
                onOpen={() => openItem(item)}
                onSave={() => saveItem(item)}
                onToggleFav={item.posting ? () => updatePosting(item.posting!.id, { favorite: !item.posting!.favorite }) : undefined}
                onStatus={item.posting ? (s) => updatePosting(item.posting!.id, { status: s, appliedAt: s === "applied" && !item.posting!.appliedAt ? new Date().toISOString() : item.posting!.appliedAt }) : undefined}
              />
            ))}
          </div>
        </div>
      </div>

      {importDraft && (
        <ImportDraftModal draft={importDraft} onClose={() => setImportDraft(null)}
          onSave={async (p) => { const saved = await addPosting(p); setImportDraft(null); setShowImport(false); if (saved) setDetailId(saved.id); }} />
      )}

      {preview && (
        <PreviewDrawer
          item={preview}
          profile={profile}
          personalized={personalized}
          saving={savingKey === preview.key}
          onClose={() => setPreview(null)}
          onSave={() => { saveItem(preview); setPreview(null); }}
          onSaveAndTailor={() => saveItem(preview, true)}
        />
      )}

      {detail && (
        <DetailDrawer
          posting={detail}
          profile={profile}
          onClose={() => setDetailId(null)}
          onUpdate={(patch) => updatePosting(detail.id, patch)}
          onDelete={() => { deletePosting(detail.id); setDetailId(null); }}
          onNavigate={onNavigate}
          onSaveCoverLetter={(cl) => updateProfile({ savedCoverLetters: [...(profile.savedCoverLetters ?? []), cl] })}
          onSaveResume={(r) => updateProfile({ savedResumes: [...(profile.savedResumes ?? []), r] })}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Company logo — official logo via keyless CDNs, falling back to a monogram
   ───────────────────────────────────────────────────────────────────────── */
function CompanyLogo({ company, url, size = 40 }: { company?: string; url?: string; size?: number }) {
  const sources = useMemo(() => companyLogoSources(company, url), [company, url]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [company, url]);

  const radius = Math.round(size / 4);
  const src = sources[idx];

  if (!src) {
    const { letter, color } = companyMonogram(company);
    return (
      <div aria-hidden style={{
        width: size, height: size, flexShrink: 0, borderRadius: radius, background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-display, inherit)", fontWeight: 700, fontSize: size * 0.42,
      }}>{letter}</div>
    );
  }
  return (
    <img
      src={src}
      alt={company ? `${company} logo` : "Company logo"}
      width={size} height={size} loading="lazy"
      onError={() => setIdx((i) => i + 1)}
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: radius, objectFit: "contain",
        background: "#fff", border: "1px solid var(--border)", padding: 4,
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Fit score cell — shows the per-factor "why" breakdown on hover
   ───────────────────────────────────────────────────────────────────────── */
const fitBarColor = (s: number) => (s >= 60 ? "var(--primary)" : s >= 35 ? "#F59E0B" : "var(--muted-foreground)");

function FitScoreCell({ score, factors }: { score: number; factors: FitFactor[] }) {
  const recommended = score >= RECOMMENDED_THRESHOLD;
  const [rect, setRect] = useState<DOMRect | null>(null);

  return (
    <div
      onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
      style={{ flexShrink: 0, textAlign: "right", minWidth: 64, cursor: "help" }}
      aria-label={`${fitLabel(score)} · ${score}% fit. Hover for the breakdown.`}
    >
      <div style={{ fontSize: 17, fontWeight: 700, color: recommended ? "var(--primary)" : "var(--foreground)", lineHeight: 1 }}>
        {score}<span style={{ fontSize: 12, fontWeight: 600 }}>%</span>
      </div>
      <div className="eyebrow" style={{ fontSize: 9 }}>fit</div>

      {rect && createPortal(
        <div
          className="animate-in fade-in zoom-in-95 duration-150"
          style={{
            position: "fixed", zIndex: 200, width: 300, pointerEvents: "none",
            top: Math.min(rect.bottom + 8, window.innerHeight - 12),
            left: Math.max(12, Math.min(rect.right - 300, window.innerWidth - 312)),
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
            boxShadow: "0 16px 44px rgba(0,0,0,0.20)", padding: 14,
          }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{fitLabel(score)} · {score}% fit</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {factors.map((f) => (
              <div key={f.key}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>
                    {f.label}<span style={{ fontWeight: 500, color: "var(--muted-foreground)" }}> · {f.weight}% of score</span>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: fitBarColor(f.score) }}>{f.score}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 9999, background: "var(--muted)", marginTop: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${f.score}%`, background: fitBarColor(f.score), borderRadius: 9999 }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3, lineHeight: 1.45 }}>{f.detail}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 10 }}>Click the row for full details</div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Unified job row — works for both saved postings and fresh search results
   ───────────────────────────────────────────────────────────────────────── */
function JobRow({
  item, last, saving, showScore, onOpen, onSave, onToggleFav, onStatus,
}: {
  item: ListItem;
  last: boolean;
  saving: boolean;
  showScore: boolean;
  onOpen: () => void;
  onSave: () => void;
  onToggleFav?: () => void;
  onStatus?: (s: JobStatus) => void;
}) {
  const p = item.posting;
  const recommended = showScore && item.score >= RECOMMENDED_THRESHOLD;
  const meta = p ? STATUS_META[p.status] : null;
  const sub = [item.company, item.location].filter(Boolean).join(" · ") || "—";

  return (
    <div
      onClick={onOpen}
      className="hover:bg-muted/40 transition-colors"
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "16px 20px",
        borderBottom: last ? "none" : "1px solid var(--border)", cursor: "pointer",
      }}>
      {/* Favorite (saved only) */}
      {onToggleFav && (
        <button onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: p?.favorite ? "var(--primary)" : "var(--muted-foreground)", display: "flex", padding: 0, flexShrink: 0 }}>
          <Star className="w-4 h-4" fill={p?.favorite ? "var(--primary)" : "none"} />
        </button>
      )}

      {/* Company logo */}
      <CompanyLogo company={item.company} url={item.url} size={40} />

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
          {recommended && (
            <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary)", background: "rgba(217,119,87,0.10)", border: "1px solid rgba(217,119,87,0.25)", borderRadius: 9999, padding: "2px 8px" }}>
              <Sparkles className="w-3 h-3" /> Recommended
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
      </div>

      {/* Fit score (percentage) — hover for the per-factor breakdown. Hidden until the profile can be personalized. */}
      {showScore && <FitScoreCell score={item.score} factors={item.factors} />}

      {/* External link */}
      {item.url && (
        <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
          style={{ color: "var(--muted-foreground)", display: "flex", flexShrink: 0 }}>
          <ExternalLink className="w-4 h-4" />
        </a>
      )}

      {/* Status (saved) or Save (unsaved) */}
      {p && onStatus ? (
        <div onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <select
            value={p.status} onChange={(e) => onStatus(e.target.value as JobStatus)}
            style={{
              height: 30, borderRadius: 9999, padding: "0 10px", cursor: "pointer",
              fontFamily: "inherit", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
              background: meta!.bg, color: meta!.fg, border: `1px solid ${meta!.border}`, outline: "none",
            }}>
            {p.status === "suggested" && <option value="suggested">Suggested</option>}
            {JOB_STATUSES.map((s) => <option key={s} value={s} style={{ color: "var(--foreground)", background: "var(--card)" }}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); onSave(); }} disabled={saving}
          style={{
            height: 34, padding: "0 14px", borderRadius: 9, flexShrink: 0, border: "1px solid var(--primary)",
            background: "var(--primary)", color: "#FFF", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
            cursor: saving ? "default" : "pointer", display: "inline-flex", alignItems: "center", gap: 5,
          }}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Save
        </button>
      )}
    </div>
  );
}

/* ── Add a posting by URL (inline) ───────────────────────────────────────── */
function UrlImport({ onImport }: { onImport: (url: string) => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    if (!url.trim()) return;
    setErr(""); setBusy(true);
    try { await onImport(url.trim()); setUrl(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "Import failed"); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={inputStyle} placeholder="Paste a job posting URL" value={url}
          onChange={(e) => { setUrl(e.target.value); setErr(""); }}
          onKeyDown={(e) => e.key === "Enter" && go()} />
        <button style={{ ...ghostBtn, flexShrink: 0 }} disabled={busy || !url.trim()} onClick={go}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Import
        </button>
      </div>
      {err && <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 8 }}>{err}</div>}
    </div>
  );
}

function ImportDraftModal({
  draft, onClose, onSave,
}: {
  draft: ImportedJobDraft;
  onClose: () => void;
  onSave: (p: NewPosting) => void;
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
          description, url: draft.url, source: "web",
        })}>
        Save to board
      </button>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Fit breakdown — explains WHY the profile-fit percentage is what it is
   ───────────────────────────────────────────────────────────────────────── */
function FitBreakdown({ posting, profile }: { posting: ScorableJob; profile: ReturnType<typeof useUserProfile>["profile"] }) {
  const fit = useMemo(() => scoreJobFit(posting, profile), [posting, profile]);
  const label = fitLabel(fit.score);
  const strong = fit.score >= RECOMMENDED_THRESHOLD;
  const barColor = (s: number) => (s >= 60 ? "var(--primary)" : s >= 35 ? "#F59E0B" : "var(--muted-foreground)");

  return (
    <section style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{
          flexShrink: 0, width: 60, height: 60, borderRadius: 14, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: strong ? "rgba(217,119,87,0.12)" : "var(--card)",
          border: `1px solid ${strong ? "rgba(217,119,87,0.30)" : "var(--border)"}`,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, color: strong ? "var(--primary)" : "var(--foreground)" }}>{fit.score}<span style={{ fontSize: 11 }}>%</span></div>
          <div className="eyebrow" style={{ fontSize: 8, marginTop: 2 }}>fit</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <h3 className="font-display" style={{ fontSize: 17, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{label}</h3>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3 }}>
            How well this posting matches your profile, skills, experience &amp; work history.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {fit.factors.map((f) => (
          <div key={f.key}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                {f.label}
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}> · {f.weight}% of score</span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: barColor(f.score) }}>{f.score}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 9999, background: "var(--card)", border: "1px solid var(--border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${f.score}%`, background: barColor(f.score), borderRadius: 9999, transition: "width 300ms ease" }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.5 }}>{f.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Preview drawer — read the job description in-app, no commitment to save
   ───────────────────────────────────────────────────────────────────────── */
function PreviewDrawer({
  item, profile, personalized, saving, onClose, onSave, onSaveAndTailor,
}: {
  item: ListItem;
  profile: ReturnType<typeof useUserProfile>["profile"];
  personalized: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onSaveAndTailor: () => void;
}) {
  const job = item.result!;
  const sub = [job.company, job.location].filter(Boolean).join(" · ") || "—";

  return (
    <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-200"
      style={{ background: "rgba(31,27,22,0.4)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="animate-in slide-in-from-right duration-300 h-full overflow-y-auto no-scrollbar flex flex-col"
        style={{ background: "var(--card)", width: "100%", maxWidth: 560, boxShadow: "-20px 0 60px rgba(0,0,0,0.18)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "24px 28px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--card)", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
              <CompanyLogo company={job.company} url={job.url} size={44} />
              <div style={{ minWidth: 0 }}>
                <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em", margin: 0 }}>{job.title}</h2>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>{sub}</div>
              </div>
            </div>
            <button onClick={onClose} title="Close"
              style={{ width: 34, height: 34, borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)", flexShrink: 0 }}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted-foreground)", border: "1px solid var(--border)", borderRadius: 9999, padding: "5px 12px" }}>Preview</span>
            {job.url && (
              <a href={job.url} target="_blank" rel="noreferrer" style={{ ...ghostBtn, height: 34, textDecoration: "none", marginLeft: "auto" }}>
                Open original <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
          {personalized && <FitBreakdown posting={job} profile={profile} />}

          <section>
            <SectionHeading icon={FileText} title="Job description" sub="Read it here — no need to leave the app" />
            <div style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <JobDescription description={job.description} url={job.url} />
            </div>
          </section>
        </div>

        {/* Sticky footer actions */}
        <div style={{ position: "sticky", bottom: 0, background: "var(--card)", borderTop: "1px solid var(--border)", padding: "16px 28px", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={{ ...primaryBtn, flex: "1 1 200px", justifyContent: "center" }} onClick={onSaveAndTailor} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Save &amp; tailor
          </button>
          <button style={{ ...ghostBtn, flex: "1 1 140px", justifyContent: "center" }} onClick={onSave} disabled={saving}>
            <Plus className="w-3.5 h-3.5" /> Save to board
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Detail drawer — description + tailor & apply
   ───────────────────────────────────────────────────────────────────────── */
function DetailDrawer({
  posting, profile, onClose, onUpdate, onDelete, onNavigate, onSaveCoverLetter, onSaveResume,
}: {
  posting: JobPosting;
  profile: ReturnType<typeof useUserProfile>["profile"];
  onClose: () => void;
  onUpdate: (patch: Partial<JobPosting>) => void;
  onDelete: () => void;
  onNavigate?: (view: ViewId) => void;
  onSaveCoverLetter: (cl: NonNullable<typeof profile.savedCoverLetters>[number]) => void;
  onSaveResume: (r: NonNullable<typeof profile.savedResumes>[number]) => void;
}) {
  const [notes, setNotes] = useState(posting.notes ?? "");
  const [scoring, setScoring] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [coverDraft, setCoverDraft] = useState("");
  const [coverSaved, setCoverSaved] = useState(false);
  const [resumeGenerating, setResumeGenerating] = useState(false);
  const [resumeDraft, setResumeDraft] = useState("");
  const [resumeSaved, setResumeSaved] = useState(false);

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
    const id = generateId();
    onSaveCoverLetter({
      id,
      name: `${posting.title} — ${posting.company ?? "cover letter"}`,
      storagePath: "",
      text: coverDraft,
      jobTitle: posting.title,
      company: posting.company ?? "",
      createdAt: new Date().toISOString(),
    });
    onUpdate({ appliedCoverLetterId: id }); // link it to this application
    setCoverSaved(true);
  };

  const generateResume = async () => {
    setResumeGenerating(true); setResumeSaved(false);
    try {
      const system = "You are an expert resume writer. Tailor the candidate's resume to THIS job using ONLY their real experience — never invent employers, titles, dates, or metrics. Surface the most relevant experience and weave in keywords from the job description. Output a clean, ATS-friendly resume in Markdown. No commentary.";
      const name = profile.fullName || profile.preferredName || "";
      const prompt = `Tailor a resume for this job.\n\nJOB:\n${posting.title} at ${posting.company ?? ""}\n${posting.description ?? ""}\n\nCANDIDATE:\nName: ${name}\nTarget role: ${profile.targetRole ?? ""}\nSkills: ${(profile.skills ?? []).join(", ")}\nExisting resume / background:\n${resumeText.slice(0, 6000)}`;
      setResumeDraft(await generateWorkflowData(system, prompt, "claude-sonnet-4-6"));
    } finally {
      setResumeGenerating(false);
    }
  };

  const saveResume = () => {
    const id = generateId();
    onSaveResume({
      id,
      name: `${posting.title} — ${posting.company ?? "resume"}`,
      storagePath: "",
      text: resumeDraft,
      createdAt: new Date().toISOString(),
    });
    onUpdate({ appliedResumeId: id }); // link it to this application
    setResumeSaved(true);
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
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
              <CompanyLogo company={posting.company} url={posting.url} size={44} />
              <div style={{ minWidth: 0 }}>
                <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em", margin: 0 }}>{posting.title}</h2>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
                  {[posting.company, posting.location].filter(Boolean).join(" · ") || "—"}
                </div>
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
            {posting.matchScore != null && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>AI fit score: <strong style={{ color: "var(--foreground)" }}>{posting.matchScore}%</strong></span>}
            {posting.url && (
              <a href={posting.url} target="_blank" rel="noreferrer" style={{ ...primaryBtn, height: 34, textDecoration: "none", marginLeft: "auto" }}>
                Open posting <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Why this fit score — profile-based breakdown (only when personalized) */}
          {canScoreProfile(profile) ? (
            <FitBreakdown posting={posting} profile={profile} />
          ) : (
            <button onClick={() => onNavigate?.("profile_settings")}
              style={{ ...ghostBtn, height: "auto", padding: "14px 16px", justifyContent: "flex-start", textAlign: "left", gap: 12, width: "100%" }}>
              <Sparkles className="w-4 h-4" style={{ color: "var(--primary)", flexShrink: 0 }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>See how well this fits you</span>
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted-foreground)", lineHeight: 1.5 }}>Complete your profile to get a personalized fit score and breakdown.</span>
              </span>
              <ArrowRight className="w-4 h-4" style={{ color: "var(--muted-foreground)", marginLeft: "auto", flexShrink: 0 }} />
            </button>
          )}

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
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={posting.appliedResumeId ?? ""}
                    onChange={(e) => onUpdate({ appliedResumeId: e.target.value || undefined })}>
                    <option value="">Attach a resume…</option>
                    {savedResumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button style={{ ...ghostBtn, flexShrink: 0 }} onClick={() => onNavigate?.("resume_generation")}>
                    Builder <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button style={{ ...ghostBtn, width: "100%", justifyContent: "center" }} onClick={generateResume} disabled={resumeGenerating}>
                  {resumeGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Generate a tailored resume
                </button>
                {resumeDraft && (
                  <div style={{ marginTop: 8 }}>
                    <textarea value={resumeDraft} onChange={(e) => { setResumeDraft(e.target.value); setResumeSaved(false); }}
                      style={{ ...inputStyle, height: 220, padding: 14, resize: "vertical" as const, lineHeight: 1.5, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }} />
                    <button style={{ ...primaryBtn, marginTop: 8 }} onClick={saveResume} disabled={resumeSaved}>
                      {resumeSaved ? "Saved & attached" : "Save resume"}
                    </button>
                  </div>
                )}
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

          {/* Description — formatted, and lazily fetched + persisted if missing */}
          {(posting.description || posting.url) && (
            <section>
              <SectionHeading icon={FileText} title="Job description" />
              <div style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, maxHeight: 420, overflowY: "auto" }}>
                <JobDescription
                  description={posting.description}
                  url={posting.url}
                  onLoaded={(text) => onUpdate({ description: text })}
                />
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
