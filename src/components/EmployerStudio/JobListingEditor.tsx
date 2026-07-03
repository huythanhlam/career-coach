import React, { useState } from "react";
import { ArrowLeft, Briefcase, Loader2, Save, Sparkles, Wand2 } from "lucide-react";
import type { EmployerJobListing, ListingStatus } from "@/types/employerListing";
import {
  LISTING_STATUSES,
  LISTING_STATUS_META,
  EMPLOYMENT_TYPES,
  validateListingDraft,
} from "@/types/employerListing";
import { JOB_LEVELS } from "@/lib/jobFilters";
import { JOB_TITLES } from "@/lib/profileOptions";
import { normalizeLocation } from "@/lib/locations";
import { generateJobDescription } from "@/services/employerService";
import { AITextField } from "./AIFieldButton";
import { SelectWithOther } from "./SelectWithOther";
import { LocationInput } from "@/components/ui/LocationInput";
import {
  cardStyle,
  inputStyle,
  labelStyle,
  errorTextStyle,
  fieldStyle,
  primaryBtn,
  ghostBtn,
  textareaStyle,
} from "./styles";

const JOB_TITLE_OPTIONS = JOB_TITLES.map((t) => ({ value: t, label: t }));
// Seniority options show their typical years-of-experience definition.
const SENIORITY_OPTIONS = JOB_LEVELS.map((l) => ({
  value: l.label,
  label: `${l.label} — ${l.years}`,
}));
const EMPLOYMENT_OPTIONS = EMPLOYMENT_TYPES.map((t) => ({ value: t.value, label: t.label }));

interface Props {
  listing: EmployerJobListing | null; // null = new
  companyId: string;
  companyName: string;
  onSave: (draft: Partial<EmployerJobListing>) => Promise<void>;
  onCancel: () => void;
}

type Draft = Partial<EmployerJobListing>;

const AI_DOWN = "Couldn't reach the AI — is the gateway running?";

