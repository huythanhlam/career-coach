import React from "react";
import { ArrowLeft } from "lucide-react";
import { GoalPlanIntakeForm, type GoalPlanIntakeData } from "@/components/GoalPlanIntakeForm";

interface ResponsesViewProps {
  isGenerating: boolean;
  hasBaseline: boolean;
  currentIntake: GoalPlanIntakeData | null;
  onGenerate: (intake: GoalPlanIntakeData) => void;
  onBack: () => void;
}

export function ResponsesView({ isGenerating, hasBaseline, currentIntake, onGenerate, onBack }: ResponsesViewProps) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
      <header style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <button
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--border)", borderRadius: 10, height: 36, padding: "0 12px", cursor: "pointer", color: "var(--foreground)", fontFamily: "inherit", fontSize: 13, fontWeight: 500 }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to plan
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)" }}>Edit your responses</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Adjust your goals and context, then regenerate the plan.</div>
        </div>
      </header>
      <div className="flex-1 overflow-auto no-scrollbar p-8">
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <GoalPlanIntakeForm
            onSubmit={onGenerate}
            isGenerating={isGenerating}
            baselineReady={hasBaseline}
            initial={currentIntake ?? undefined}
            submitLabel="Regenerate plan"
            onCancel={onBack}
          />
        </div>
      </div>
    </div>
  );
}
