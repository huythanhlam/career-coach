import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ListChecks, CheckCircle2, Circle, MessageCircleHeart, Loader2, Sparkles } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { useAuth } from "@/context/AuthContext";
import {
  isProfileThin, buildProfileBaseline, buildSurveySummary,
  getProfileIdentity, hasBaselineIdentity, hasProfileBaseline,
  type IdentitySyncField,
} from "@/lib/careerBaseline";
import type { GoalPlanIntakeData } from "@/components/GoalPlanIntakeForm";
import type { CareerSurvey, PlanMilestone } from "@/types/userProfile";
import type { ViewId } from "@/components/Sidebar";
import { workflowsConfig } from "@/config/workflows";
import { ProfileSyncDialog } from "./ProfileSyncDialog";
import { SaveDialog } from "./SaveDialog";
import { PlanView } from "./PlanView";
import { ResponsesView } from "./ResponsesView";
import { BaselineSection } from "./BaselineSection";
import { SavedPlansSection } from "./SavedPlansSection";
import { IntakeFlow } from "./IntakeFlow";
import { useGoalPlanningActions } from "./useGoalPlanningActions";
import type { SavedCareerPlan } from "@/types/userProfile";

type ChatMsg = { role: "user" | "model"; text: string };

interface GoalPlanningWorkspaceProps {
  onNavigate?: (view: ViewId) => void;
}

