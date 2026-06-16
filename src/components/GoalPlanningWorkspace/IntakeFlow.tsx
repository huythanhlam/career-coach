import React from "react";
import { GoalPlanIntakeForm, type GoalPlanIntakeData } from "@/components/GoalPlanIntakeForm";

export interface IntakeFlowProps {
  isGenerating: boolean;
  baselineReady: boolean;
  onSubmit: (intake: GoalPlanIntakeData) => void;
}

export function IntakeFlow({ isGenerating, baselineReady, onSubmit }: IntakeFlowProps) {
  return (
    <GoalPlanIntakeForm
      onSubmit={onSubmit}
      isGenerating={isGenerating}
      baselineReady={baselineReady}
    />
  );
}
