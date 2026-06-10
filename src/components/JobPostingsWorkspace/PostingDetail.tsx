import React, { useState, useMemo } from "react";
import { X, ExternalLink, Sparkles, FileText, Plus, Loader2 } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { scoreJobFit, fitLabel, RECOMMENDED_THRESHOLD, type ScorableJob } from "@/services/jobRecommendation";
import { type JobPosting } from "@/types/jobPosting";
import type { NewPosting } from "@/hooks/useJobPostings";
import type { ImportedJobDraft } from "@/services/jobScanService";
import { JobDescription } from "@/components/JobDescription";
import type { ViewId } from "@/components/Sidebar";
import { inputStyle, primaryBtn, ghostBtn } from "./styles";
import type { ListItem } from "./index";
import { DetailDrawer } from "./DetailDrawer";

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

/* ─────────────────────────────────────────────────────────────────────────
   Company logo (local copy for PostingDetail)
   ───────────────────────────────────────────────────────────────────────── */
import { companyLogoSources, companyMonogram } from "@/lib/companyLogo";

function CompanyLogo({ company, url, size = 40 }: { company?: string; url?: string; size?: number }) {
  const sources = useMemo(() => companyLogoSources(company, url), [company, url]);
  const [idx, setIdx] = useState(0);
  React.useEffect(() => { setIdx(0); }, [company, url]);
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
    <img src={src} alt={company ? `${company} logo` : "Company logo"} width={size} height={size} loading="lazy"
      onError={() => setIdx((i) => i + 1)}
      style={{ width: size, height: size, flexShrink: 0, borderRadius: radius, objectFit: "contain", background: "#fff", border: "1px solid var(--border)", padding: 4 }} />
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Fit breakdown
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
   Preview drawer
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

        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
          {personalized && <FitBreakdown posting={job} profile={profile} />}

          <section>
            <SectionHeading icon={FileText} title="Job description" sub="Read it here — no need to leave the app" />
            <div style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <JobDescription description={job.description} url={job.url} />
            </div>
          </section>
        </div>

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
   Import draft modal
   ───────────────────────────────────────────────────────────────────────── */
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
   PostingDetail — orchestrates detail/preview/import modals
   ───────────────────────────────────────────────────────────────────────── */
interface PostingDetailProps {
  detail: JobPosting | null;
  preview: ListItem | null;
  importDraft: ImportedJobDraft | null;
  profile: ReturnType<typeof useUserProfile>["profile"];
  personalized: boolean;
  savingKey: string | null;
  previewKey: string | null;
  onCloseDetail: () => void;
  onClosePreview: () => void;
  onCloseImport: () => void;
  onUpdatePosting: (id: string, patch: Partial<JobPosting>) => void;
  onDeletePosting: (id: string) => void;
  onNavigate?: (view: ViewId) => void;
  onSaveCoverLetter: (cl: NonNullable<ReturnType<typeof useUserProfile>["profile"]["savedCoverLetters"]>[number]) => void;
  onSaveResume: (r: NonNullable<ReturnType<typeof useUserProfile>["profile"]["savedResumes"]>[number]) => void;
  onSavePreview: () => void;
  onSaveAndTailorPreview: () => void;
  onSaveImportDraft: (p: NewPosting) => void;
}

export const PostingDetail = React.memo(function PostingDetail({
  detail, preview, importDraft, profile, personalized, savingKey, previewKey,
  onCloseDetail, onClosePreview, onCloseImport,
  onUpdatePosting, onDeletePosting, onNavigate,
  onSaveCoverLetter, onSaveResume,
  onSavePreview, onSaveAndTailorPreview, onSaveImportDraft,
}: PostingDetailProps) {
  return (
    <>
      {importDraft && (
        <ImportDraftModal draft={importDraft} onClose={onCloseImport} onSave={onSaveImportDraft} />
      )}

      {preview && (
        <PreviewDrawer
          item={preview}
          profile={profile}
          personalized={personalized}
          saving={savingKey === previewKey}
          onClose={onClosePreview}
          onSave={onSavePreview}
          onSaveAndTailor={onSaveAndTailorPreview}
        />
      )}

      {detail && (
        <DetailDrawer
          posting={detail}
          profile={profile}
          onClose={onCloseDetail}
          onUpdate={(patch) => onUpdatePosting(detail.id, patch)}
          onDelete={() => { onDeletePosting(detail.id); onCloseDetail(); }}
          onNavigate={onNavigate}
          onSaveCoverLetter={onSaveCoverLetter}
          onSaveResume={onSaveResume}
        />
      )}
    </>
  );
});
