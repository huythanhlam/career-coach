import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { generateId, type SavedCareerPlan } from "@/types/userProfile";
import { workflowsConfig } from "@/config/workflows";
import { createCoachingChat, sendMessageStream } from "@/services/geminiService";
import {
  buildProfileBaseline, isProfileThin, buildSurveySummary,
  getProfileIdentity, hasBaselineIdentity, hasProfileBaseline, diffIdentityForSync, buildIdentityPatch,
  type IdentitySyncField, type IdentityKey,
} from "@/lib/careerBaseline";
import { GoalPlanIntakeForm, type GoalPlanIntakeData } from "@/components/GoalPlanIntakeForm";
import type { CareerSurvey } from "@/types/userProfile";
import type { ViewId } from "@/components/Sidebar";
import { ProfileSyncDialog } from "./ProfileSyncDialog";
import { SaveDialog } from "./SaveDialog";
import { PlanView } from "./PlanView";
import { ResponsesView } from "./ResponsesView";
import { BaselineSection } from "./BaselineSection";
import { SavedPlansSection } from "./SavedPlansSection";

const BUCKET = "user-documents";

type ChatMsg = { role: "user" | "model"; text: string };

interface StoredPlanPayload {
  version: 1;
  planMarkdown: string;
  goalType: string;
  goalSummary: string;
  transcript: ChatMsg[];
  intake?: GoalPlanIntakeData;
}

interface GoalPlanningWorkspaceProps {
  onNavigate?: (view: ViewId) => void;
}

