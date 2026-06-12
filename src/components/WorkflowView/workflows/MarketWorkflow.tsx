import { Loader2 } from "lucide-react";
import { MarketCompensationViz, MarketCompData } from "@/components/MarketCompensationViz";
import type { ViewId } from "@/components/Sidebar";
import type { WorkflowConfig } from "@/config/workflows";
import { PageHeader, MentorCard, FormCard } from "./shared";

interface MarketWorkflowProps {
  config: WorkflowConfig;
  formData: Record<string, any>;
  fileData: Record<string, any>;
  marketData: MarketCompData | null;
  marketCachedAt: string | null;
  isGeneratingMarketData: boolean;
  isGenerating: boolean;
  marketSaveState: "idle" | "saving" | "saved";
  marketCopied: boolean;
  onNavigate?: (view: ViewId) => void;
  onInputChange: (id: string, value: string) => void;
  onFileChange: (id: string, file: File | null) => void;
  onSubmit: (e: React.FormEvent) => void;
  onRefresh: () => void;
  onSave: () => void;
  onCopy: () => void;
  onReset: () => void;
}

export function MarketWorkflow({
  config,
  formData,
  fileData,
  marketData,
  marketCachedAt,
  isGeneratingMarketData,
  isGenerating,
  marketSaveState,
  marketCopied,
  onNavigate,
  onInputChange,
  onFileChange,
  onSubmit,
  onRefresh,
  onSave,
  onCopy,
  onReset,
}: MarketWorkflowProps) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
      <PageHeader title={config.title} description={config.description} />
      <div className="flex-1 overflow-auto no-scrollbar p-8">
        <div style={{ maxWidth: marketData ? 1180 : 760, margin: "0 auto" }}>
          {!isGeneratingMarketData && !marketData && (
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
              <FormCard
                config={config}
                formData={formData}
                fileData={fileData}
                isGenerating={isGenerating}
                handleInputChange={onInputChange}
                handleFileChange={onFileChange}
                handleInitialSubmit={onSubmit}
              />
            </div>
          )}

          {isGeneratingMarketData && !marketData && (
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
              <MentorCard style={{ padding: 48, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--primary)" }} />
                <div className="font-display" style={{ fontSize: 20, fontWeight: 600, color: "var(--foreground)" }}>Researching compensation</div>
                <div style={{ fontSize: 14, color: "var(--muted-foreground)" }}>Analysing market data — just a moment…</div>
              </MentorCard>
            </div>
          )}

          {marketData && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <MarketCompensationViz
                data={marketData}
                cachedAt={marketCachedAt ?? undefined}
                onRefresh={onRefresh}
                isRefreshing={isGeneratingMarketData}
                onNavigate={onNavigate}
              />
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={onSave}
                  disabled={marketSaveState !== "idle"}
                  style={{ flex: "1 1 160px", height: 48, background: marketSaveState === "saved" ? "var(--muted)" : "var(--card)", border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: marketSaveState === "idle" ? "pointer" : "default", color: "var(--foreground)" }}
                >
                  {marketSaveState === "saving" ? "Saving…" : marketSaveState === "saved" ? "Saved ✓" : "Save comparison"}
                </button>
                <button
                  onClick={onCopy}
                  style={{ flex: "1 1 160px", height: 48, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}
                >
                  {marketCopied ? "Copied ✓" : "Copy summary"}
                </button>
                <button
                  onClick={onReset}
                  style={{ flex: "1 1 160px", height: 48, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--foreground)" }}
                >
                  Start new analysis
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