export function GoalPlanningWorkspace({ onNavigate }: GoalPlanningWorkspaceProps) {
  const { profile, updateProfile } = useUserProfile();
  const { user } = useAuth();

  const thin = useMemo(() => isProfileThin(profile), [profile]);
  const hasBaseline = hasBaselineIdentity(profile, profile.careerSurvey);
  const profileHasBaseline = hasProfileBaseline(profile);

  const initialSurvey = useMemo<CareerSurvey>(() => {
    const s = profile.careerSurvey ?? {};
    if (hasProfileBaseline(profile)) return s;
    const id = getProfileIdentity(profile);
    return {
      ...s,
      currentRole: s.currentRole ?? (id.currentRole || undefined),
      company: s.company ?? (id.company || undefined),
      yearsExperience: s.yearsExperience ?? (id.yearsExperience || undefined),
    };
  }, [profile]);

  const [baselineSurveyOpen, setBaselineSurveyOpen] = useState(false);
  const [savingSurvey, setSavingSurvey] = useState(false);

  const [syncConflicts, setSyncConflicts] = useState<IdentitySyncField[]>([]);
  const [pendingSurvey, setPendingSurvey] = useState<CareerSurvey | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [mode, setMode] = useState<"list" | "plan" | "responses">("list");
  const [planMarkdown, setPlanMarkdown] = useState("");
  const [goalType, setGoalType] = useState("");
  const [goalSummary, setGoalSummary] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [input, setInput] = useState("");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<PlanMilestone[]>([]);
  const [extractingMilestones, setExtractingMilestones] = useState(false);

  const [currentIntake, setCurrentIntake] = useState<GoalPlanIntakeData | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingSheet, setEditingSheet] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState("");

  const [planSearch, setPlanSearch] = useState("");
  const [planSort, setPlanSort] = useState<"newest" | "oldest" | "az">("newest");
  const [groupByType, setGroupByType] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveAsCopy, setSaveAsCopy] = useState(false);

  const savedPlans = profile.savedCareerPlans ?? [];

  const filteredPlans = useMemo(() => {
    const q = planSearch.trim().toLowerCase();
    const list = savedPlans.filter((p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.goalType.toLowerCase().includes(q) ||
      (p.goalSummary ?? "").toLowerCase().includes(q)
    );
    const byNewest = (a: SavedCareerPlan, b: SavedCareerPlan) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return [...list].sort((a, b) =>
      planSort === "newest" ? byNewest(a, b)
        : planSort === "oldest" ? -byNewest(a, b)
        : a.name.localeCompare(b.name)
    );
  }, [savedPlans, planSearch, planSort]);

  const groupedPlans = useMemo(() => {
    const groups = new Map<string, SavedCareerPlan[]>();
    filteredPlans.forEach((p) => {
      const key = p.goalType || "Other";
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(p);
    });
    return [...groups.entries()];
  }, [filteredPlans]);

  const toggleGroup = useCallback((key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    }), []);

  const handleGoToList = useCallback(() => setMode("list"), []);
  const handleGoToPlan = useCallback(() => setMode("plan"), []);
  const handleGoToResponses = useCallback(() => setMode("responses"), []);
  const handleOpenSurvey = useCallback(() => setBaselineSurveyOpen(true), []);
  const handleCloseSurvey = useCallback(() => setBaselineSurveyOpen(false), []);
  const handleSaveDialogCancel = useCallback(() => { setShowSaveDialog(false); setSaveAsCopy(false); }, []);
  const handleSwitcherToggle = useCallback(() => setSwitcherOpen((o) => !o), []);
  const handleSwitcherClose = useCallback(() => setSwitcherOpen(false), []);
  const handleGroupByType = useCallback(() => setGroupByType((g) => !g), []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const actions = useGoalPlanningActions({
    profile,
    user,
    updateProfile,
    profileHasBaseline,
    savedPlans,
    planMarkdown,
    goalType,
    goalSummary,
    messages,
    input,
    currentIntake,
    editingPlanId,
    saveAsCopy,
    saveName,
    chatRef,
    setPlanMarkdown,
    setGoalType,
    setGoalSummary,
    setMessages,
    setIsGenerating,
    setInput,
    setCurrentIntake,
    setEditingPlanId,
    setEditingSheet,
    setDraftMarkdown,
    setMode,
    setLoadingPlanId,
    setSavingSurvey,
    setSyncConflicts,
    setPendingSurvey,
    setSyncing,
    setBaselineSurveyOpen,
    setShowSaveDialog,
    setSaveName,
    setIsSaving,
    setSaveAsCopy,
    milestones,
    setMilestones,
    extractingMilestones,
    setExtractingMilestones,
    isGenerating,
    pendingSurvey,
    draftMarkdown,
  });

  const handleIntakeSubmit = useCallback((intake: GoalPlanIntakeData) => { setEditingPlanId(null); actions.handleGenerate(intake); }, [actions.handleGenerate]);
  const handleSaveDialog = useCallback(() => actions.openSaveDialog(false), [actions.openSaveDialog]);
  const handleSaveAsCopy = useCallback(() => actions.openSaveDialog(true), [actions.openSaveDialog]);

  /* ════════════════════════════ EDIT RESPONSES ═════════════════════ */
  if (mode === "responses") {
    return (
      <ResponsesView
        isGenerating={isGenerating}
        hasBaseline={hasBaseline}
        currentIntake={currentIntake}
        onGenerate={actions.handleGenerate}
        onBack={handleGoToPlan}
      />
    );
  }

  /* ═══════════════════════════════ PLAN VIEW ═══════════════════════ */
  if (mode === "plan") {
    return (
      <>
        <PlanView
          planMarkdown={planMarkdown}
          messages={messages}
          input={input}
          onInputChange={setInput}
          onSend={actions.handleSend}
          isGenerating={isGenerating}
          editingSheet={editingSheet}
          draftMarkdown={draftMarkdown}
          onDraftChange={setDraftMarkdown}
          onStartEdit={actions.startEditSheet}
          onApplyEdit={actions.applyEditSheet}
          onCancelEdit={actions.cancelEditSheet}
          onBack={handleGoToList}
          onSave={handleSaveDialog}
          onSaveAsCopy={handleSaveAsCopy}
          currentIntake={currentIntake}
          onViewResponses={handleGoToResponses}
          goalSummary={goalSummary}
          goalType={goalType}
          editingPlanId={editingPlanId}
          savedPlans={savedPlans}
          scrollRef={scrollRef}
          switcherOpen={switcherOpen}
          onSwitcherToggle={handleSwitcherToggle}
          onSwitcherClose={handleSwitcherClose}
          onOpenPlan={actions.handleOpen}
          milestones={milestones}
          extractingMilestones={extractingMilestones}
          onToggleMilestone={actions.toggleMilestone}
          onExtractMilestones={actions.handleExtractMilestones}
          onCheckIn={actions.handleCheckIn}
        />
        {showSaveDialog && (
          <SaveDialog
            saveName={saveName}
            setSaveName={setSaveName}
            isSaving={isSaving}
            title={saveAsCopy ? "Save as copy" : editingPlanId ? "Save changes" : "Save plan"}
            subtitle={saveAsCopy ? "This creates a new plan from your edits, leaving the original untouched." : undefined}
            onCancel={handleSaveDialogCancel}
            onSave={actions.handleSave}
          />
        )}
      </>
    );
  }

  /* ═══════════════════════════════ LIST VIEW ═══════════════════════ */
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
      <header style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", background: "var(--background)", flexShrink: 0 }}>
        <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--foreground)", margin: "0 0 4px" }}>
          {workflowsConfig.goal_planning.title}
        </h2>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
          {workflowsConfig.goal_planning.description}
        </p>
      </header>

      <div className="flex-1 overflow-auto no-scrollbar p-8">
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

          {thin && hasBaseline && (
            <div style={{ display: "flex", gap: 12, padding: "16px 18px", borderRadius: 16, background: "color-mix(in srgb, var(--marigold) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--marigold) 40%, transparent)" }}>
              <AlertCircle className="w-5 h-5 shrink-0" style={{ color: "var(--marigold)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>
                  Your profile is the baseline for your plan
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                  Add your current role, skills, and work history so the coach can tailor a plan to your real background. You can still generate a plan now.
                </div>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("profile_settings")}
                  style={{ alignSelf: "center", whiteSpace: "nowrap", height: 34, padding: "0 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--foreground)", cursor: "pointer" }}
                >
                  Complete profile
                </button>
              )}
            </div>
          )}

          <BaselineSection
            hasBaseline={hasBaseline}
            baseline={buildProfileBaseline(profile)}
            baselineSurveyOpen={baselineSurveyOpen}
            savingSurvey={savingSurvey}
            initialSurvey={initialSurvey}
            onOpenSurvey={handleOpenSurvey}
            onCloseSurvey={handleCloseSurvey}
            onSaveSurvey={actions.handleSaveSurvey}
            onNavigate={onNavigate}
          />

          {savedPlans.length > 0 && (
            <SavedPlansSection
              savedPlans={savedPlans}
              filteredPlans={filteredPlans}
              groupedPlans={groupedPlans}
              collapsedGroups={collapsedGroups}
              loadingPlanId={loadingPlanId}
              editingPlanId={editingPlanId}
              planSearch={planSearch}
              planSort={planSort}
              groupByType={groupByType}
              onPlanSearch={setPlanSearch}
              onPlanSort={setPlanSort}
              onGroupByType={handleGroupByType}
              onToggleGroup={toggleGroup}
              onOpenPlan={actions.handleOpen}
              onDeletePlan={actions.handleDelete}
            />
          )}

          <IntakeFlow
            onSubmit={handleIntakeSubmit}
            isGenerating={isGenerating}
            baselineReady={hasBaseline}
          />
        </div>
      </div>

      {syncConflicts.length > 0 && pendingSurvey && (
        <ProfileSyncDialog
          conflicts={syncConflicts}
          syncing={syncing}
          onApply={actions.handleApplySync}
          onDismiss={actions.dismissSync}
        />
      )}
    </div>
  );
}
