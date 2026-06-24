import React, { useState } from "react";
import { ArrowLeft, Building2, Loader2, Save } from "lucide-react";
import type { EmployerCompanyProfile, CompanyCopyField } from "@/types/employerProfile";
import { COMPANY_SIZES } from "@/types/employerProfile";
import { INDUSTRIES } from "@/lib/jobFilters";
import { normalizeLocation } from "@/lib/locations";
import { generateCompanyCopy } from "@/services/employerService";
import { AITextField } from "./AIFieldButton";
import { SelectWithOther } from "./SelectWithOther";
import { LocationInput } from "@/components/ui/LocationInput";
import { validateCompanyDraft, type CompanyDraftErrors } from "./validation";
import { cardStyle, inputStyle, labelStyle, errorTextStyle, fieldStyle, primaryBtn, ghostBtn } from "./styles";

// Canonical industries as dropdown options; the built-in "Other…" choice replaces
// the list's own "Other" so a custom industry can be typed in.
const INDUSTRY_OPTIONS = INDUSTRIES.filter((i) => i.value !== "other").map((i) => ({ value: i.label, label: i.label }));

interface Props {
  company: EmployerCompanyProfile | null; // null = creating a new company
  onSave: (draft: Partial<EmployerCompanyProfile>) => Promise<void>;
  onCancel: () => void;
}

type Draft = Partial<EmployerCompanyProfile>;

export function CompanyProfileEditor({ company, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Draft>(company ?? { name: "" });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<CompanyDraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const copyInput = (field: CompanyCopyField) => ({
    name: draft.name?.trim() || "this company",
    industry: draft.industry,
    existing: (draft[field] as string) ?? "",
  });

  const handleSave = async () => {
    const cleaned: Draft = { ...draft, headquarters: draft.headquarters?.trim() ? normalizeLocation(draft.headquarters) : draft.headquarters };
    const v = validateCompanyDraft(cleaned);
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    setDraft(cleaned);
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(cleaned);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Couldn't save the company. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto no-scrollbar px-4 py-6 sm:px-10 sm:py-8 pb-20" style={{ background: "var(--background)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <button onClick={onCancel} style={{ ...ghostBtn, alignSelf: "flex-start", height: 36 }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(217,119,87,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Building2 className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 className="font-display" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--foreground)", margin: 0 }}>
              {company ? "Edit company profile" : "New company profile"}
            </h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
              Tell candidates who you are. Use the AI buttons to draft or polish each section.
            </p>
          </div>
        </div>

        {/* Basics */}
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Company name</label>
            <input value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Acme Robotics" style={fieldStyle(errors.name)} />
            {errors.name && <div style={errorTextStyle}>{errors.name}</div>}
          </div>
          <div>
            <label style={labelStyle}>Tagline</label>
            <input value={draft.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} placeholder="One line on what you do" style={fieldStyle(errors.tagline)} />
            {errors.tagline && <div style={errorTextStyle}>{errors.tagline}</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Industry</label>
              <SelectWithOther value={draft.industry ?? ""} onChange={(v) => set("industry", v)} options={INDUSTRY_OPTIONS} otherPlaceholder="Specify your industry" />
            </div>
            <div>
              <label style={labelStyle}>Company size</label>
              <select value={draft.size ?? ""} onChange={(e) => set("size", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="">Select…</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Headquarters</label>
              <LocationInput value={draft.headquarters ?? ""} onChange={(v) => set("headquarters", v)} placeholder="e.g. Austin, TX" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Website</label>
              <input value={draft.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://…" style={fieldStyle(errors.website)} />
              {errors.website && <div style={errorTextStyle}>{errors.website}</div>}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Logo URL</label>
            <input value={draft.logoUrl ?? ""} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…/logo.png" style={fieldStyle(errors.logoUrl)} />
            {errors.logoUrl && <div style={errorTextStyle}>{errors.logoUrl}</div>}
          </div>
        </div>

        {/* AI-assisted long-form copy */}
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 20 }}>
          <AITextField
            label="About the company"
            value={draft.about ?? ""}
            onChange={(v) => set("about", v)}
            placeholder="What you do and why it matters…"
            context={draft.about ?? ""}
            onGenerate={() => generateCompanyCopy("about", copyInput("about"))}
            generateLabel="Draft with AI"
          />
          <AITextField
            label="Mission"
            value={draft.mission ?? ""}
            onChange={(v) => set("mission", v)}
            rows={2}
            placeholder="Your mission in a sentence or two…"
            context={draft.mission ?? ""}
            onGenerate={() => generateCompanyCopy("mission", copyInput("mission"))}
            generateLabel="Draft with AI"
          />
          <AITextField
            label="Life & culture"
            value={draft.culture ?? ""}
            onChange={(v) => set("culture", v)}
            placeholder="How your team works…"
            context={draft.culture ?? ""}
            onGenerate={() => generateCompanyCopy("culture", copyInput("culture"))}
            generateLabel="Draft with AI"
          />
          <AITextField
            label="Benefits & perks"
            value={draft.benefits ?? ""}
            onChange={(v) => set("benefits", v)}
            placeholder="Comp, health, time off, growth, flexibility…"
            context={draft.benefits ?? ""}
            onGenerate={() => generateCompanyCopy("benefits", copyInput("benefits"))}
            generateLabel="Draft with AI"
          />
        </div>

        {saveError && <div style={{ fontSize: 13, color: "var(--destructive, #ef4444)" }}>{saveError}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {company ? "Save changes" : "Create company"}
          </button>
          <button onClick={onCancel} style={ghostBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
