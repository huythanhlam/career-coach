import { Bookmark, FileText, Plus, Trash2 } from "lucide-react";
import { CoverLetterWorkspace, SavedCoverLetterPayload } from "@/components/CoverLetterWorkspace";
import { CoverLetterForm, CoverLetterFormData } from "@/components/CoverLetterForm";
import { PageHeader } from "./shared";

interface SavedCoverLetter {
  id: string;
  storagePath: string;
  name: string;
  jobTitle?: string;
  company?: string;
  createdAt: string;
}

interface CoverLetterWorkflowProps {
  config: { title: string; description: string };
  coverLetterFormData: CoverLetterFormData | null;
  savedCoverLetterPayload: SavedCoverLetterPayload | null;
  savedLetters: SavedCoverLetter[];
  onSetCoverLetterFormData: (data: CoverLetterFormData | null) => void;
  onSetSavedCoverLetterPayload: (payload: SavedCoverLetterPayload | null) => void;
  onDeleteSavedLetter: (id: string, storagePath: string) => void;
  onOpenLetter: (storagePath: string) => void;
}

export function CoverLetterWorkflow({
  config,
  coverLetterFormData,
  savedCoverLetterPayload,
  savedLetters,
  onSetCoverLetterFormData,
  onSetSavedCoverLetterPayload,
  onDeleteSavedLetter,
  onOpenLetter,
}: CoverLetterWorkflowProps) {
  if (coverLetterFormData) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <CoverLetterWorkspace
          initialFormData={coverLetterFormData}
          onReset={() => onSetCoverLetterFormData(null)}
        />
      </div>
    );
  }

  if (savedCoverLetterPayload !== null) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <CoverLetterWorkspace
          initialPayload={savedCoverLetterPayload}
          onReset={() => onSetSavedCoverLetterPayload(null)}
        />
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      <PageHeader title={config.title} description={config.description} />
      <div className="flex-1 overflow-auto no-scrollbar p-8">
        {savedLetters.length > 0 && (
          <div style={{ maxWidth: 760, margin: "0 auto 40px" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--muted-foreground)",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Bookmark className="w-3.5 h-3.5" /> Saved Cover Letters
            </div>
            <div className="flex flex-col gap-3">
              {savedLetters
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((l) => (
                  <div
                    key={l.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 18px",
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                    }}
                  >
                    <FileText className="w-5 h-5 shrink-0" style={{ color: "var(--primary)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: "var(--foreground)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {l.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                        {l.jobTitle && l.company ? `${l.jobTitle} at ${l.company} · ` : ""}
                        {new Date(l.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenLetter(l.storagePath)}
                      style={{
                        height: 36,
                        padding: "0 16px",
                        background: "var(--primary)",
                        border: "none",
                        borderRadius: 8,
                        fontFamily: "inherit",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSavedLetter(l.id, l.storagePath)}
                      style={{
                        height: 36,
                        width: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        cursor: "pointer",
                        color: "var(--muted-foreground)",
                      }}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
            </div>
            <div style={{ margin: "28px 0 4px", borderTop: "1px solid var(--border)" }} />
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--muted-foreground)",
                margin: "20px 0 14px",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Write New Cover Letter
            </div>
          </div>
        )}
        <CoverLetterForm isGenerating={false} onSubmit={(data) => onSetCoverLetterFormData(data)} />
      </div>
    </div>
  );
}
