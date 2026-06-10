import React, { useState, useCallback } from "react";
import { X, ExternalLink, Sparkles, FileText, Plus, Loader2 } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { type JobPosting } from "@/types/jobPosting";
import type { NewPosting } from "@/hooks/useJobPostings";
import type { ImportedJobDraft } from "@/services/jobScanService";
import { JobDescription } from "@/components/JobDescription";
import type { ViewId } from "@/components/Sidebar";
import { inputStyle, primaryBtn, ghostBtn } from "./styles";
import type { ListItem } from "./index";
import { DetailDrawer } from "./DetailDrawer";
import { SectionHeading, CompanyLogo, FitBreakdown } from "./_shared";

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
  const handleUpdate = useCallback((patch: Partial<JobPosting>) => {
    onUpdatePosting(detail!.id, patch);
  }, [detail?.id, onUpdatePosting]);

  const handleDelete = useCallback(() => {
    onDeletePosting(detail!.id);
    onCloseDetail();
  }, [detail?.id, onDeletePosting, onCloseDetail]);

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
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onNavigate={onNavigate}
          onSaveCoverLetter={onSaveCoverLetter}
          onSaveResume={onSaveResume}
        />
      )}
    </>
  );
});
