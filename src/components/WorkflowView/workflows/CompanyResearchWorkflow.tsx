import { Loader2 } from "lucide-react";
import { CompanyResearchResult, type CompanyProfileData } from "@/services/geminiService";
import { CompanyResearchViz } from "@/components/companyResearch";
import { CompanyProfileViz } from "@/components/companyResearch/CompanyProfileViz";
import { RequestProfileBanner } from "@/components/companyResearch/RequestProfileBanner";
import { CompanyBrowser } from "@/components/companyResearch/CompanyBrowser";
import type { CompanyProfile } from "@/types/companyProfile";
import type { RequestProfileResult } from "@/services/companyProfileService";
import { PageHeader, MentorCard } from "./shared";

interface CompanyResearchWorkflowProps {
  config: { title: string; description: string };
  companyName: string;
  companyResult: CompanyResearchResult | null;
  isResearching: boolean;
  isRevalidating: boolean;
  companyCachedAt: string | null;
  companyProfile: CompanyProfile | null;
  careerInsights: CompanyProfileData | null;
  careerInsightsLoading: boolean;
  profileMissing: boolean;
  requestState: RequestProfileResult | "requesting" | null;
  onPick: (name: string) => void;
  onResetProfile: () => void;
  onSubmitProfileRequest: () => void;
  onRefreshNews: () => void;
  onRefreshAll: () => void;
  onResetResult: () => void;
}

export function CompanyResearchWorkflow({
  config,
  companyName,
  companyResult,
  isResearching,
  isRevalidating,
  companyCachedAt,
  companyProfile,
  careerInsights,
  careerInsightsLoading,
  profileMissing,
  requestState,
  onPick,
  onResetProfile,
  onSubmitProfileRequest,
  onRefreshNews,
  onRefreshAll,
  onResetResult,
}: CompanyResearchWorkflowProps) {
  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      <PageHeader title={config.title} description={config.description} />
      <div className="flex-1 overflow-auto no-scrollbar p-8">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {!companyResult && !companyProfile && !isResearching && (
            <CompanyBrowser onPick={onPick} />
          )}

          {isResearching && !companyResult && !companyProfile && (
            <MentorCard
              style={{
                padding: 48,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 16,
              }}
            >
              <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--primary)" }} />
              <div
                className="font-display"
                style={{ fontSize: 20, fontWeight: 600, color: "var(--foreground)" }}
              >
                Researching {companyName || "the company"}
              </div>
              <div style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
                Checking our verified company database, then careers pages, news, and financials…
              </div>
            </MentorCard>
          )}

          {companyProfile && (
            <CompanyProfileViz
              profile={companyProfile}
              careerInsights={careerInsights}
              careerInsightsLoading={careerInsightsLoading}
              onReset={onResetProfile}
            />
          )}

          {companyResult && !companyProfile && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {profileMissing && (
                <RequestProfileBanner
                  company={companyName}
                  state={requestState}
                  onRequest={onSubmitProfileRequest}
                />
              )}
              <CompanyResearchViz
                data={companyResult}
                companyName={companyName}
                isRevalidating={isRevalidating}
                cachedAt={companyCachedAt ?? undefined}
                onRefreshNews={onRefreshNews}
                onRefreshAll={onRefreshAll}
                onReset={onResetResult}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
