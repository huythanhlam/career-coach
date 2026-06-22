import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, ArrowRight, Bell, Plus, X } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { useJobPostings, type NewPosting } from "@/hooks/useJobPostings";
import { TailorResumeWorkspace } from "@/components/TailorResumeWorkspace";
import {
  searchAggregators, scanJobs, importJobFromUrl, type ImportedJobDraft,
} from "@/services/jobScanService";
import { scoreJobFit, canScoreProfile, RECOMMENDED_THRESHOLD, buildDefaultQuery, type FitFactor } from "@/services/jobRecommendation";
import {
  makeLocationMatcher, classifyLevel, classifyWorkplace,
  type JobLevel, type Workplace,
} from "@/lib/jobFilters";
import { expandRoleQuery, roleSearchTerms } from "@/lib/roleSynonyms";
import {
  type JobPosting, type JobStatus, type AggregatorJob, type ScannedJob,
} from "@/types/jobPosting";
import type { ViewId } from "@/components/Sidebar";
import { cardStyle, primaryBtn, ghostBtn } from "./styles";
import { CompanyLogo } from "./_shared";
import { ScanControls } from "./ScanControls";
import { PostingList } from "./PostingList";
import { PostingDetail } from "./PostingDetail";

/** A unified row: either a saved/tracked posting, or a fresh (unsaved) search result. */
export interface ListItem {
  key: string;
  title: string;
  company?: string;
  location?: string;
  url?: string;
  score: number;
  factors: FitFactor[];
  posting?: JobPosting;
  result?: NewPosting;
}

interface Props {
  onNavigate?: (view: ViewId) => void;
}

