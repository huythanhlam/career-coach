import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Sparkles, Bookmark, Trash2, Plus, Target, AlertCircle,
  ArrowLeft, Send, User as UserIcon, ClipboardList, Check,
  Compass, UserCog, Pencil, SlidersHorizontal, Copy,
  Search, ChevronDown, ChevronRight, Layers,
  ListChecks, CheckCircle2, Circle, MessageCircleHeart,
} from "lucide-react";
import Markdown from "react-markdown";
import { useUserProfile } from "@/context/UserProfileContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { generateId, type SavedCareerPlan, type PlanMilestone } from "@/types/userProfile";
import { workflowsConfig } from "@/config/workflows";
import { createCoachingChat, sendMessageStream, extractPlanMilestones } from "@/services/geminiService";
import {
  buildProfileBaseline, isProfileThin, buildSurveySummary,
  getProfileIdentity, hasBaselineIdentity, hasProfileBaseline, diffIdentityForSync, buildIdentityPatch,
  type IdentitySyncField, type IdentityKey,
} from "@/lib/careerBaseline";
import { GoalPlanIntakeForm, type GoalPlanIntakeData } from "@/components/GoalPlanIntakeForm";
import { CurrentStateSurvey } from "@/components/CurrentStateSurvey";
import type { CareerSurvey } from "@/types/userProfile";
import type { ViewId } from "@/components/Sidebar";

const BUCKET = "user-documents";

type ChatMsg = { role: "user" | "model"; text: string };

interface StoredPlanPayload {
  version: 1;
  planMarkdown: string;
  goalType: string;
  goalSummary: string;
  transcript: ChatMsg[];
  /** The intake responses that produced this plan (added later; optional for
   * backward compatibility with plans saved before this feature). */
  intake?: GoalPlanIntakeData;
  /** Structured milestones snapshot (added later; the live completion state
   * lives on the SavedCareerPlan profile entry). */
  milestones?: PlanMilestone[];
}

interface GoalPlanningWorkspaceProps {
  onNavigate?: (view: ViewId) => void;
}

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 24,
  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
};

