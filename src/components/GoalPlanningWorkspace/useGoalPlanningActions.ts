import React from "react";
import { supabase } from "@/lib/supabaseClient";
import { generateId, type SavedCareerPlan } from "@/types/userProfile";
import { workflowsConfig } from "@/config/workflows";
import { createCoachingChat, sendMessageStream } from "@/services/geminiService";
import {
  buildProfileBaseline, buildSurveySummary,
  diffIdentityForSync, buildIdentityPatch,
  type IdentitySyncField, type IdentityKey,
} from "@/lib/careerBaseline";
import type { GoalPlanIntakeData } from "@/components/GoalPlanIntakeForm";
import type { CareerSurvey, UserProfile } from "@/types/userProfile";

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

export interface GoalPlanningActionsParams {
  profile: UserProfile;
  user: { id: string } | null;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  profileHasBaseline: boolean;
  savedPlans: SavedCareerPlan[];
  planMarkdown: string;
  goalType: string;
  goalSummary: string;
  messages: ChatMsg[];
  input: string;
  currentIntake: GoalPlanIntakeData | null;
  editingPlanId: string | null;
  saveAsCopy: boolean;
  saveName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chatRef: React.MutableRefObject<any>;
  setPlanMarkdown: (v: string) => void;
  setGoalType: (v: string) => void;
  setGoalSummary: (v: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMsg[]>>;
  setIsGenerating: (v: boolean) => void;
  setInput: (v: string) => void;
  setCurrentIntake: (v: GoalPlanIntakeData | null) => void;
  setEditingPlanId: (v: string | null) => void;
  setEditingSheet: (v: boolean) => void;
  setDraftMarkdown: (v: string) => void;
  setMode: (v: "list" | "plan" | "responses") => void;
  setLoadingPlanId: (v: string | null) => void;
  setSavingSurvey: (v: boolean) => void;
  setSyncConflicts: (v: IdentitySyncField[]) => void;
  setPendingSurvey: (v: CareerSurvey | null) => void;
  setSyncing: (v: boolean) => void;
  setBaselineSurveyOpen: (v: boolean) => void;
  setShowSaveDialog: (v: boolean) => void;
  setSaveName: (v: string) => void;
  setIsSaving: (v: boolean) => void;
  setSaveAsCopy: (v: boolean) => void;
  isGenerating: boolean;
  pendingSurvey: CareerSurvey | null;
  draftMarkdown: string;
}

export function useGoalPlanningActions({
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
}: GoalPlanningActionsParams) {
  const buildSystemInstruction = () => {
    const baseline = buildProfileBaseline(profile);
    const surveySummary = buildSurveySummary(profile.careerSurvey);
    return (
      workflowsConfig.goal_planning.systemInstruction +
      "\n\n--- CANDIDATE PROFILE (BASELINE — ground every recommendation in this) ---\n" +
      (baseline || "No profile data provided yet.") +
      (surveySummary
        ? "\n\n--- CURRENT-STATE SURVEY (how they feel about their job RIGHT NOW — weave this into the snapshot and tailor advice to it) ---\n" + surveySummary
        : "")
    );
  };

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

  return {
    handleSaveSurvey,
    handleApplySync,
    dismissSync,
    handleGenerate,
    handleSend,
    handleOpen,
    handleDelete,
    openSaveDialog,
    handleSave,
    startEditSheet,
    applyEditSheet,
    cancelEditSheet,
    existingPlan,
  };
}