export function JobPostingsWorkspace({ onNavigate }: Props) {
  const { profile, updateProfile } = useUserProfile();
  const { postings, addPosting, updatePosting, deletePosting } = useJobPostings();

  const [detailId, setDetailId] = useState<string | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [tailorPosting, setTailorPosting] = useState<JobPosting | null>(null);
  const [showAllSuggested, setShowAllSuggested] = useState(false);

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

  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoRan.current && defaults.keyword) {
      autoRan.current = true;
      runSearch(defaults.keyword);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults.keyword]);

  const personalized = useMemo(() => canScoreProfile(profile), [profile]);

  const suggested = useMemo(() => {
    const lane = postings
      .filter((p) => p.status === "suggested")
      .map((p) => ({ posting: p, fit: personalized ? scoreJobFit(p, profile) : { score: 0, factors: [] as FitFactor[] } }));
    if (personalized) lane.sort((a, b) => b.fit.score - a.fit.score);
    return lane;
  }, [postings, profile, personalized]);

  /* ── Unified list ─────────────────────────────────────────────────────── */
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
      .filter((p) => p.status !== "suggested")
      .filter((p) => passesFacets({ title: p.title, location: p.location, description: p.description, remote: p.remote }))
      .map((p) => {
        const { score, factors } = fit(p);
        return {
          key: `p:${p.id}`, title: p.title, company: p.company, location: p.location,
          url: p.url, score: p.matchScore ?? score, factors, posting: p,
        };
      });

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
    fromResults = fromResults.slice(0, 80);

    return personalized
      ? [...fromPostings, ...fromResults].sort((a, b) => b.score - a.score || (a.posting ? 0 : 1) - (b.posting ? 0 : 1))
      : [...fromPostings, ...fromResults];
  }, [postings, results, profile, personalized, savedOnly, location, level, workplace]);

  const detail = postings.find((p) => p.id === detailId) ?? null;
  const recommendedCount = items.filter((i) => i.score >= RECOMMENDED_THRESHOLD).length;

  const openItem = (item: ListItem) => {
    if (item.posting) setDetailId(item.posting.id);
    else if (item.result) setPreview(item);
  };

  const saveItem = async (item: ListItem, then?: "tailor") => {
    if (!item.result) return;
    setSavingKey(item.key);
    const p = await addPosting(item.result);
    setSavingKey(null);
    if (then === "tailor" && p) { setPreview(null); setTailorPosting(p); }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto no-scrollbar px-4 py-6 sm:px-10 sm:py-8 pb-20" style={{ background: "var(--background)" }}>
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

        <ScanControls
          keyword={keyword}
          location={location}
          level={level}
          workplace={workplace}
          loading={loading}
          showImport={showImport}
          error={error}
          onKeyword={setKeyword}
          onLocation={setLocation}
          onLevel={setLevel}
          onWorkplace={setWorkplace}
          onSearch={() => runSearch()}
          onShowImport={setShowImport}
          onUrlImport={async (url) => { setImportDraft(await importJobFromUrl(url)); }}
        />

        {/* Complete-profile prompt */}
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

        {/* Suggested this week — fresh matches delivered by the weekly scan */}
        {suggested.length > 0 && !savedOnly && (
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--foreground)", margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Bell className="w-4.5 h-4.5" style={{ width: 18, height: 18, color: "var(--primary)" }} />
                Suggested this week
                <span style={{ fontSize: 14, color: "var(--muted-foreground)", fontWeight: 500 }}>· {suggested.length}</span>
              </h3>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>New matches for your target roles — refreshed every Monday</span>
            </div>
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden", border: "1px solid rgba(217,119,87,0.30)" }}>
              {(showAllSuggested ? suggested : suggested.slice(0, 6)).map(({ posting: p, fit }, i, shown) => (
                <div key={p.id} onClick={() => setDetailId(p.id)} className="hover:bg-muted/40 transition-colors"
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i === shown.length - 1 ? "none" : "1px solid var(--border)", cursor: "pointer" }}>
                  <CompanyLogo company={p.company} url={p.url} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[p.company, p.location].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); updatePosting(p.id, { status: "saved" }); }}
                    style={{ height: 34, padding: "0 14px", borderRadius: 9, flexShrink: 0, border: "1px solid var(--primary)", background: "var(--primary)", color: "#FFF", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Plus className="w-3.5 h-3.5" /> Save
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deletePosting(p.id); }} title="Dismiss suggestion"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", padding: 4, flexShrink: 0 }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {suggested.length > 6 && (
                <button onClick={() => setShowAllSuggested((s) => !s)}
                  style={{ width: "100%", padding: "12px 20px", background: "var(--muted)", border: "none", borderTop: "1px solid var(--border)", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--primary)" }}>
                  {showAllSuggested ? "Show fewer" : `Show all ${suggested.length} suggestions`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Job-alerts prompt when no suggestions and no target roles set */}
        {suggested.length === 0 && !savedOnly && (profile.targetRoles?.length ?? 0) === 0 && (
          <div style={{ ...cardStyle, padding: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 12, background: "rgba(217,119,87,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </div>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Get new matches every Monday</div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>
                Set your target roles and followed companies, and we'll scan their job boards weekly and deliver fresh matches here.
              </div>
            </div>
            <button style={{ ...ghostBtn, flexShrink: 0 }} onClick={() => onNavigate?.("profile_settings")}>
              Set up job alerts <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <PostingList
          items={items}
          loading={loading}
          savedOnly={savedOnly}
          searched={searched}
          level={level}
          workplace={workplace}
          location={location}
          personalized={personalized}
          recommendedCount={recommendedCount}
          savingKey={savingKey}
          onOpen={openItem}
          onSave={(item) => saveItem(item)}
          onToggleFav={(posting) => updatePosting(posting.id, { favorite: !posting.favorite })}
          onStatus={(posting, s) => updatePosting(posting.id, { status: s, appliedAt: s === "applied" && !posting.appliedAt ? new Date().toISOString() : posting.appliedAt })}
          onToggleSavedOnly={() => setSavedOnly((s) => !s)}
        />
      </div>

      {!tailorPosting && (
        <PostingDetail
          detail={detail}
          preview={preview}
          importDraft={importDraft}
          profile={profile}
          personalized={personalized}
          savingKey={savingKey}
          previewKey={preview?.key ?? null}
          onCloseDetail={() => setDetailId(null)}
          onClosePreview={() => setPreview(null)}
          onCloseImport={() => setImportDraft(null)}
          onUpdatePosting={updatePosting}
          onDeletePosting={deletePosting}
          onNavigate={onNavigate}
          onSaveCoverLetter={(cl) => updateProfile({ savedCoverLetters: [...(profile.savedCoverLetters ?? []), cl] })}
          onTailor={() => detail && setTailorPosting(detail)}
          onSavePreview={() => { saveItem(preview!); setPreview(null); }}
          onSaveAndTailorPreview={() => saveItem(preview!, "tailor")}
          onSaveImportDraft={async (p) => { const saved = await addPosting(p); setImportDraft(null); setShowImport(false); if (saved) setDetailId(saved.id); }}
        />
      )}

      {tailorPosting && (
        <div className="fixed inset-0 z-[120] flex" style={{ background: "var(--background)" }}>
          <TailorResumeWorkspace
            onBack={() => setTailorPosting(null)}
            initialJobDetails={{
              jobTitle: tailorPosting.title,
              companyName: tailorPosting.company ?? "",
              jobDescription: tailorPosting.description ?? "",
            }}
            onVariantSaved={(variant) => updatePosting(tailorPosting.id, { appliedResumeId: variant.id })}
          />
        </div>
      )}
    </div>
  );
}
