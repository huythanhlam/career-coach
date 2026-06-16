import { Loader2 } from "lucide-react";
import { Bookmark, FileText, Plus, Trash2 } from "lucide-react";
import { ResumeGenerationForm } from "@/components/ResumeGenerationForm";
import { ResumeGeneratorWorkspace } from "@/components/ResumeGeneratorWorkspace";
import { ResumeAnalysisWorkspace } from "@/components/ResumeAnalysisWorkspace";
import { TailorResumeWorkspace } from "@/components/TailorResumeWorkspace";
import { ResumeAnalysisResult } from "@/services/geminiService";
import { PageHeader } from "./shared";

interface SavedResume {
  id: string;
  storagePath: string;
  name: string;
  createdAt: string;
}

interface ResumeWorkflowProps {
  config: { title: string; description: string };
  isGenerating: boolean;
  savedResumes: SavedResume[];
  loadingResumeId: string | null;
  resumeGeneratorData: Record<string, any> | null;
  savedResumeText: string | null;
  builderAnalysisText: string | null;
  builderAnalysisFile: { file: File; objectUrl: string } | null;
  builderAnalysisResult: ResumeAnalysisResult | null;
  isBuilderAnalyzing: boolean;
  showTailor: boolean;
  tailorInitialResume: { text: string; name: string } | null;
  onSetResumeGeneratorData: (data: Record<string, any> | null) => void;
  onSetSavedResumeText: (text: string | null) => void;
  onResetBuilderAnalysis: () => void;
  onSetShowTailor: (show: boolean) => void;
  onSetTailorInitialResume: (v: { text: string; name: string } | null) => void;
  onAnalyzeFromBuilder: (resumeText: string, file: File) => void;
  onOpenSaved: (r: { id: string; storagePath: string }) => void;
  onDeleteSaved: (id: string) => void;
  onImportToEditor: (markdown: string) => void;
}

export function ResumeWorkflow({
  config,
  isGenerating,
  savedResumes,
  loadingResumeId,
  resumeGeneratorData,
  savedResumeText,
  builderAnalysisText,
  builderAnalysisFile,
  builderAnalysisResult,
  isBuilderAnalyzing,
  showTailor,
  tailorInitialResume,
  onSetResumeGeneratorData,
  onSetSavedResumeText,
  onResetBuilderAnalysis,
  onSetShowTailor,
  onSetTailorInitialResume,
  onAnalyzeFromBuilder,
  onOpenSaved,
  onDeleteSaved,
  onImportToEditor,
}: ResumeWorkflowProps) {
  if (builderAnalysisText !== null && builderAnalysisFile) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <ResumeAnalysisWorkspace
          file={builderAnalysisFile.file}
          fileObjectUrl={builderAnalysisFile.objectUrl}
          resumeText={builderAnalysisText}
          analysisResult={builderAnalysisResult}
          isAnalyzing={isBuilderAnalyzing}
          onReset={onResetBuilderAnalysis}
        />
      </div>
    );
  }

  if (resumeGeneratorData) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <ResumeGeneratorWorkspace
          initialFormData={resumeGeneratorData}
          onReset={() => onSetResumeGeneratorData(null)}
        />
      </div>
    );
  }

  if (savedResumeText !== null) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <ResumeGeneratorWorkspace
          initialResumeText={savedResumeText}
          onReset={() => onSetSavedResumeText(null)}
        />
      </div>
    );
  }

  if (showTailor) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <TailorResumeWorkspace
          onBack={() => { onSetShowTailor(false); onSetTailorInitialResume(null); }}
          initialResumeText={tailorInitialResume?.text}
          initialResumeName={tailorInitialResume?.name}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
      <PageHeader title={config.title} description={config.description} />
      <div className="flex-1 overflow-auto no-scrollbar p-8">
        {savedResumes.length > 0 && (
          <div style={{ maxWidth: 760, margin: "0 auto 40px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <Bookmark className="w-3.5 h-3.5" /> Saved Resumes
            </div>
            <div className="flex flex-col gap-3">
              {savedResumes.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14 }}>
                  <FileText className="w-5 h-5 shrink-0" style={{ color: "var(--primary)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenSaved(r)}
                    disabled={loadingResumeId === r.id}
                    style={{ height: 36, padding: "0 16px", background: "var(--primary)", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", cursor: loadingResumeId === r.id ? "not-allowed" : "pointer", opacity: loadingResumeId === r.id ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {loadingResumeId === r.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening…</> : "Open"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSaved(r.id)}
                    style={{ height: 36, width: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", color: "var(--muted-foreground)" }}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ margin: "28px 0 4px", borderTop: "1px solid var(--border)" }} />
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", margin: "20px 0 14px", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus className="w-3.5 h-3.5" /> Build New Resume
            </div>
          </div>
        )}
        <ResumeGenerationForm
          isGenerating={isGenerating}
          onSubmit={data => onSetResumeGeneratorData(data)}
          onAnalyze={onAnalyzeFromBuilder}
          onTailor={(text, name) => { onSetTailorInitialResume({ text, name }); onSetShowTailor(true); }}
          onImportToEditor={onImportToEditor}
        />
      </div>
    </div>
  );
}
