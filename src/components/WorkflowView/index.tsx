import { pdfjs } from "react-pdf";
import { configurePdfWorker } from "@/lib/pdfWorker";
import { WorkflowId, type ViewId } from "@/components/Sidebar";
import { GoalPlanningWorkspace } from "@/components/GoalPlanningWorkspace";
import { MockInterviewWorkspace } from "@/components/MockInterviewWorkspace";
import { LinkedInWorkflow } from "./workflows/LinkedInWorkflow";
import { ResumeWorkflow } from "./workflows/ResumeWorkflow";
import { CoverLetterWorkflow } from "./workflows/CoverLetterWorkflow";
import { MarketWorkflow } from "./workflows/MarketWorkflow";
import { CompanyResearchWorkflow } from "./workflows/CompanyResearchWorkflow";
import { GenericWorkflow } from "./workflows/GenericWorkflow";
import { useWorkflowHandlers } from "./useWorkflowHandlers";

configurePdfWorker(pdfjs);

interface WorkflowViewProps { workflowId: WorkflowId; onNavigate?: (view: ViewId) => void; }

export function WorkflowView({ workflowId, onNavigate }: WorkflowViewProps) {
  const h = useWorkflowHandlers(workflowId);

  if (workflowId === "goal_planning") {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <GoalPlanningWorkspace onNavigate={onNavigate} />
      </div>
    );
  }

  if (workflowId === "mock_behavioral") {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <MockInterviewWorkspace workflowId={workflowId} />
      </div>
    );
  }

  if (workflowId === "linkedin") {
    return (
      <LinkedInWorkflow
        config={h.config}
        linkedinSubmitted={h.linkedinSubmitted}
        linkedinUrl={h.linkedinUrl}
        linkedinResult={h.linkedinResult}
        isLinkedinAnalyzing={h.isLinkedinAnalyzing}
        linkedinScreenshot={h.linkedinScreenshot}
        isLinkedinCapturing={h.isLinkedinCapturing}
        linkedinFile={h.linkedinFile}
        profileLinkedin={h.profile.linkedin}
        profileTargetRole={h.profile.targetRole}
        onSubmit={h.handleLinkedinSubmit}
        onReset={h.resetLinkedin}
      />
    );
  }

  if (workflowId === "resume_generation") {
    return (
      <ResumeWorkflow
        config={h.config}
        isGenerating={h.isGenerating}
        savedResumes={h.profile.savedResumes ?? []}
        loadingResumeId={h.loadingResumeId}
        resumeGeneratorData={h.resumeGeneratorData}
        savedResumeText={h.savedResumeText}
        builderAnalysisText={h.builderAnalysisText}
        builderAnalysisFile={h.builderAnalysisFile}
        builderAnalysisResult={h.builderAnalysisResult}
        isBuilderAnalyzing={h.isBuilderAnalyzing}
        showTailor={h.showTailor}
        tailorInitialResume={h.tailorInitialResume}
        onSetResumeGeneratorData={h.setResumeGeneratorData}
        onSetSavedResumeText={h.setSavedResumeText}
        onResetBuilderAnalysis={h.resetBuilderAnalysis}
        onSetShowTailor={h.setShowTailor}
        onSetTailorInitialResume={h.setTailorInitialResume}
        onAnalyzeFromBuilder={h.handleAnalyzeFromBuilder}
        onOpenSaved={h.handleOpenSavedResume}
        onDeleteSaved={h.handleDeleteSavedResume}
        onImportToEditor={markdown => h.setSavedResumeText(markdown)}
      />
    );
  }

  if (workflowId === "cover_letter") {
    return (
      <CoverLetterWorkflow
        config={h.config}
        coverLetterFormData={h.coverLetterFormData}
        savedCoverLetterPayload={h.savedCoverLetterPayload}
        savedLetters={h.profile.savedCoverLetters ?? []}
        onSetCoverLetterFormData={h.setCoverLetterFormData}
        onSetSavedCoverLetterPayload={h.setSavedCoverLetterPayload}
        onDeleteSavedLetter={h.handleDeleteSavedLetter}
        onOpenLetter={h.handleOpenLetter}
      />
    );
  }

  if (workflowId === "market") {
    return (
      <MarketWorkflow
        config={h.config}
        formData={h.formData}
        fileData={h.fileData}
        marketData={h.marketData}
        marketCachedAt={h.marketCachedAt}
        isGeneratingMarketData={h.isGeneratingMarketData}
        isGenerating={h.isGenerating}
        marketSaveState={h.marketSaveState}
        marketCopied={h.marketCopied}
        onNavigate={onNavigate}
        onInputChange={h.handleInputChange}
        onFileChange={h.handleFileChange}
        onSubmit={h.handleInitialSubmit}
        onRefresh={() => h.runMarketAnalysis(true)}
        onSave={h.handleSaveMarket}
        onCopy={h.handleCopyMarket}
        onReset={h.resetMarket}
      />
    );
  }

  if (workflowId === "company_research") {
    return (
      <CompanyResearchWorkflow
        config={h.config}
        companyName={h.companyJobDetails.companyName}
        companyResult={h.companyResult}
        isResearching={h.isResearching}
        isRevalidating={h.isRevalidating}
        companyCachedAt={h.companyCachedAt}
        companyProfile={h.companyProfile}
        careerInsights={h.careerInsights}
        careerInsightsLoading={h.careerInsightsLoading}
        profileMissing={h.profileMissing}
        requestState={h.requestState}
        onPick={h.startCompanyResearch}
        onResetProfile={() => { h.setCompanyProfile(null); h.setProfileMissing(false); h.setRequestState(null); }}
        onSubmitProfileRequest={h.submitProfileRequest}
        onRefreshNews={() => h.runCompanyResearch("news")}
        onRefreshAll={() => h.runCompanyResearch("all")}
        onResetResult={h.resetCompanyResult}
      />
    );
  }

  return (
    <GenericWorkflow
      config={h.config}
      formData={h.formData}
      fileData={h.fileData}
      isGenerating={h.isGenerating}
      mainDocumentText={h.mainDocumentText}
      onInputChange={h.handleInputChange}
      onFileChange={h.handleFileChange}
      onSubmit={h.handleInitialSubmit}
      onReset={() => { h.setMainDocumentText(""); h.setFormData({}); h.setFileData({}); }}
    />
  );
}