export function GoalPlanningWorkspace({ onNavigate }: GoalPlanningWorkspaceProps) {
  const { profile, updateProfile } = useUserProfile();
  const { user } = useAuth();

  const baseline = useMemo(() => buildProfileBaseline(profile), [profile]);
  const thin = useMemo(() => isProfileThin(profile), [profile]);
  const surveySummary = useMemo(() => buildSurveySummary(profile.careerSurvey), [profile.careerSurvey]);
  const hasBaseline = hasBaselineIdentity(profile, profile.careerSurvey);
  // When the profile already supplies the baseline, the survey's "Your role
  // today" section is hidden and the profile is the single source of truth.
  const profileHasBaseline = hasProfileBaseline(profile);

  // Pre-fill the survey's baseline section from the profile only when the
  // profile lacks it (so the survey is the fallback capture point).
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

  // Profile-sync confirmation (only for fields that conflict with the profile).
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

  // The responses behind the open plan, the saved plan being edited (so Save
  // updates in place), and inline plan-sheet editing.
  const [currentIntake, setCurrentIntake] = useState<GoalPlanIntakeData | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingSheet, setEditingSheet] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState("");

  // Saved-plan search / sort / grouping + in-plan quick switcher.
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
  // When true, the save dialog creates a NEW plan even if one is open (branch).
  const [saveAsCopy, setSaveAsCopy] = useState(false);

  const savedPlans = profile.savedCareerPlans ?? [];

  // Filter (name / goal type / summary) + sort the saved plans.
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

  // Group the filtered plans by goal type (preserving sorted order within each).
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
      // The survey only captures baseline when the profile lacks one; if the
      // profile already has it, just save the survey (no sync needed).
      if (profileHasBaseline) {
        await updateProfile({ careerSurvey: survey });
        setBaselineSurveyOpen(false);
        return;
      }

      // Save the survey AND auto-push baseline fields that are empty in the
      // profile — in ONE update so we don't race the profile closure.
      const diffs = diffIdentityForSync(profile, survey);
      const newKeys = diffs.filter((d) => d.status === "new").map((d) => d.key);
      const autoPatch =
        newKeys.length > 0 ? buildIdentityPatch(profile, survey, newKeys) : {};

      await updateProfile({ careerSurvey: survey, ...autoPatch });
      setBaselineSurveyOpen(false);

      // Anything that differs from a non-empty profile field needs confirmation.
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

  /* ── Apply chosen overwrites from the sync dialog ────────────────── */
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

  /* ── Generate a fresh plan from the intake form ──────────────────── */
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
    setMilestones([]);
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

  /* ── Coaching follow-ups ─────────────────────────────────────────── */
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

  /* ── Saved plans: open / delete ──────────────────────────────────── */
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
      // Live completion state lives on the profile entry; the payload only
      // carries the snapshot from the last save (older plans have neither).
      setMilestones(plan.milestones ?? payload.milestones ?? []);
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

  /* ── Save current plan + transcript ──────────────────────────────── */
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
    // Update in place only when editing an existing plan AND not branching a copy.
    const reuse = saveAsCopy ? undefined : existingPlan;
    const id = reuse?.id ?? generateId();
    const storagePath = reuse?.storagePath ?? `${user.id}/career-plans/${id}.json`;
    const name = saveName.trim() || goalSummary || "Career Plan";

    setIsSaving(true);
    try {
      // First save of a plan: turn its Milestones section into a checkable
      // list. Extraction failure is tolerated — the plan still saves.
      let nextMilestones = milestones;
      if (nextMilestones.length === 0 && planMarkdown.trim()) {
        try {
          const extracted = await extractPlanMilestones(planMarkdown);
          nextMilestones = extracted.map((e) => ({
            id: generateId(), title: e.title, timeframe: e.timeframe, done: false,
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
        id, name, storagePath, goalType, goalSummary, createdAt,
        milestones: nextMilestones, lastCheckInAt: reuse?.lastCheckInAt,
      };
      const nextPlans = reuse
        ? savedPlans.map((p) => (p.id === id ? entry : p))
        : [...savedPlans, entry];

      await updateProfile({ savedCareerPlans: nextPlans });
      setEditingPlanId(id); // subsequent saves target this plan (the copy, if branched)
      setShowSaveDialog(false);
      setSaveAsCopy(false);
    } catch (err) {
      console.error("Failed to save plan:", err);
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Milestone tracking ──────────────────────────────────────────── */
  // Completion state persists on the plan's profile entry immediately, so
  // progress survives without re-saving the whole plan.
  const persistMilestones = async (next: PlanMilestone[], extra: Partial<SavedCareerPlan> = {}) => {
    setMilestones(next);
    if (!editingPlanId) return;
    await updateProfile({
      savedCareerPlans: savedPlans.map((p) =>
        p.id === editingPlanId ? { ...p, milestones: next, ...extra } : p
      ),
    });
  };

  const toggleMilestone = (id: string) => {
    const next = milestones.map((m) =>
      m.id === id
        ? { ...m, done: !m.done, completedAt: !m.done ? new Date().toISOString() : undefined }
        : m
    );
    persistMilestones(next);
  };

  // Older plans (saved before milestones existed) can build their checklist on demand.
  const handleExtractMilestones = async () => {
    if (!planMarkdown.trim() || extractingMilestones) return;
    setExtractingMilestones(true);
    try {
      const extracted = await extractPlanMilestones(planMarkdown);
      await persistMilestones(
        extracted.map((e) => ({ id: generateId(), title: e.title, timeframe: e.timeframe, done: false }))
      );
    } catch (err) {
      console.error("Milestone extraction failed:", err);
    } finally {
      setExtractingMilestones(false);
    }
  };

  // Weekly check-in: tell the coach where things stand and let it adjust the plan.
  const handleCheckIn = () => {
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
          p.id === editingPlanId ? { ...p, lastCheckInAt: new Date().toISOString() } : p
        ),
      });
    }
  };

  /* ── Plan-sheet inline editing ───────────────────────────────────── */
  const startEditSheet = () => { setDraftMarkdown(planMarkdown); setEditingSheet(true); };
  const applyEditSheet = () => { setPlanMarkdown(draftMarkdown); setEditingSheet(false); };
  const cancelEditSheet = () => setEditingSheet(false);

  const renderPlanCard = (p: SavedCareerPlan) => (
    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--card)", border: `1px solid ${editingPlanId === p.id ? "var(--primary)" : "var(--border)"}`, borderRadius: 14 }}>
      <Target className="w-5 h-5 shrink-0" style={{ color: "var(--primary)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
          {p.goalType} · {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </div>
        {(p.milestones?.length ?? 0) > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <div style={{ flex: 1, maxWidth: 160, height: 5, background: "var(--muted)", borderRadius: 9999, overflow: "hidden" }}>
              <div style={{ width: `${Math.round((p.milestones!.filter((m) => m.done).length / p.milestones!.length) * 100)}%`, height: "100%", background: "var(--forest)", borderRadius: 9999 }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
              {p.milestones!.filter((m) => m.done).length}/{p.milestones!.length} milestones
            </span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => handleOpen(p)}
        disabled={loadingPlanId === p.id}
        style={{ height: 36, padding: "0 16px", background: "var(--primary)", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", cursor: loadingPlanId === p.id ? "not-allowed" : "pointer", opacity: loadingPlanId === p.id ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}
      >
        {loadingPlanId === p.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening…</> : "Open"}
      </button>
      <button
        type="button"
        onClick={() => handleDelete(p)}
        style={{ height: 36, width: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", color: "var(--muted-foreground)" }}
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  /* ════════════════════════════ EDIT RESPONSES ═════════════════════ */
  if (mode === "responses") {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
        <header style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <button
            onClick={() => setMode("plan")}
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
              onSubmit={handleGenerate}
              isGenerating={isGenerating}
              baselineReady={hasBaseline}
              initial={currentIntake ?? undefined}
              submitLabel="Regenerate plan"
              onCancel={() => setMode("plan")}
            />
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════ PLAN VIEW ═══════════════════════ */
  if (mode === "plan") {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
        <header style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <button
            onClick={() => setMode("list")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--border)", borderRadius: 10, height: 36, padding: "0 12px", cursor: "pointer", color: "var(--foreground)", fontFamily: "inherit", fontSize: 13, fontWeight: 500 }}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {goalSummary || "Your Development Plan"}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{goalType}{editingPlanId ? " · Saved plan" : ""}</div>
          </div>
          {savedPlans.length > 1 && (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setSwitcherOpen((o) => !o)}
                disabled={isGenerating}
                aria-haspopup="listbox"
                aria-expanded={switcherOpen}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, height: 36, padding: "0 12px", cursor: isGenerating ? "not-allowed" : "pointer", color: "var(--foreground)", fontFamily: "inherit", fontSize: 13, fontWeight: 600, opacity: isGenerating ? 0.6 : 1 }}
              >
                <Bookmark className="w-3.5 h-3.5" /> Switch plan <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {switcherOpen && (
                <>
                  <div onClick={() => setSwitcherOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div role="listbox" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, width: 300, maxHeight: 340, overflow: "auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.18)", padding: 6 }}>
                    {savedPlans.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((p) => {
                      const isCurrent = p.id === editingPlanId;
                      return (
                        <button
                          key={p.id}
                          role="option"
                          aria-selected={isCurrent}
                          onClick={() => { setSwitcherOpen(false); if (!isCurrent) handleOpen(p); }}
                          style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, border: "none", background: isCurrent ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent", cursor: isCurrent ? "default" : "pointer", fontFamily: "inherit" }}
                        >
                          <Target className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                            <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)" }}>{p.goalType} · {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </span>
                          {isCurrent && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary)" }} />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          {currentIntake && (
            <button
              onClick={() => setMode("responses")}
              disabled={isGenerating}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, height: 36, padding: "0 14px", cursor: isGenerating ? "not-allowed" : "pointer", color: "var(--foreground)", fontFamily: "inherit", fontSize: 13, fontWeight: 600, opacity: isGenerating ? 0.6 : 1 }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Edit responses
            </button>
          )}
          {editingPlanId && (
            <button
              onClick={() => openSaveDialog(true)}
              disabled={isGenerating || !planMarkdown.trim()}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, height: 36, padding: "0 14px", cursor: isGenerating || !planMarkdown.trim() ? "not-allowed" : "pointer", color: "var(--foreground)", fontFamily: "inherit", fontSize: 13, fontWeight: 600, opacity: isGenerating || !planMarkdown.trim() ? 0.6 : 1 }}
            >
              <Copy className="w-3.5 h-3.5" /> Save as copy
            </button>
          )}
          <button
            onClick={() => openSaveDialog(false)}
            disabled={isGenerating || !planMarkdown.trim()}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--primary)", border: "none", borderRadius: 10, height: 36, padding: "0 16px", cursor: isGenerating || !planMarkdown.trim() ? "not-allowed" : "pointer", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, opacity: isGenerating || !planMarkdown.trim() ? 0.6 : 1 }}
          >
            <Bookmark className="w-3.5 h-3.5" /> {editingPlanId ? "Save changes" : "Save plan"}
          </button>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Plan pane */}
          <div className="flex-1 overflow-auto no-scrollbar" style={{ padding: 28 }}>
            {/* Milestones — the plan as a living checklist */}
            {planMarkdown.trim() && !isGenerating && (
              <div style={{ maxWidth: 720, margin: "0 auto 20px", ...cardStyle, overflow: "hidden" }}>
                <div style={{ padding: "16px 22px", borderBottom: milestones.length > 0 ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <ListChecks className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Milestones</span>
                  {milestones.length > 0 ? (
                    <>
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                        {milestones.filter((m) => m.done).length} of {milestones.length} done
                      </span>
                      <div style={{ flex: "1 1 80px", minWidth: 60, height: 6, background: "var(--muted)", borderRadius: 9999, overflow: "hidden" }}>
                        <div style={{ width: `${Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100)}%`, height: "100%", background: "var(--forest)", borderRadius: 9999, transition: "width 300ms ease" }} />
                      </div>
                      <button
                        onClick={handleCheckIn}
                        disabled={isGenerating}
                        title="Tell the coach where things stand and get the plan adjusted"
                        style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--primary)", border: "none", borderRadius: 8, height: 32, padding: "0 12px", cursor: isGenerating ? "not-allowed" : "pointer", color: "#fff", fontFamily: "inherit", fontSize: 12, fontWeight: 600, opacity: isGenerating ? 0.6 : 1 }}
                      >
                        <MessageCircleHeart className="w-3.5 h-3.5" /> Check in
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleExtractMilestones}
                      disabled={extractingMilestones}
                      style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, height: 32, padding: "0 12px", cursor: extractingMilestones ? "not-allowed" : "pointer", color: "var(--foreground)", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}
                    >
                      {extractingMilestones ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building…</> : <><Sparkles className="w-3.5 h-3.5" /> Turn the plan into a checklist</>}
                    </button>
                  )}
                </div>
                {milestones.length > 0 && (
                  <div style={{ padding: "8px 12px" }}>
                    {milestones.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => toggleMilestone(m.id)}
                        style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 10px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        {m.done
                          ? <CheckCircle2 className="w-[18px] h-[18px] shrink-0" style={{ color: "var(--forest)", marginTop: 1 }} />
                          : <Circle className="w-[18px] h-[18px] shrink-0" style={{ color: "var(--muted-foreground)", opacity: 0.5, marginTop: 1 }} />}
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: m.done ? "var(--muted-foreground)" : "var(--foreground)", textDecoration: m.done ? "line-through" : "none", lineHeight: 1.45 }}>
                            {m.title}
                          </span>
                          {m.timeframe && (
                            <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{m.timeframe}</span>
                          )}
                        </span>
                      </button>
                    ))}
                    {!editingPlanId && (
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", padding: "6px 10px 4px" }}>
                        Save the plan to keep tracking these between visits.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ maxWidth: 720, margin: "0 auto", ...cardStyle, overflow: "hidden" }}>
              <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                {isGenerating && !planMarkdown.trim()
                  ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
                  : <Target className="w-4 h-4" style={{ color: "var(--primary)" }} />}
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                  {isGenerating && !planMarkdown.trim() ? "Building your plan…" : "Career Goal Planning Sheet"}
                </span>
                {!isGenerating && planMarkdown.trim() && (
                  editingSheet ? (
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                      <button onClick={cancelEditSheet} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, height: 30, padding: "0 12px", cursor: "pointer", color: "var(--muted-foreground)", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>Cancel</button>
                      <button onClick={applyEditSheet} style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--primary)", border: "none", borderRadius: 8, height: 30, padding: "0 12px", cursor: "pointer", color: "#fff", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}><Check className="w-3.5 h-3.5" /> Done</button>
                    </div>
                  ) : (
                    <button onClick={startEditSheet} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid var(--border)", borderRadius: 8, height: 30, padding: "0 12px", cursor: "pointer", color: "var(--foreground)", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}><Pencil className="w-3.5 h-3.5" /> Edit</button>
                  )
                )}
              </div>
              <div style={{ padding: "20px 24px" }}>
                {editingSheet ? (
                  <div>
                    <textarea
                      value={draftMarkdown}
                      onChange={(e) => setDraftMarkdown(e.target.value)}
                      style={{ width: "100%", minHeight: 420, resize: "vertical", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", fontSize: 13, lineHeight: 1.6, color: "var(--foreground)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", outline: "none" }}
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)" }}>
                      Markdown supported. Click <strong>Done</strong> to apply, then <strong>{editingPlanId ? "Save changes" : "Save plan"}</strong> to persist.
                    </div>
                  </div>
                ) : planMarkdown.trim() ? (
                  <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
                    <Markdown>{planMarkdown}</Markdown>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48, color: "var(--muted-foreground)" }}>
                    <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: "var(--primary)" }} />
                    <p style={{ fontSize: 14 }}>Analyzing your profile and drafting a plan…</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Coaching chat pane */}
          <div className="w-[400px] h-full border-l border-border flex flex-col" style={{ background: "var(--card)" }}>
            <div className="flex items-center gap-3 border-b border-border" style={{ padding: "14px 18px", background: "var(--muted)" }}>
              <div className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center border" style={{ background: "rgba(217,119,87,0.10)", borderColor: "rgba(217,119,87,0.25)", color: "var(--primary)" }}>
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>The Coach</div>
                <div className="text-[10px] font-semibold" style={{ color: "var(--forest)" }}>● Grounded in your profile</div>
              </div>
            </div>

            <div className="flex-1 overflow-auto no-scrollbar" style={{ padding: 18 }}>
              <div className="space-y-4 pb-2">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 items-end ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className="w-[30px] h-[30px] rounded-xl flex items-center justify-center shrink-0 border text-xs font-semibold"
                      style={{ background: msg.role === "user" ? "var(--muted)" : "rgba(217,119,87,0.10)", borderColor: msg.role === "user" ? "var(--border)" : "rgba(217,119,87,0.2)", color: msg.role === "user" ? "var(--foreground)" : "var(--primary)" }}>
                      {msg.role === "user" ? <UserIcon className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </div>
                    <div className="max-w-[80%] rounded-[18px] px-4 py-2.5 text-sm leading-relaxed"
                      style={{
                        background: msg.role === "user" ? "var(--primary)" : "var(--card)",
                        color: msg.role === "user" ? "#FFF" : "var(--foreground)",
                        border: msg.role === "user" ? "none" : "1px solid var(--border)",
                        boxShadow: msg.role === "user" ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
                      }}>
                      <div className="prose prose-sm max-w-none" style={{ color: "inherit" }}>
                        <Markdown>{msg.text}</Markdown>
                        {msg.role === "model" && !msg.text && (
                          <div className="flex items-center gap-1 h-4">
                            <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--primary)" }} />
                            <div className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.2s]" style={{ background: "var(--primary)" }} />
                            <div className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.4s]" style={{ background: "var(--primary)" }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
            </div>

            <div className="border-t border-border" style={{ padding: 12, background: "var(--muted)" }}>
              {messages.length < 3 && (
                <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
                  {workflowsConfig.goal_planning.suggestedPrompts.slice(0, 3).map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(undefined, p)}
                      disabled={isGenerating}
                      className="whitespace-nowrap px-3 py-1.5 rounded-full border border-border text-[11px] font-medium transition-colors hover:border-primary/40"
                      style={{ background: "var(--card)", color: "var(--muted-foreground)", fontFamily: "inherit", cursor: isGenerating ? "not-allowed" : "pointer" }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={handleSend} className="flex items-center gap-2 rounded-[14px] border border-border" style={{ background: "var(--card)", padding: "8px 8px 8px 14px" }}>
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask the coach to refine your plan…"
                  className="flex-1 h-9 border-0 bg-transparent text-sm outline-none p-0"
                  style={{ color: "var(--foreground)", fontFamily: "inherit" }}
                />
                <button
                  type="submit"
                  disabled={isGenerating || !input.trim()}
                  className="w-9 h-9 rounded-[10px] flex-shrink-0 flex items-center justify-center"
                  style={{ background: "var(--primary)", color: "#FFF", border: "none", cursor: isGenerating || !input.trim() ? "not-allowed" : "pointer", opacity: isGenerating || !input.trim() ? 0.6 : 1 }}
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>

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
      </div>
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

          {/* Soft profile-completeness prompt (only once baseline exists; the
              intake form shows the stronger baseline gate when it's missing) */}
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

          {/* Baseline — a single card. When the baseline is missing it offers the
              two ways to provide a starting point: update profile (recommended)
              or take the quick baseline survey. */}
          {!hasBaseline && baselineSurveyOpen ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Compass className="w-4 h-4" style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Baseline survey</span>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Just your starting point — takes a moment.</span>
              </div>
              <CurrentStateSurvey
                initial={initialSurvey}
                isSaving={savingSurvey}
                onSave={handleSaveSurvey}
                onCancel={() => setBaselineSurveyOpen(false)}
                baselineOnly
              />
            </div>
          ) : (
            <div style={{ ...cardStyle, borderRadius: 18, overflow: "hidden" }}>
              <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <UserIcon className="w-4 h-4" style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Your baseline</span>
                {hasBaseline && onNavigate && (
                  <button
                    onClick={() => onNavigate("profile_settings")}
                    style={{ marginLeft: "auto", background: "transparent", border: "none", color: "var(--primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Edit profile
                  </button>
                )}
              </div>

              {hasBaseline ? (
                <div style={{ padding: "16px 22px" }}>
                  <pre style={{ margin: 0, fontFamily: "inherit", fontSize: 13, lineHeight: 1.6, color: "var(--muted-foreground)", whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>
                    {baseline}
                  </pre>
                </div>
              ) : (
                <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <Compass className="w-5 h-5 shrink-0" style={{ color: "var(--marigold)" }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 3 }}>
                        Tell us where you're starting from
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
                        The coach needs your <strong>current role</strong> (and ideally your company) to build a plan grounded in your real situation. Choose one:
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingLeft: 32 }}>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate("profile_settings")}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >
                        <UserCog className="w-4 h-4" /> Update my profile
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: "rgba(255,255,255,0.22)", borderRadius: 9999, padding: "2px 7px" }}>Recommended</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setBaselineSurveyOpen(true)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      <ClipboardList className="w-4 h-4" /> Take the baseline survey
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Current-state survey — always visible inline (no extra click) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ClipboardList className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Current-state survey</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)" }}>All optional</span>
            </div>

            {/* Why it matters — how it feeds the planning sheet */}
            <div style={{ padding: "14px 18px", borderRadius: 14, background: "color-mix(in srgb, var(--primary) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 18%, transparent)" }}>
              <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.6 }}>
                These answers are woven directly into your <strong>Career Goal Planning Sheet</strong>:
              </div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--muted-foreground)", lineHeight: 1.65 }}>
                <li>Your satisfaction and what drains you shape the <strong>Current Situation Snapshot</strong>.</li>
                <li>What energizes you and the skills you want to grow steer which <strong>goals get prioritized</strong>.</li>
                <li>Your recent wins become <strong>evidence</strong> the plan builds on.</li>
                <li>Your biggest blocker becomes something the plan <strong>explicitly tackles</strong>.</li>
              </ul>
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.55 }}>
                The more you share, the more personal and specific your plan — but it's optional, and your answers save when you hit <strong>Save</strong>.
              </div>
            </div>

            <CurrentStateSurvey
              initial={initialSurvey}
              isSaving={savingSurvey}
              onSave={handleSaveSurvey}
              showBaseline={false}
            />
          </div>

          {/* Saved plans */}
          {savedPlans.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <Bookmark className="w-3.5 h-3.5" /> Saved Plans
                <span style={{ fontWeight: 600, letterSpacing: 0, textTransform: "none", color: "var(--muted-foreground)" }}>({savedPlans.length})</span>
              </div>

              {/* Controls: search + sort + group toggle */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                  <Search className="w-4 h-4" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }} />
                  <input
                    type="text"
                    value={planSearch}
                    onChange={(e) => setPlanSearch(e.target.value)}
                    placeholder="Search plans by name or goal…"
                    style={{ width: "100%", height: 40, padding: "0 12px 0 36px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--foreground)", fontFamily: "inherit", outline: "none" }}
                  />
                </div>
                <select
                  value={planSort}
                  onChange={(e) => setPlanSort(e.target.value as typeof planSort)}
                  aria-label="Sort plans"
                  style={{ height: 40, padding: "0 12px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--foreground)", fontFamily: "inherit", cursor: "pointer" }}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="az">Name (A–Z)</option>
                </select>
                <button
                  type="button"
                  onClick={() => setGroupByType((g) => !g)}
                  aria-pressed={groupByType}
                  title="Group by goal type"
                  style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 14px", background: groupByType ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--muted)", border: `1px solid ${groupByType ? "var(--primary)" : "var(--border)"}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: groupByType ? "var(--primary)" : "var(--foreground)", fontFamily: "inherit", cursor: "pointer" }}
                >
                  <Layers className="w-4 h-4" /> Group
                </button>
              </div>

              {filteredPlans.length === 0 ? (
                <div style={{ padding: "18px 20px", borderRadius: 14, background: "var(--card)", border: "1px solid var(--border)", fontSize: 13, color: "var(--muted-foreground)" }}>
                  No plans match “{planSearch.trim()}”.
                </div>
              ) : groupByType ? (
                <div className="flex flex-col gap-4">
                  {groupedPlans.map(([type, plans]) => {
                    const collapsed = collapsedGroups.has(type);
                    return (
                      <div key={type}>
                        <button
                          type="button"
                          onClick={() => toggleGroup(type)}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 8, fontFamily: "inherit" }}
                        >
                          {collapsed ? <ChevronRight className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />}
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{type}</span>
                          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>({plans.length})</span>
                        </button>
                        {!collapsed && <div className="flex flex-col gap-3">{plans.map(renderPlanCard)}</div>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-3">{filteredPlans.map(renderPlanCard)}</div>
              )}

              <div style={{ margin: "28px 0 4px", borderTop: "1px solid var(--border)" }} />
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", margin: "20px 0 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus className="w-3.5 h-3.5" /> Plan a new goal
              </div>
            </div>
          )}

          {/* Intake form */}
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

/* ── Profile-sync dialog (overwrite confirmation) ────────────────── */
function ProfileSyncDialog({
  conflicts, syncing, onApply, onDismiss,
}: {
  conflicts: IdentitySyncField[];
  syncing: boolean;
  onApply: (keys: IdentityKey[]) => void;
  onDismiss: () => void;
}) {
  // Default OFF — overwriting existing profile data is opt-in.
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setChecked((p) => ({ ...p, [key]: !p[key] }));
  const selectedKeys = conflicts.filter((c) => checked[c.key]).map((c) => c.key);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onDismiss}>
      <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--card)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>Update your profile?</div>
        <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          Your survey answers differ from what's already in your profile. Choose which to overwrite — unchecked fields stay as they are.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {conflicts.map((c) => {
            const on = Boolean(checked[c.key]);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                aria-pressed={on}
                style={{ textAlign: "left", display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, border: `2px solid ${on ? "var(--primary)" : "var(--border)"}`, background: on ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}
              >
                <span aria-hidden style={{ marginTop: 1, width: 18, height: 18, borderRadius: 6, flexShrink: 0, border: `2px solid ${on ? "var(--primary)" : "var(--border)"}`, background: on ? "var(--primary)" : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {on && <Check className="w-3 h-3" strokeWidth={3} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>{c.label}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    <span style={{ textDecoration: "line-through" }}>{c.profileValue}</span>
                    {"  →  "}
                    <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{c.surveyValue}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onDismiss} disabled={syncing} style={{ height: 40, padding: "0 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: syncing ? "not-allowed" : "pointer", color: "var(--muted-foreground)" }}>
            Not now
          </button>
          <button type="button" onClick={() => onApply(selectedKeys)} disabled={syncing || selectedKeys.length === 0} style={{ height: 40, padding: "0 20px", background: "var(--primary)", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: syncing || selectedKeys.length === 0 ? "not-allowed" : "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6, opacity: syncing || selectedKeys.length === 0 ? 0.6 : 1 }}>
            {syncing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…</> : "Update profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Save dialog ─────────────────────────────────────────────────── */
function SaveDialog({
  saveName, setSaveName, isSaving, onCancel, onSave, title = "Save plan", subtitle,
}: {
  saveName: string;
  setSaveName: (v: string) => void;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onCancel}>
      <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: "var(--card)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>{title}</div>
        <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>{subtitle ?? "Give this plan a name so you can reopen and keep coaching."}</p>
        <input
          autoFocus
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
          placeholder="e.g. Path to Senior Engineer"
          className="w-full outline-none mb-4"
          style={{ height: 44, padding: "0 14px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, color: "var(--foreground)", fontFamily: "inherit" }}
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} style={{ height: 40, padding: "0 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "var(--muted-foreground)" }}>
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={isSaving} style={{ height: 40, padding: "0 20px", background: "var(--primary)", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: isSaving ? "not-allowed" : "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6, opacity: isSaving ? 0.7 : 1 }}>
            {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Bookmark className="w-3.5 h-3.5" /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}
