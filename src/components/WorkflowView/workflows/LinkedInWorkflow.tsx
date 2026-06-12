import { LinkedInUploadForm, LinkedInUploadSubmit } from "@/components/LinkedInUploadForm";
import { LinkedInOptimizationWorkspace } from "@/components/LinkedInOptimizationWorkspace";
import { LinkedInAnalysisResult } from "@/services/geminiService";
import { ScreenshotResult } from "@/services/linkedinScreenshotService";
import { PageHeader } from "./shared";

interface LinkedInWorkflowProps {
  config: { title: string; description: string };
  linkedinSubmitted: boolean;
  linkedinUrl: string;
  linkedinResult: LinkedInAnalysisResult | null;
  isLinkedinAnalyzing: boolean;
  linkedinScreenshot: ScreenshotResult | null;
  isLinkedinCapturing: boolean;
  linkedinFile: { file: File; objectUrl: string } | null;
  profileLinkedin: string | undefined;
  profileTargetRole: string | undefined;
  onSubmit: (data: LinkedInUploadSubmit) => void;
  onReset: () => void;
}

export function LinkedInWorkflow({
  config,
  linkedinSubmitted,
  linkedinUrl,
  linkedinResult,
  isLinkedinAnalyzing,
  linkedinScreenshot,
  isLinkedinCapturing,
  linkedinFile,
  profileLinkedin,
  profileTargetRole,
  onSubmit,
  onReset,
}: LinkedInWorkflowProps) {
  if (!linkedinSubmitted) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
        <PageHeader title={config.title} description={config.description} />
        <div className="flex-1 overflow-auto no-scrollbar p-8">
          <LinkedInUploadForm
            initialUrl={profileLinkedin ?? ""}
            initialTargetRole={profileTargetRole ?? ""}
            isSubmitting={false}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <LinkedInOptimizationWorkspace
        result={linkedinResult}
        isAnalyzing={isLinkedinAnalyzing}
        screenshot={linkedinScreenshot}
        isCapturing={isLinkedinCapturing}
        profileUrl={linkedinUrl}
        file={linkedinFile?.file ?? null}
        fileObjectUrl={linkedinFile?.objectUrl ?? null}
        onReset={onReset}
      />
    </div>
  );
}
