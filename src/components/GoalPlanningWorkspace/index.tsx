import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { useAuth } from "@/context/AuthContext";
import {
  isProfileThin, buildProfileBaseline, buildSurveySummary,
  getProfileIdentity, hasBaselineIdentity, hasProfileBaseline,
  type IdentitySyncField,
} from "@/lib/careerBaseline";
import { GoalPlanIntakeForm, type GoalPlanIntakeData } from "@/components/GoalPlanIntakeForm";
import type { CareerSurvey } from "@/types/userProfile";
import type { ViewId } from "@/components/Sidebar";
import { workflowsConfig } from "@/config/workflows";
import { ProfileSyncDialog } from "./ProfileSyncDialog";
import { SaveDialog } from "./SaveDialog";
import { PlanView } from "./PlanView";
import { ResponsesView } from "./ResponsesView";
import { BaselineSection } from "./BaselineSection";
import { SavedPlansSection } from "./SavedPlansSection";
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

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

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
    isGenerating,
    pendingSurvey,
    draftMarkdown,
  });

  /* ════════════════════════════ EDIT RESPONSES ═════════════════════ */
  if (mode === "responses") {
    return (
      <ResponsesView
        isGenerating={isGenerating}
        hasBaseline={hasBaseline}
        currentIntake={currentIntake}
        onGenerate={actions.handleGenerate}
        onBack={() => setMode("plan")}
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
          onBack={() => setMode("list")}
          onSave={() => actions.openSaveDialog(false)}
          onSaveAsCopy={() => actions.openSaveDialog(true)}
          currentIntake={currentIntake}
          onViewResponses={() => setMode("responses")}
          goalSummary={goalSummary}
          goalType={goalType}
          editingPlanId={editingPlanId}
          savedPlans={savedPlans}
          scrollRef={scrollRef}
          switcherOpen={switcherOpen}
          onSwitcherToggle={() => setSwitcherOpen((o) => !o)}
          onSwitcherClose={() => setSwitcherOpen(false)}
          onOpenPlan={actions.handleOpen}
        />
        {showSaveDialog && (
          <SaveDialog
            saveName={saveName}
            setSaveName={setSaveName}
            isSaving={isSaving}
            title={saveAsCopy ? "Save as copy" : editingPlanId ? "Save changes" : "Save plan"}
            subtitle={saveAsCopy ? "This creates a new plan from your edits, leaving the original untouched." : undefined}
            onCancel={() => { setShowSaveDialog(false); setSaveAsCopy(false); }}
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
            profileHasBaseline={profileHasBaseline}
            baseline={buildProfileBaseline(profile)}
            baselineSurveyOpen={baselineSurveyOpen}
            savingSurvey={savingSurvey}
            initialSurvey={initialSurvey}
            onOpenSurvey={() => setBaselineSurveyOpen(true)}
            onCloseSurvey={() => setBaselineSurveyOpen(false)}
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
              onGroupByType={() => setGroupByType((g) => !g)}
              onToggleGroup={toggleGroup}
              onOpenPlan={actions.handleOpen}
              onDeletePlan={actions.handleDelete}
            />
          )}

          <GoalPlanIntakeForm
            onSubmit={(intake) => { setEditingPlanId(null); actions.handleGenerate(intake); }}
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