export function GoalPlanningWorkspace({ onNavigate }: GoalPlanningWorkspaceProps) {
  const { profile, updateProfile } = useUserProfile();
  const { user } = useAuth();

  const baseline = useMemo(() => buildProfileBaseline(profile), [profile]);
  const thin = useMemo(() => isProfileThin(profile), [profile]);
  const surveySummary = useMemo(() => buildSurveySummary(profile.careerSurvey), [profile.careerSurvey]);
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

  const buildSystemInstruction = () =>
    workflowsConfig.goal_planning.systemInstruction +
    "\n\n--- CANDIDATE PROFILE (BASELINE — ground every recommendation in this) ---\n" +
    (baseline || "No profile data provided yet.") +
    (surveySummary
      ? "\n\n--- CURRENT-STATE SURVEY (how they feel about their job RIGHT NOW — weave this into the snapshot and tailor advice to it) ---\n" + surveySummary
      : "");

  const handleSaveSurvey = async (survey: CareerSurvey) => {
    setSavingSurvey(true);
    try {
      if (profileHasBaseline) {
        await updateProfile({ careerSurvey: survey });
        setBaselineSurveyOpen(false);
        return;
      }

      const diffs = diffIdentityForSync(profile, survey);
      const newKeys = diffs.filter((d) => d.status === "new").map((d) => d.key);
      const autoPatch =
        newKeys.length > 0 ? buildIdentityPatch(profile, survey, newKeys) : {};

      await updateProfile({ careerSurvey: survey, ...autoPatch });
      setBaselineSurveyOpen(false);

      const conflicts = diffs.filter((d) => d.status === "conflict");
      if (conflicts.length > 0) {
        setSyncConflicts(conflicts);
        setPendingSurvey(survey);
      }
    } catch (err) {
      console.error("Failed to save survey:", err);
    } finally {
      setSavingSurvey(false);
    }
  };

  const handleApplySync = async (keys: IdentityKey[]) => {
    if (!pendingSurvey) return;
    setSyncing(true);
    try {
      if (keys.length > 0) {
        const patch = buildIdentityPatch(profile, pendingSurvey, keys);
        if (Object.keys(patch).length > 0) await updateProfile(patch);
      }
    } catch (err) {
      console.error("Failed to sync profile:", err);
    } finally {
      setSyncing(false);
      setSyncConflicts([]);
      setPendingSurvey(null);
    }
  };

  const dismissSync = () => {
    setSyncConflicts([]);
    setPendingSurvey(null);
  };

  const handleGenerate = async (intake: GoalPlanIntakeData) => {
    const labelFor = (g: { goalType: string; detail: string }) =>
      g.goalType === "Other"
        ? (g.detail.split("\n")[0].slice(0, 48).trim() || "Custom goal")
        : g.goalType;

    const multi = intake.goals.length > 1;
    const summary = intake.goals.map(labelFor).join(", ");
    const typeMeta = multi ? `${intake.goals.length} goals` : labelFor(intake.goals[0]);

    setGoalType(typeMeta);
    setGoalSummary(summary);
    setPlanMarkdown("");
    setCurrentIntake(intake);
    setEditingSheet(false);
    setMode("plan");
    setIsGenerating(true);

    const chat = createCoachingChat(buildSystemInstruction());
    chatRef.current = chat;

    const goalsBlock = intake.goals
      .map((g, i) => {
        const head = g.goalType === "Other" ? "Custom goal" : g.goalType;
        return `${i + 1}. ${head}${g.detail ? `\n   What I want to do this year: ${g.detail}` : ""}`;
      })
      .join("\n");

    const request =
      `Please create my career development plan for the next ${intake.timeframe}.\n\n` +
      `My goal${multi ? "s" : ""} for the year:\n${goalsBlock}\n\n` +
      (intake.notes ? `Additional context: ${intake.notes}\n\n` : "") +
      (multi
        ? `Create ONE integrated plan that addresses all of these goals together — highlight where they reinforce each other and sequence them so they don't compete for my time.\n\n`
        : "") +
      `Ground every step in my profile baseline and tailor it to my real background.`;

    const friendlyUserMsg = `Create my plan — ${summary} (${intake.timeframe}).`;

    setMessages([{ role: "user", text: friendlyUserMsg }, { role: "model", text: "" }]);

    try {
      let full = "";
      await sendMessageStream(chat, request, (chunk) => {
        full += chunk;
        setPlanMarkdown(full);
        setMessages((prev) => {
          const m = [...prev];
          m[m.length - 1] = { role: "model", text: full };
          return m;
        });
      });
    } catch (err) {
      console.error("Plan generation failed:", err);
      const msg = "**Error:** Could not generate your plan. Make sure the local AI gateway is running (`npx tsx server.ts`).";
      setPlanMarkdown(msg);
      setMessages((prev) => {
        const m = [...prev];
        m[m.length - 1] = { role: "model", text: msg };
        return m;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const text = (overrideText ?? input).trim();
    if (!text || isGenerating || !chatRef.current) return;

    setInput("");
    setIsGenerating(true);
    setMessages((prev) => [...prev, { role: "user", text }, { role: "model", text: "" }]);

    try {
      let full = "";
      await sendMessageStream(chatRef.current, text, (chunk) => {
        full += chunk;
        setMessages((prev) => {
          const m = [...prev];
          m[m.length - 1] = { role: "model", text: full };
          return m;
        });
      });
    } catch (err) {
      console.error("Coaching reply failed:", err);
      setMessages((prev) => {
        const m = [...prev];
        m[m.length - 1] = { role: "model", text: "**Error:** Failed to reach the coach. Is the AI gateway running?" };
        return m;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpen = async (plan: SavedCareerPlan) => {
    setLoadingPlanId(plan.id);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(plan.storagePath);
      if (error || !data) throw error ?? new Error("No data");
      const payload = JSON.parse(await data.text()) as StoredPlanPayload;
      const transcript = payload.transcript ?? [];
      chatRef.current = createCoachingChat(buildSystemInstruction(), transcript);
      setPlanMarkdown(payload.planMarkdown);
      setGoalType(payload.goalType);
      setGoalSummary(payload.goalSummary);
      setMessages(transcript);
      setCurrentIntake(payload.intake ?? null);
      setEditingPlanId(plan.id);
      setEditingSheet(false);
      setMode("plan");
    } catch (err) {
      console.error("Failed to open plan:", err);
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleDelete = async (plan: SavedCareerPlan) => {
    try {
      await supabase.storage.from(BUCKET).remove([plan.storagePath]);
    } catch (err) {
      console.error("Storage delete failed:", err);
    }
    await updateProfile({ savedCareerPlans: savedPlans.filter((p) => p.id !== plan.id) });
    if (editingPlanId === plan.id) setEditingPlanId(null);
  };

  const existingPlan = editingPlanId ? savedPlans.find((p) => p.id === editingPlanId) : undefined;

  const openSaveDialog = (asCopy = false) => {
    setSaveAsCopy(asCopy);
    const fallback = [profile.preferredName || profile.fullName, "Plan", goalSummary].filter(Boolean).join(" — ");
    const auto = asCopy
      ? `${existingPlan?.name ?? fallback} (copy)`
      : existingPlan?.name ?? fallback;
    setSaveName(auto);
    setShowSaveDialog(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const reuse = saveAsCopy ? undefined : existingPlan;
    const id = reuse?.id ?? generateId();
    const storagePath = reuse?.storagePath ?? `${user.id}/career-plans/${id}.json`;
    const name = saveName.trim() || goalSummary || "Career Plan";

    setIsSaving(true);
    try {
      const payload: StoredPlanPayload = {
        version: 1,
        planMarkdown,
        goalType,
        goalSummary,
        transcript: messages,
        intake: currentIntake ?? undefined,
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, blob, { upsert: true, contentType: "application/json" });
      if (error) throw error;

      const createdAt = reuse?.createdAt ?? new Date().toISOString();
      const entry: SavedCareerPlan = { id, name, storagePath, goalType, goalSummary, createdAt };
      const nextPlans = reuse
        ? savedPlans.map((p) => (p.id === id ? entry : p))
        : [...savedPlans, entry];

      await updateProfile({ savedCareerPlans: nextPlans });
      setEditingPlanId(id);
      setShowSaveDialog(false);
      setSaveAsCopy(false);
    } catch (err) {
      console.error("Failed to save plan:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditSheet = () => { setDraftMarkdown(planMarkdown); setEditingSheet(true); };
  const applyEditSheet = () => { setPlanMarkdown(draftMarkdown); setEditingSheet(false); };
  const cancelEditSheet = () => setEditingSheet(false);

  /* ════════════════════════════ EDIT RESPONSES ═════════════════════ */
  if (mode === "responses") {
    return (
      <ResponsesView
        isGenerating={isGenerating}
        hasBaseline={hasBaseline}
        currentIntake={currentIntake}
        onGenerate={handleGenerate}
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
          onSend={handleSend}
          isGenerating={isGenerating}
          editingSheet={editingSheet}
          draftMarkdown={draftMarkdown}
          onDraftChange={setDraftMarkdown}
          onStartEdit={startEditSheet}
          onApplyEdit={applyEditSheet}
          onCancelEdit={cancelEditSheet}
          onBack={() => setMode("list")}
          onSave={() => openSaveDialog(false)}
          onSaveAsCopy={() => openSaveDialog(true)}
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
          onOpenPlan={handleOpen}
        />
        {showSaveDialog && (
          <SaveDialog
            saveName={saveName}
            setSaveName={setSaveName}
            isSaving={isSaving}
            title={saveAsCopy ? "Save as copy" : editingPlanId ? "Save changes" : "Save plan"}
            subtitle={saveAsCopy ? "This creates a new plan from your edits, leaving the original untouched." : undefined}
            onCancel={() => { setShowSaveDialog(false); setSaveAsCopy(false); }}
            onSave={handleSave}
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
            baseline={baseline}
            baselineSurveyOpen={baselineSurveyOpen}
            savingSurvey={savingSurvey}
            initialSurvey={initialSurvey}
            onOpenSurvey={() => setBaselineSurveyOpen(true)}
            onCloseSurvey={() => setBaselineSurveyOpen(false)}
            onSaveSurvey={handleSaveSurvey}
            onNavigate={onNavigate}
          />

          {/* Saved plans */}
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
              onOpenPlan={handleOpen}
              onDeletePlan={handleDelete}
            />
          )}

          <GoalPlanIntakeForm
            onSubmit={(intake) => { setEditingPlanId(null); handleGenerate(intake); }}
            isGenerating={isGenerating}
            baselineReady={hasBaseline}
          />
        </div>
      </div>

      {syncConflicts.length > 0 && pendingSurvey && (
        <ProfileSyncDialog
          conflicts={syncConflicts}
          syncing={syncing}
          onApply={handleApplySync}
          onDismiss={dismissSync}
        />
      )}
    </div>
  );
}
