import React, { useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { generateId, type SavedCareerPlan, type PlanMilestone } from "@/types/userProfile";
import { workflowsConfig } from "@/config/workflows";
import { extractPlanMilestones } from "@/services/geminiService";
import { streamWorkflow } from "@/ai/client";
import { coachingChatWorkflow } from "@/ai/workflows/coachingChat";
import { recordEvent } from "@/services/coachMemory";
import {
  buildProfileBaseline,
  buildSurveySummary,
  diffIdentityForSync,
  buildIdentityPatch,
  type IdentitySyncField,
  type IdentityKey,
} from "@/lib/careerBaseline";
import type { GoalPlanIntakeData } from "@/components/GoalPlanIntakeForm";
import type { CareerSurvey, UserProfile } from "@/types/userProfile";

const BUCKET = "user-documents";

type ChatMsg = { role: "user" | "model"; text: string };

/**
 * A live coaching session held in `chatRef`. The AI gateway is stateless, so we
 * keep the running transcript here and replay it into the coach workflow each
 * turn (mirrors the retired `createCoachingChat` helper). `turns` uses the exact
 * prompts the model saw (e.g. the detailed plan request), which can differ from
 * the friendlier text shown in the visible message list.
 */
type CoachSession = { systemInstruction: string; turns: ChatMsg[] };

interface StoredPlanPayload {
  version: 1;
  planMarkdown: string;
  goalType: string;
  goalSummary: string;
  transcript: ChatMsg[];
  intake?: GoalPlanIntakeData;
  /** Structured milestones snapshot (added later; the live completion state
   * lives on the SavedCareerPlan profile entry). */
  milestones?: PlanMilestone[];
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
  milestones: PlanMilestone[];
  setMilestones: React.Dispatch<React.SetStateAction<PlanMilestone[]>>;
  extractingMilestones: boolean;
  setExtractingMilestones: (v: boolean) => void;
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
  milestones,
  setMilestones,
  extractingMilestones,
  setExtractingMilestones,
  isGenerating,
  pendingSurvey,
  draftMarkdown,
}: GoalPlanningActionsParams) {
  // Cancels an in-flight plan/chat generation (real AbortController, mirrors GlobalChatPanel).
  const abortRef = useRef<AbortController | null>(null);
  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const buildSystemInstruction = () => {
    const baseline = buildProfileBaseline(profile);
    const surveySummary = buildSurveySummary(profile.careerSurvey);
    return (
      workflowsConfig.goal_planning.systemInstruction +
      "\n\n--- CANDIDATE PROFILE (BASELINE — ground every recommendation in this) ---\n" +
      (baseline || "No profile data provided yet.") +
      (surveySummary
        ? "\n\n--- CURRENT-STATE SURVEY (how they feel about their job RIGHT NOW — weave this into the snapshot and tailor advice to it) ---\n" +
          surveySummary
        : "")
    );
  };

  const handleSaveSurvey = useCallback(
    async (survey: CareerSurvey) => {
      setSavingSurvey(true);
      try {
        if (profileHasBaseline) {
          await updateProfile({ careerSurvey: survey });
          setBaselineSurveyOpen(false);
          return;
        }

        const diffs = diffIdentityForSync(profile, survey);
        const newKeys = diffs.filter((d) => d.status === "new").map((d) => d.key);
        const autoPatch = newKeys.length > 0 ? buildIdentityPatch(profile, survey, newKeys) : {};

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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [profile, profileHasBaseline, updateProfile],
  );

  const handleApplySync = useCallback(
    async (keys: IdentityKey[]) => {
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [profile, pendingSurvey, updateProfile],
  );

  const dismissSync = useCallback(() => {
    setSyncConflicts([]);
    setPendingSurvey(null);
  }, []);

  const handleGenerate = useCallback(
    async (intake: GoalPlanIntakeData) => {
      const labelFor = (g: { goalType: string; detail: string }) =>
        g.goalType === "Other"
          ? g.detail.split("\n")[0].slice(0, 48).trim() || "Custom goal"
          : g.goalType;

      const multi = intake.goals.length > 1;
      const summary = intake.goals.map(labelFor).join(", ");
      const typeMeta = multi ? `${intake.goals.length} goals` : labelFor(intake.goals[0]);

      setGoalType(typeMeta);
      setGoalSummary(summary);
      setPlanMarkdown("");
      setCurrentIntake(intake);
      setEditingSheet(false);
      setMilestones([]);
      setMode("plan");
      setIsGenerating(true);

      const session: CoachSession = { systemInstruction: buildSystemInstruction(), turns: [] };
      chatRef.current = session;

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

      setMessages([
        { role: "user", text: friendlyUserMsg },
        { role: "model", text: "" },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        let full = "";
        await streamWorkflow(
          coachingChatWorkflow,
          {
            systemInstruction: session.systemInstruction,
            history: session.turns,
            message: request,
          },
          {
            signal: controller.signal,
            onToken: (delta) => {
              full += delta;
              setPlanMarkdown(full);
              setMessages((prev) => {
                const m = [...prev];
                m[m.length - 1] = { role: "model", text: full };
                return m;
              });
            },
          },
        );
        session.turns.push({ role: "user", text: request }, { role: "model", text: full });
      } catch (err) {
        // A user-initiated stop leaves the partial plan in place, no error.
        if (controller.signal.aborted) return;
        console.error("Plan generation failed:", err);
        const msg =
          "**Error:** Could not generate your plan. Make sure the local AI gateway is running (`npm run dev:functions`).";
        setPlanMarkdown(msg);
        setMessages((prev) => {
          const m = [...prev];
          m[m.length - 1] = { role: "model", text: msg };
          return m;
        });
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [profile],
  );

  const handleSend = useCallback(
    async (e?: React.FormEvent, overrideText?: string) => {
      if (e) e.preventDefault();
      const text = (overrideText ?? input).trim();
      const session = chatRef.current as CoachSession | null;
      if (!text || isGenerating || !session) return;

      setInput("");
      setIsGenerating(true);
      setMessages((prev) => [...prev, { role: "user", text }, { role: "model", text: "" }]);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        let full = "";
        await streamWorkflow(
          coachingChatWorkflow,
          { systemInstruction: session.systemInstruction, history: session.turns, message: text },
          {
            signal: controller.signal,
            onToken: (delta) => {
              full += delta;
              setMessages((prev) => {
                const m = [...prev];
                m[m.length - 1] = { role: "model", text: full };
                return m;
              });
            },
          },
        );
        session.turns.push({ role: "user", text }, { role: "model", text: full });
      } catch (err) {
        // A user-initiated stop leaves the partial reply in place, no error.
        if (controller.signal.aborted) return;
        console.error("Coaching reply failed:", err);
        setMessages((prev) => {
          const m = [...prev];
          m[m.length - 1] = {
            role: "model",
            text: "**Error:** Failed to reach the coach. Is the AI gateway running?",
          };
          return m;
        });
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [input, isGenerating],
  );

  const handleOpen = useCallback(
    async (plan: SavedCareerPlan) => {
      setLoadingPlanId(plan.id);
      try {
        const { data, error } = await supabase.storage.from(BUCKET).download(plan.storagePath);
        if (error || !data) throw error ?? new Error("No data");
        const payload = JSON.parse(await data.text()) as StoredPlanPayload;
        const transcript = payload.transcript ?? [];
        // Seed a live coach session with the saved transcript so follow-ups
        // replay the prior conversation (copy so replay pushes don't mutate the
        // array we hand to the message list).
        const session: CoachSession = {
          systemInstruction: buildSystemInstruction(),
          turns: [...transcript],
        };
        chatRef.current = session;
        setPlanMarkdown(payload.planMarkdown);
        setGoalType(payload.goalType);
        setGoalSummary(payload.goalSummary);
        setMessages(transcript);
        setCurrentIntake(payload.intake ?? null);
        setMilestones(plan.milestones ?? payload.milestones ?? []);
        setEditingPlanId(plan.id);
        setEditingSheet(false);
        setMode("plan");
      } catch (err) {
        console.error("Failed to open plan:", err);
      } finally {
        setLoadingPlanId(null);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [profile],
  );

  const handleDelete = useCallback(
    async (plan: SavedCareerPlan) => {
      try {
        await supabase.storage.from(BUCKET).remove([plan.storagePath]);
      } catch (err) {
        console.error("Storage delete failed:", err);
      }
      await updateProfile({ savedCareerPlans: savedPlans.filter((p) => p.id !== plan.id) });
      if (editingPlanId === plan.id) setEditingPlanId(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [savedPlans, editingPlanId, updateProfile],
  );

  const existingPlan = editingPlanId ? savedPlans.find((p) => p.id === editingPlanId) : undefined;

  const openSaveDialog = useCallback(
    (asCopy = false) => {
      setSaveAsCopy(asCopy);
      const fallback = [profile.preferredName || profile.fullName, "Plan", goalSummary]
        .filter(Boolean)
        .join(" — ");
      const auto = asCopy
        ? `${existingPlan?.name ?? fallback} (copy)`
        : (existingPlan?.name ?? fallback);
      setSaveName(auto);
      setShowSaveDialog(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [profile, goalSummary, existingPlan],
  );

  const handleSave = useCallback(async () => {
    if (!user) return;
    const reuse = saveAsCopy ? undefined : existingPlan;
    const id = reuse?.id ?? generateId();
    const storagePath = reuse?.storagePath ?? `${user.id}/career-plans/${id}.json`;
    const name = saveName.trim() || goalSummary || "Career Plan";

    setIsSaving(true);
    try {
      let nextMilestones = milestones;
      if (nextMilestones.length === 0 && planMarkdown.trim()) {
        try {
          const extracted = await extractPlanMilestones(planMarkdown);
          nextMilestones = extracted.map((e) => ({
            id: generateId(),
            title: e.title,
            timeframe: e.timeframe,
            done: false,
          }));
        } catch (err) {
          console.error("Milestone extraction failed:", err);
        }
      }
      setMilestones(nextMilestones);

      const payload: StoredPlanPayload = {
        version: 1,
        planMarkdown,
        goalType,
        goalSummary,
        transcript: messages,
        intake: currentIntake ?? undefined,
        milestones: nextMilestones,
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, blob, { upsert: true, contentType: "application/json" });
      if (error) throw error;

      const createdAt = reuse?.createdAt ?? new Date().toISOString();
      const entry: SavedCareerPlan = {
        id,
        name,
        storagePath,
        goalType,
        goalSummary,
        createdAt,
        milestones: nextMilestones,
        lastCheckInAt: reuse?.lastCheckInAt,
      };
      const nextPlans = reuse
        ? savedPlans.map((p) => (p.id === id ? entry : p))
        : [...savedPlans, entry];

      await updateProfile({ savedCareerPlans: nextPlans });
      // Coach OS: remember this plan and its milestones (fire-and-forget).
      void recordEvent(
        "goal_planner",
        `Saved career plan "${name}". Goal: ${goalType} — ${goalSummary}. Milestones (${nextMilestones.length}): ${nextMilestones
          .map((m) => m.title)
          .slice(0, 8)
          .join("; ")}.`,
      );
      setEditingPlanId(id);
      setShowSaveDialog(false);
      setSaveAsCopy(false);
    } catch (err) {
      console.error("Failed to save plan:", err);
    } finally {
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user,
    savedPlans,
    planMarkdown,
    goalType,
    goalSummary,
    messages,
    currentIntake,
    editingPlanId,
    saveAsCopy,
    saveName,
    existingPlan,
    updateProfile,
  ]);

  const startEditSheet = useCallback(() => {
    setDraftMarkdown(planMarkdown);
    setEditingSheet(true);
  }, [planMarkdown]);
  const applyEditSheet = useCallback(() => {
    setPlanMarkdown(draftMarkdown);
    setEditingSheet(false);
  }, [draftMarkdown]);
  const cancelEditSheet = useCallback(() => setEditingSheet(false), []);

  /* ── Milestone tracking ──────────────────────────────────────────── */
  const persistMilestones = useCallback(
    async (next: PlanMilestone[], extra: Partial<SavedCareerPlan> = {}) => {
      setMilestones(next);
      if (!editingPlanId) return;
      await updateProfile({
        savedCareerPlans: savedPlans.map((p) =>
          p.id === editingPlanId ? { ...p, milestones: next, ...extra } : p,
        ),
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [editingPlanId, savedPlans, updateProfile],
  );

  const toggleMilestone = useCallback(
    (id: string) => {
      const next = milestones.map((m) =>
        m.id === id
          ? { ...m, done: !m.done, completedAt: !m.done ? new Date().toISOString() : undefined }
          : m,
      );
      persistMilestones(next);
    },
    [milestones, persistMilestones],
  );

  const handleExtractMilestones = useCallback(async () => {
    if (!planMarkdown.trim() || extractingMilestones) return;
    setExtractingMilestones(true);
    try {
      const extracted = await extractPlanMilestones(planMarkdown);
      await persistMilestones(
        extracted.map((e) => ({
          id: generateId(),
          title: e.title,
          timeframe: e.timeframe,
          done: false,
        })),
      );
    } catch (err) {
      console.error("Milestone extraction failed:", err);
    } finally {
      setExtractingMilestones(false);
    }
  }, [planMarkdown, extractingMilestones, persistMilestones]);

  const handleCheckIn = useCallback(() => {
    if (isGenerating || !chatRef.current) return;
    const done = milestones.filter((m) => m.done);
    const open = milestones.filter((m) => !m.done);
    const msg =
      `Progress check-in on my plan.\n` +
      `Completed so far: ${done.length ? done.map((m) => m.title).join("; ") : "nothing yet"}.\n` +
      (open.length ? `Still open: ${open.map((m) => m.title).join("; ")}.\n` : "") +
      `Given this progress, what should I focus on for the next two weeks? Call out anything that's slipping, and adjust the plan if needed.`;
    handleSend(undefined, msg);
    if (editingPlanId) {
      updateProfile({
        savedCareerPlans: savedPlans.map((p) =>
          p.id === editingPlanId ? { ...p, lastCheckInAt: new Date().toISOString() } : p,
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, milestones, editingPlanId, savedPlans, updateProfile, handleSend]);

  return {
    handleSaveSurvey,
    handleApplySync,
    dismissSync,
    handleGenerate,
    handleSend,
    stopGenerating,
    handleOpen,
    handleDelete,
    openSaveDialog,
    handleSave,
    startEditSheet,
    applyEditSheet,
    cancelEditSheet,
    existingPlan,
    toggleMilestone,
    handleExtractMilestones,
    handleCheckIn,
  };
}
