import React, { useState } from "react";
import { Loader2, Link, AlignLeft } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { ComboInput } from "@/components/ui/ComboInput";
import { JOB_TITLES, SP500_COMPANIES } from "@/lib/profileOptions";
import { supabase } from "@/lib/supabaseClient";

export interface JobDetailsValue {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}

interface JobDetailsSectionProps {
  value: JobDetailsValue;
  onChange: (value: JobDetailsValue) => void;
  /** Hide the title/company row when only the job description is needed. Defaults to false. */
  hideTitleCompany?: boolean;
}

const fieldStyle: React.CSSProperties = {
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 14,
  color: "var(--foreground)",
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--foreground)",
  marginBottom: 6,
  display: "block",
};

/**
 * Shared "Job Details" card used by both the cover-letter form and the
 * tailor-resume setup screen — both need the same job title, company, and
 * job description (with paste/URL import). Controlled via `value`/`onChange`;
 * the paste⇄URL toggle, fetch state, and suggestion lists are internal.
 */
export function JobDetailsSection({ value, onChange, hideTitleCompany = false }: JobDetailsSectionProps) {
  const { profile } = useUserProfile();

  const [jdInputMode, setJdInputMode] = useState<"paste" | "url">("paste");
  const [jdUrl, setJdUrl] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState("");

  // Suggestions from the user's own work history, then common options.
  const historyTitles = [...new Set((profile.workHistory ?? []).map((w) => w.role).filter(Boolean))];
  const historyCompanies = [...new Set((profile.workHistory ?? []).map((w) => w.company).filter(Boolean))];
  const titleOptions = [...historyTitles, ...JOB_TITLES.filter((t) => !historyTitles.includes(t))];
  const companyOptions = [...historyCompanies, ...SP500_COMPANIES.filter((c) => !historyCompanies.includes(c))];

  const set = (patch: Partial<JobDetailsValue>) => onChange({ ...value, ...patch });

  const handleFetchUrl = async () => {
    if (!jdUrl.trim()) return;
    setUrlError("");
    setIsFetchingUrl(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
      const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? supabaseAnonKey;
      const res = await fetch(`${supabaseUrl}/functions/v1/fetch-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": supabaseAnonKey, "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ url: jdUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "fetch_failed");
      if (!data.text || data.text.trim().length < 100) throw new Error("js_rendered");
      set({ jobDescription: data.text });
      setJdInputMode("paste");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "js_rendered") {
        setUrlError("This job board loads content dynamically and can't be imported automatically. Copy the job description text and paste it below.");
      } else if (msg.includes("Not Found") || msg.includes("404")) {
        setUrlError("That URL returned a 404 — double-check the link is for a specific job posting, not a search results page.");
      } else {
        setUrlError("Couldn't import from this URL. Many job boards (Lever, Ashby, Greenhouse) load their content with JavaScript which can't be fetched server-side. Copy the job description and paste it instead.");
      }
    } finally {
      setIsFetchingUrl(false);
    }
  };

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>
        Job Details
      </div>

      {!hideTitleCompany && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyle}>Job Title</label>
            <ComboInput
              value={value.jobTitle}
              onChange={(v) => set({ jobTitle: v })}
              options={titleOptions}
              placeholder="e.g. Senior Software Engineer"
              style={{ ...fieldStyle, height: 48, padding: "0 14px" }}
            />
          </div>
          <div>
            <label style={labelStyle}>Company Name</label>
            <ComboInput
              value={value.companyName}
              onChange={(v) => set({ companyName: v })}
              options={companyOptions}
              placeholder="e.g. Stripe"
              style={{ ...fieldStyle, height: 48, padding: "0 14px" }}
            />
          </div>
        </div>
      )}

      <div>
        {/* Label row with paste/URL toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>
            Job Description <span style={{ color: "var(--primary)" }}>*</span>
          </label>
          <div style={{ display: "flex", gap: 4, background: "var(--muted)", borderRadius: 8, padding: 3 }}>
            {(["paste", "url"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setJdInputMode(mode); setUrlError(""); }}
                style={{
                  height: 28, padding: "0 10px", border: "none", borderRadius: 6, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 500,
                  background: jdInputMode === mode ? "var(--card)" : "transparent",
                  color: jdInputMode === mode ? "var(--foreground)" : "var(--muted-foreground)",
                  boxShadow: jdInputMode === mode ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
                }}
              >
                {mode === "paste" ? <AlignLeft className="w-3 h-3" /> : <Link className="w-3 h-3" />}
                {mode === "paste" ? "Paste" : "URL"}
              </button>
            ))}
          </div>
        </div>

        {jdInputMode === "paste" ? (
          <textarea
            value={value.jobDescription}
            onChange={(e) => set({ jobDescription: e.target.value })}
            placeholder="Paste the full job description here. The more detail you provide, the better the match will be."
            rows={8}
            style={{ ...fieldStyle, padding: "14px", resize: "vertical", lineHeight: 1.6 }}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                value={jdUrl}
                onChange={(e) => { setJdUrl(e.target.value); setUrlError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleFetchUrl(); } }}
                placeholder="https://boards.greenhouse.io/…"
                style={{ ...fieldStyle, flex: 1, height: 48, padding: "0 14px" }}
              />
              <button
                type="button"
                onClick={handleFetchUrl}
                disabled={isFetchingUrl || !jdUrl.trim()}
                style={{
                  height: 48, padding: "0 18px", border: "none", borderRadius: 12,
                  background: "var(--primary)", color: "#fff", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 600, cursor: isFetchingUrl ? "not-allowed" : "pointer",
                  opacity: isFetchingUrl || !jdUrl.trim() ? 0.6 : 1,
                  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                }}
              >
                {isFetchingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
                {isFetchingUrl ? "Fetching…" : "Import"}
              </button>
            </div>
            {urlError && (
              <div style={{ fontSize: 12, color: "#ef4444", lineHeight: 1.5 }}>{urlError}</div>
            )}
            {value.jobDescription && (
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: "#22c55e" }}>✓</span> Job description imported — <button type="button" onClick={() => setJdInputMode("paste")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "var(--primary)", fontFamily: "inherit" }}>review it</button>
              </div>
            )}
            <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.5 }}>
              Paste a link to the job posting and we'll extract the description automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
