import React, { useState } from "react";
import { Search, MapPin, X, Link2, Loader2 } from "lucide-react";
import {
  suggestLocations, JOB_LEVELS, WORKPLACE_TYPES, JOB_FAMILIES, INDUSTRIES,
  type JobLevel, type Workplace, type JobFamily, type Industry,
} from "@/lib/jobFilters";
import { cardStyle, inputStyle, primaryBtn, ghostBtn, filterSelectStyle } from "./styles";

/* ── URL import inline widget ─────────────────────────────────────────────── */
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

interface ScanControlsProps {
  keyword: string;
  location: string;
  level: JobLevel | "any";
  workplace: Workplace | "any";
  family: JobFamily | "any";
  industry: Industry | "any";
  loading: boolean;
  showImport: boolean;
  error: string;
  onKeyword: (v: string) => void;
  onLocation: (v: string) => void;
  onLevel: (v: JobLevel | "any") => void;
  onWorkplace: (v: Workplace | "any") => void;
  onFamily: (v: JobFamily | "any") => void;
  onIndustry: (v: Industry | "any") => void;
  onSearch: () => void;
  onShowImport: (show: boolean) => void;
  onUrlImport: (url: string) => Promise<void>;
}

export const ScanControls = React.memo(function ScanControls({
  keyword, location, level, workplace, family, industry, loading, showImport, error,
  onKeyword, onLocation, onLevel, onWorkplace, onFamily, onIndustry, onSearch, onShowImport, onUrlImport,
}: ScanControlsProps) {
  return (
    <div style={{ ...cardStyle, padding: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "3 1 260px" }}>
          <Search className="w-4 h-4" style={{ position: "absolute", left: 14, top: 14, color: "var(--muted-foreground)" }} />
          <input style={{ ...inputStyle, paddingLeft: 38 }} placeholder="Job title or keywords (e.g. Product Manager)"
            value={keyword} onChange={(e) => onKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()} />
        </div>
        <div style={{ position: "relative", flex: "2 1 180px" }}>
          <MapPin className="w-4 h-4" style={{ position: "absolute", left: 14, top: 14, color: "var(--muted-foreground)" }} />
          <input style={{ ...inputStyle, paddingLeft: 38 }} placeholder="City, state, or country" list="loc-suggestions"
            value={location} onChange={(e) => onLocation(e.target.value)} />
          {location && (
            <button onClick={() => onLocation("")} title="Clear location"
              style={{ position: "absolute", right: 10, top: 12, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", padding: 0 }}>
              <X className="w-4 h-4" />
            </button>
          )}
          <datalist id="loc-suggestions">
            {suggestLocations(location).map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <button style={{ ...primaryBtn, flexShrink: 0 }} onClick={onSearch} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Search
        </button>
      </div>

      {/* Facet filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <select style={filterSelectStyle} value={level} onChange={(e) => onLevel(e.target.value as JobLevel | "any")}
          title="Experience level — by typical years of experience">
          <option value="any">Any level</option>
          {JOB_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label} · {l.years}</option>)}
        </select>
        <select style={filterSelectStyle} value={workplace} onChange={(e) => onWorkplace(e.target.value as Workplace | "any")}>
          <option value="any">Remote, hybrid or on-site</option>
          {WORKPLACE_TYPES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
        <select style={filterSelectStyle} value={family} onChange={(e) => onFamily(e.target.value as JobFamily | "any")}
          title="Job family — the role's functional area">
          <option value="any">Any job family</option>
          {JOB_FAMILIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select style={filterSelectStyle} value={industry} onChange={(e) => onIndustry(e.target.value as Industry | "any")}
          title="Industry — the employer's sector">
          <option value="any">Any industry</option>
          {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
        </select>
        {(level !== "any" || workplace !== "any" || family !== "any" || industry !== "any" || location.trim()) && (
          <button onClick={() => { onLevel("any"); onWorkplace("any"); onFamily("any"); onIndustry("any"); onLocation(""); }}
            style={{ ...filterSelectStyle, width: "auto", cursor: "pointer", color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
      </div>
      {error && <div style={{ fontSize: 13, color: "var(--primary)", marginTop: 10 }}>{error}</div>}
      <div style={{ marginTop: 10 }}>
        <button onClick={() => onShowImport(!showImport)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: 12, color: "var(--muted-foreground)" }}>
          <Link2 className="w-3.5 h-3.5" /> Have a specific posting? Add it by URL
        </button>
        {showImport && <UrlImport onImport={onUrlImport} />}
      </div>
    </div>
  );
});