export function JobListingEditor({ listing, companyId, companyName, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Draft>(
    listing ?? { companyId, title: "", status: "draft", salaryCurrency: "USD" },
  );
  const [keyPoints, setKeyPoints] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validateListingDraft>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const setNum = (key: "salaryMin" | "salaryMax", raw: string) =>
    set(key, raw.trim() === "" ? undefined : Number(raw));

  const fullContext = [draft.description, draft.requirements, draft.responsibilities]
    .filter(Boolean)
    .join("\n\n");

  const generateFromBrief = async () => {
    if (!draft.title?.trim()) {
      setGenError("Add a job title first.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const result = await generateJobDescription({
        title: draft.title.trim(),
        companyName,
        seniority: draft.seniority,
        location: draft.location,
        employmentType: draft.employmentType,
        keyPoints,
      });
      setDraft((d) => ({
        ...d,
        description: result.description || d.description,
        requirements: result.requirements || d.requirements,
        responsibilities: result.responsibilities || d.responsibilities,
      }));
    } catch (err) {
      console.error("generate from brief failed:", err);
      setGenError(AI_DOWN);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    const cleaned: Draft = {
      ...draft,
      location: draft.location?.trim() ? normalizeLocation(draft.location) : draft.location,
    };
    const v = validateListingDraft(cleaned);
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    setDraft(cleaned);
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(cleaned);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save the listing. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex-1 h-full overflow-y-auto no-scrollbar px-4 py-6 sm:px-10 sm:py-8 pb-20"
      style={{ background: "var(--background)" }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <button onClick={onCancel} style={{ ...ghostBtn, alignSelf: "flex-start", height: 36 }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(217,119,87,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Briefcase className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1
              className="font-display"
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--foreground)",
                margin: 0,
              }}
            >
              {listing ? "Edit job listing" : "New job listing"}
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
              {companyName}
            </p>
          </div>
        </div>

        {/* Basics */}
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Job title</label>
            <SelectWithOther
              value={draft.title ?? ""}
              onChange={(v) => set("title", v)}
              options={JOB_TITLE_OPTIONS}
              otherPlaceholder="Specify job title"
              style={errors.title ? { borderColor: "var(--destructive, #ef4444)" } : undefined}
            />
            {errors.title && <div style={errorTextStyle}>{errors.title}</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Location</label>
              <LocationInput
                value={draft.location ?? ""}
                onChange={(v) => set("location", v || undefined)}
                placeholder="e.g. Austin, TX"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Seniority</label>
              <select
                value={draft.seniority ?? ""}
                onChange={(e) => set("seniority", e.target.value || undefined)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">Select…</option>
                {SENIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                {draft.seniority && !SENIORITY_OPTIONS.some((o) => o.value === draft.seniority) && (
                  <option value={draft.seniority}>{draft.seniority}</option>
                )}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Employment type</label>
              <select
                value={draft.employmentType ?? ""}
                onChange={(e) => set("employmentType", e.target.value || undefined)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">Select…</option>
                {EMPLOYMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                {draft.employmentType &&
                  !EMPLOYMENT_OPTIONS.some((o) => o.value === draft.employmentType) && (
                    <option value={draft.employmentType}>{draft.employmentType}</option>
                  )}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Salary min</label>
              <input
                type="number"
                min={0}
                value={draft.salaryMin ?? ""}
                onChange={(e) => setNum("salaryMin", e.target.value)}
                placeholder="120000"
                style={fieldStyle(errors.salary)}
              />
            </div>
            <div>
              <label style={labelStyle}>Salary max</label>
              <input
                type="number"
                min={0}
                value={draft.salaryMax ?? ""}
                onChange={(e) => setNum("salaryMax", e.target.value)}
                placeholder="160000"
                style={fieldStyle(errors.salary)}
              />
            </div>
          </div>
          {errors.salary && <div style={errorTextStyle}>{errors.salary}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                color: "var(--foreground)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={draft.remote ?? false}
                onChange={(e) => set("remote", e.target.checked)}
              />
              Remote-friendly
            </label>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, color: "var(--foreground)", fontWeight: 600 }}>
                Status
              </span>
              <select
                value={draft.status ?? "draft"}
                onChange={(e) => set("status", e.target.value as ListingStatus)}
                style={{ ...inputStyle, height: 38, width: "auto", cursor: "pointer" }}
              >
                {LISTING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LISTING_STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Generate from brief */}
        <div
          style={{
            ...cardStyle,
            border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
            background: "color-mix(in srgb, var(--primary) 5%, transparent)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
              Generate from a brief
            </span>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--muted-foreground)",
              margin: "0 0 12px",
              lineHeight: 1.5,
            }}
          >
            Jot down the key responsibilities, must-have skills, and perks. The AI drafts the
            description, requirements, and responsibilities below for you to review.
          </p>
          <textarea
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
            rows={3}
            placeholder="e.g. Own our payments service; Go + Postgres; on-call rotation; 5+ yrs backend; equity + remote"
            style={textareaStyle}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
            <button
              onClick={generateFromBrief}
              disabled={generating}
              style={{
                ...primaryBtn,
                opacity: generating ? 0.7 : 1,
                cursor: generating ? "not-allowed" : "pointer",
              }}
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {generating ? "Drafting…" : "Generate description"}
            </button>
            {genError && (
              <span style={{ fontSize: 12, color: "var(--destructive, #ef4444)" }}>{genError}</span>
            )}
          </div>
        </div>

        {/* AI-assisted long-form fields */}
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 20 }}>
          <AITextField
            label="Description"
            value={draft.description ?? ""}
            onChange={(v) => set("description", v)}
            placeholder="Introduce the role, team, and impact…"
            rows={6}
            context={fullContext || (draft.description ?? "")}
          />
          <AITextField
            label="Responsibilities"
            value={draft.responsibilities ?? ""}
            onChange={(v) => set("responsibilities", v)}
            placeholder="What they'll own day to day…"
            rows={5}
            context={fullContext || (draft.responsibilities ?? "")}
          />
          <AITextField
            label="Requirements"
            value={draft.requirements ?? ""}
            onChange={(v) => set("requirements", v)}
            placeholder="Must-have and nice-to-have qualifications…"
            rows={5}
            context={fullContext || (draft.requirements ?? "")}
          />
        </div>

        {saveError && (
          <div style={{ fontSize: 13, color: "var(--destructive, #ef4444)" }}>{saveError}</div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...primaryBtn,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {listing ? "Save changes" : "Create listing"}
          </button>
          <button onClick={onCancel} style={ghostBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
