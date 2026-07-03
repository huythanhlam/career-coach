import React, { useMemo, useState } from "react";
import {
  Plus,
  ArrowRight,
  FileText,
  Users,
  X,
  CheckCircle2,
  Circle,
  Linkedin,
  Target,
  Compass,
  LineChart,
  Briefcase,
  Mail,
  Lock,
  Sparkles,
  Clock,
} from "lucide-react";
import { useJobPostings } from "@/hooks/useJobPostings";
import type { JobStatus } from "@/types/jobPosting";
import { useUserProfile } from "@/context/UserProfileContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useSavedAnalyses } from "@/hooks/useSavedAnalyses";
import { useInterviewSessions } from "@/hooks/useInterviewSessions";
import { computePipelineStats, STALE_AFTER_DAYS } from "@/lib/pipelineStats";
import {
  MOCK_WORKFLOW_LABELS,
  MOCK_WORKFLOW_IDS,
  type MockWorkflowId,
} from "@/types/interviewSession";
import type { ViewId } from "@/components/Sidebar";
import { toast } from "@/components/ui/toast";
import { LocationInput } from "@/components/ui/LocationInput";
import { normalizeLocation } from "@/lib/locations";

const STATUS_MAP: Record<JobStatus, { bg: string; fg: string; border: string; label: string }> = {
  suggested: {
    bg: "rgba(217,119,87,0.10)",
    fg: "#D97757",
    border: "rgba(217,119,87,0.25)",
    label: "Suggested",
  },
  saved: {
    bg: "rgba(113,113,122,0.10)",
    fg: "#71717A",
    border: "rgba(113,113,122,0.25)",
    label: "Saved",
  },
  applied: {
    bg: "rgba(59,130,246,0.10)",
    fg: "#3B82F6",
    border: "rgba(59,130,246,0.25)",
    label: "Applied",
  },
  interviewing: {
    bg: "rgba(245,158,11,0.10)",
    fg: "#F59E0B",
    border: "rgba(245,158,11,0.25)",
    label: "Interviewing",
  },
  offer: {
    bg: "rgba(16,185,129,0.10)",
    fg: "#10B981",
    border: "rgba(16,185,129,0.25)",
    label: "Offer",
  },
  accepted: {
    bg: "rgba(47,107,79,0.12)",
    fg: "#2F6B4F",
    border: "rgba(47,107,79,0.30)",
    label: "Accepted",
  },
  rejected: {
    bg: "rgba(244,63,94,0.10)",
    fg: "#F43F5E",
    border: "rgba(244,63,94,0.25)",
    label: "Rejected",
  },
  archived: {
    bg: "rgba(161,161,170,0.10)",
    fg: "#A1A1AA",
    border: "rgba(161,161,170,0.22)",
    label: "Archived",
  },
};

interface PipelineForm {
  company: string;
  role: string;
  status: JobStatus;
  location: string;
}

/** Relative "time ago" label, e.g. "3d ago". Empty string for missing/invalid dates. */
function timeAgo(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/** Score → terracotta / marigold / forest, mirroring the analyzer score bands. */
function scoreColor(score: number): string {
  if (score >= 85) return "var(--forest)";
  if (score >= 70) return "var(--marigold, #E8B948)";
  return "var(--primary)";
}

interface DashboardProps {
  onNavigate?: (view: ViewId) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { postings: allPostings, addPosting } = useJobPostings();
  // The dashboard pipeline tracks chosen postings, not weekly "suggested" ones.
  const postings = allPostings.filter((p) => p.status !== "suggested");
  const suggestedCount = allPostings.length - postings.length;
  const pipelineStats = useMemo(() => computePipelineStats(postings), [postings]);
  const { profile } = useUserProfile();
  const isMobile = useIsMobile();
  const { analyses } = useSavedAnalyses();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newApp, setNewApp] = useState<PipelineForm>({
    company: "",
    role: "",
    status: "applied",
    location: "",
  });

  const go = (view: ViewId) => onNavigate?.(view);

  const [isAddingApp, setIsAddingApp] = useState(false);
  const handleAddApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApp.company || !newApp.role || isAddingApp) return;
    setIsAddingApp(true);
    try {
      await addPosting({
        title: newApp.role,
        company: newApp.company,
        location: normalizeLocation(newApp.location) || "Remote",
        source: "manual",
        status: newApp.status,
      });
      toast(`Added ${newApp.role} at ${newApp.company} to your pipeline`, "success");
      setIsModalOpen(false);
      setNewApp({ company: "", role: "", status: "applied", location: "" });
    } catch (err) {
      console.error("Failed to add application:", err);
      toast("Couldn't add the application. Please try again.", "error");
    } finally {
      setIsAddingApp(false);
    }
  };

  /* ── Profile completion checklist ───────────────────────────────── */
  const checklist: { label: string; done: boolean; view: ViewId }[] = [
    { label: "Set your target role", done: !!profile.targetRole?.trim(), view: "profile_settings" },
    {
      label: "Add your work history",
      done: profile.workHistory.length > 0,
      view: "profile_settings",
    },
    { label: "List at least 5 skills", done: profile.skills.length >= 5, view: "profile_settings" },
    { label: "Add your education", done: profile.education.length > 0, view: "profile_settings" },
    {
      label: "Write a professional summary",
      done: !!profile.summary?.trim(),
      view: "profile_settings",
    },
    {
      label: "Upload or build a resume",
      done: !!(profile.resumeText || profile.savedResumes?.length),
      view: "resume_generation",
    },
    {
      label: "Import your LinkedIn profile",
      done: !!profile.linkedinText?.trim(),
      view: "linkedin",
    },
    { label: "Curate target job postings", done: postings.length > 0, view: "job_postings" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const completionPct = Math.round((doneCount / checklist.length) * 100);
  const remaining = checklist.length - doneCount;
  const firstTodo = checklist.find((c) => !c.done);

  /* ── Recent activity (merged, timestamp-sorted) ─────────────────── */
  type Activity = {
    id: string;
    icon: typeof Briefcase;
    title: string;
    sub: string;
    ts?: string;
    view: ViewId;
  };
  const recent = useMemo<Activity[]>(() => {
    const activity: Activity[] = [
      ...postings.map((p) => ({
        id: `job-${p.id}`,
        icon: Briefcase,
        title: `${STATUS_MAP[p.status].label} · ${p.title}`,
        sub: [p.company, p.location].filter(Boolean).join(" · "),
        ts: p.appliedAt ?? p.createdAt,
        view: "job_postings" as ViewId,
      })),
      ...analyses.map((a) => ({
        id: `an-${a.id}`,
        icon: LineChart,
        title: "Saved analysis",
        sub: a.jobInput || "Job analysis",
        ts: a.createdAt,
        view: "market" as ViewId,
      })),
      ...(profile.savedResumes ?? []).map((r) => ({
        id: `r-${r.id}`,
        icon: FileText,
        title: "Resume saved",
        sub: r.name,
        ts: r.createdAt,
        view: "resume_generation" as ViewId,
      })),
      ...(profile.savedCoverLetters ?? []).map((l) => ({
        id: `cl-${l.id}`,
        icon: Mail,
        title: "Cover letter",
        sub: [l.jobTitle, l.company].filter(Boolean).join(" · ") || l.name,
        ts: l.createdAt,
        view: "cover_letter" as ViewId,
      })),
      ...(profile.savedCareerPlans ?? []).map((p) => ({
        id: `cp-${p.id}`,
        icon: Target,
        title: "Goal plan",
        sub: p.goalSummary || p.goalType,
        ts: p.createdAt,
        view: "goal_planning" as ViewId,
      })),
    ];
    return activity
      .filter((a) => a.ts)
      .sort((a, b) => new Date(b.ts!).getTime() - new Date(a.ts!).getTime())
      .slice(0, 6);
  }, [
    postings,
    analyses,
    profile.savedResumes,
    profile.savedCoverLetters,
    profile.savedCareerPlans,
  ]);

  /* ── Career path + plan progress ────────────────────────────────── */
  const currentRole = profile.currentRole?.trim() || profile.workHistory[0]?.role || "";
  const targetRole = profile.targetRole?.trim() || "";

  // Most recent plan with a milestone checklist drives the roadmap node.
  const planProgress = useMemo(() => {
    const withMilestones = (profile.savedCareerPlans ?? []).filter((p) => p.milestones?.length);
    if (withMilestones.length === 0) return null;
    const plan = [...withMilestones].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
    const milestones = plan.milestones!;
    const done = milestones.filter((m) => m.done).length;
    const lastActivity =
      [plan.lastCheckInAt, ...milestones.map((m) => m.completedAt)]
        .filter((d): d is string => Boolean(d))
        .sort()
        .pop() ?? plan.createdAt;
    const quietDays = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000);
    return { done, total: milestones.length, next: milestones.find((m) => !m.done), quietDays };
  }, [profile.savedCareerPlans]);

  /* ── Interview practice progress ────────────────────────────────── */
  const { sessions: interviewSessions } = useInterviewSessions();
  const scoredSessions = useMemo(
    () => interviewSessions.filter((s) => s.overallScore != null),
    [interviewSessions],
  );

  /* ── Suggested next actions ─────────────────────────────────────── */
  const actions: { icon: typeof Compass; label: string; note: string; view: ViewId }[] = [
    { icon: Target, label: "Goal Planner", note: "Map your next move", view: "goal_planning" },
    {
      icon: FileText,
      label: "Resume Builder",
      note: "Tailor your resume to a job",
      view: "resume_generation",
    },
    { icon: LineChart, label: "Market Data", note: "Check your pay range", view: "market" },
    {
      icon: Users,
      label: "Behavioral Sim",
      note: "Practice interview answers",
      view: "mock_behavioral",
    },
  ];

  /* ── Greeting ───────────────────────────────────────────────────── */
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = profile.preferredName || profile.fullName.split(" ")[0] || "there";
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="flex-1 h-full overflow-y-auto no-scrollbar"
      style={{
        background: "var(--background)",
        padding: isMobile ? "20px 16px 72px" : "32px 40px 80px",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 20 : 28,
        }}
        className="animate-in fade-in slide-in-from-bottom-4 duration-700"
      >
        {/* ── Hero grid ──────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr",
            gap: isMobile ? 16 : 20,
          }}
        >
          {/* Welcome card — dark ink */}
          <div
            style={{
              background: "var(--foreground)",
              color: "var(--background)",
              border: "1px solid var(--foreground)",
              borderRadius: 24,
              padding: isMobile ? 22 : 32,
              boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="eyebrow" style={{ color: "rgba(251,247,241,0.55)", marginBottom: 14 }}>
              Good {partOfDay} · {todayLabel}
            </div>
            <div
              className="font-display"
              style={{
                fontSize: isMobile ? 26 : 36,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
                color: "var(--background)",
              }}
            >
              Hey {firstName} 👋 Welcome back to your career coach.
            </div>
            <p
              style={{
                fontSize: 14,
                color: "rgba(251,247,241,0.65)",
                marginTop: 14,
                lineHeight: 1.6,
                maxWidth: 520,
              }}
            >
              {completionPct < 100
                ? `Your profile is ${completionPct}% complete — ${remaining} ${remaining === 1 ? "step" : "steps"} left to unlock sharper, more personalized coaching.`
                : `Your profile is in great shape. Keep your pipeline moving and your scores fresh.`}
            </p>

            {/* Completion bar */}
            <div style={{ marginTop: 18, maxWidth: 520 }}>
              <div
                style={{
                  height: 8,
                  background: "rgba(251,247,241,0.14)",
                  borderRadius: 9999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${completionPct}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, var(--primary), var(--marigold, #E8B948))",
                    borderRadius: 9999,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(251,247,241,0.5)",
                  marginTop: 8,
                  letterSpacing: "0.04em",
                }}
              >
                {doneCount} of {checklist.length} profile steps complete
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: "auto", paddingTop: 22 }}>
              <button
                onClick={() => go(firstTodo ? firstTodo.view : "job_postings")}
                style={{
                  height: 44,
                  padding: "0 18px",
                  background: "var(--primary)",
                  color: "#FFF",
                  border: "1px solid var(--primary)",
                  borderRadius: 14,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 4px 14px rgba(217,119,87,0.3)",
                }}
              >
                {firstTodo ? "Complete your profile" : "Browse job matches"}{" "}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => go("goal_planning")}
                style={{
                  height: 44,
                  padding: "0 18px",
                  background: "transparent",
                  border: "1px solid rgba(251,247,241,0.22)",
                  color: "var(--background)",
                  borderRadius: 14,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Plan my next move
              </button>
            </div>
          </div>

          {/* Score column — Resume + LinkedIn */}
          <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 16 }}>
            <ScoreCard
              label="Resume"
              icon={FileText}
              accent="var(--primary)"
              score={profile.resumeScore}
              updatedAt={profile.resumeScoreAt}
              emptyHint="Run the Resume Analyzer to get your score"
              ctaLabel="Analyze my resume"
              onRun={() => go("resume_generation")}
            />
            <ScoreCard
              label="LinkedIn"
              icon={Linkedin}
              accent="#0A66C2"
              score={profile.linkedinScore}
              updatedAt={profile.linkedinScoreAt}
              emptyHint="Run LinkedIn Optimization to get your score"
              ctaLabel="Optimize my profile"
              onRun={() => go("linkedin")}
            />
          </div>
        </div>

        {/* ── This week's job matches ────────────────────────────── */}
        {suggestedCount > 0 && (
          <button
            onClick={() => go("job_postings")}
            className="group hover:border-primary/40 transition-colors"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              textAlign: "left",
              fontFamily: "inherit",
              background: "rgba(217,119,87,0.06)",
              border: "1px solid rgba(217,119,87,0.30)",
              borderRadius: 24,
              padding: "18px 24px",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "rgba(217,119,87,0.12)",
                border: "1px solid rgba(217,119,87,0.25)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="font-display"
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: "var(--foreground)",
                  letterSpacing: "-0.01em",
                }}
              >
                {suggestedCount} new job {suggestedCount === 1 ? "match" : "matches"} this week
              </div>
              <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
                Fresh postings matched to your target roles — refreshed every Monday.
              </div>
            </div>
            <div
              style={{
                color: "var(--primary)",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
              }}
            >
              Review matches <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        )}

        {/* ── Follow-up nudge ────────────────────────────────────── */}
        {pipelineStats.staleApplications.length > 0 && (
          <button
            onClick={() => go("job_postings")}
            className="group transition-colors"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              textAlign: "left",
              fontFamily: "inherit",
              background: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.30)",
              borderRadius: 24,
              padding: "18px 24px",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.25)",
                color: "#B45309",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Clock className="w-5 h-5" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="font-display"
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: "var(--foreground)",
                  letterSpacing: "-0.01em",
                }}
              >
                {pipelineStats.staleApplications.length} application
                {pipelineStats.staleApplications.length === 1 ? "" : "s"} could use a follow-up
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                No movement in over {STALE_AFTER_DAYS} days:{" "}
                {pipelineStats.staleApplications
                  .slice(0, 3)
                  .map((p) => p.company ?? p.title)
                  .join(", ")}
                {pipelineStats.staleApplications.length > 3 ? "…" : ""} — we'll draft the email for
                you.
              </div>
            </div>
            <div
              style={{
                color: "#B45309",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
              }}
            >
              Follow up <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        )}

        {/* ── Career path ────────────────────────────────────────── */}
        <CareerPath
          currentRole={currentRole}
          targetRole={targetRole}
          yoe={profile.yearsOfExperience}
          planProgress={planProgress}
          onBuildPlan={() => go("goal_planning")}
          onSetTarget={() => go("profile_settings")}
        />

        {/* ── Interview practice progress ────────────────────────── */}
        {scoredSessions.length > 0 && (
          <InterviewProgress sessions={scoredSessions} onPractice={(w) => go(w)} />
        )}

        {/* ── Checklist + Recent activity ────────────────────────── */}
        <div
          style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}
        >
          {/* Profile checklist */}
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <h3
                className="font-display"
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: "-0.015em",
                  color: "var(--foreground)",
                  margin: 0,
                }}
              >
                Complete your profile
              </h3>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>
                {completionPct}%
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 14px" }}>
              The more we know, the better your coaching gets.
            </p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {checklist.map((item, i) => (
                <button
                  key={item.label}
                  onClick={() => go(item.view)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 4px",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    borderBottom: i < checklist.length - 1 ? "1px solid var(--border)" : "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                  className="group"
                >
                  {item.done ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--forest)" }} />
                  ) : (
                    <Circle
                      className="w-5 h-5 shrink-0"
                      style={{ color: "var(--muted-foreground)", opacity: 0.5 }}
                    />
                  )}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: 500,
                      color: item.done ? "var(--muted-foreground)" : "var(--foreground)",
                      textDecoration: item.done ? "line-through" : "none",
                    }}
                  >
                    {item.label}
                  </span>
                  {!item.done && (
                    <ArrowRight
                      className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--primary)" }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
            }}
          >
            <h3
              className="font-display"
              style={{
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-0.015em",
                color: "var(--foreground)",
                margin: "0 0 14px",
              }}
            >
              Recent activity
            </h3>
            {recent.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: "32px 16px",
                  color: "var(--muted-foreground)",
                }}
              >
                <Compass className="w-8 h-8 mb-3" style={{ opacity: 0.4 }} />
                <div style={{ fontSize: 13 }}>
                  No activity yet. Run an analysis or add an application to get started.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {recent.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      onClick={() => go(a.view)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 4px",
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 11,
                          background: "rgba(217,119,87,0.10)",
                          border: "1px solid rgba(217,119,87,0.20)",
                          color: "var(--primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--foreground)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.title}
                        </div>
                        {a.sub && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--muted-foreground)",
                              marginTop: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {a.sub}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--muted-foreground)",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {timeAgo(a.ts)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Pipeline ───────────────────────────────────────────── */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <h3
              className="font-display"
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.015em",
                color: "var(--foreground)",
                margin: 0,
              }}
            >
              Your pipeline
            </h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => go("job_postings")}
                style={{
                  height: 36,
                  padding: "0 14px",
                  background: "var(--card)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                Find jobs <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                style={{
                  height: 36,
                  padding: "0 14px",
                  background: "var(--card)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add application
              </button>
            </div>
          </div>

          {/* Funnel stats — how the search is converting, derived locally */}
          {pipelineStats.applied > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
                  gap: 12,
                }}
              >
                <FunnelStat
                  label="Applications"
                  value={`${pipelineStats.applied}`}
                  hint={`${pipelineStats.responses} got a response`}
                />
                <FunnelStat
                  label="Response rate"
                  value={
                    pipelineStats.responseRate != null
                      ? `${Math.round(pipelineStats.responseRate * 100)}%`
                      : "—"
                  }
                  hint="interviews + rejections"
                />
                <FunnelStat
                  label="Interview rate"
                  value={
                    pipelineStats.interviewRate != null
                      ? `${Math.round(pipelineStats.interviewRate * 100)}%`
                      : "—"
                  }
                  hint={`${pipelineStats.interviews} reached interviews`}
                />
                <FunnelStat
                  label="Offers"
                  value={`${pipelineStats.offers}`}
                  hint={pipelineStats.offers > 0 ? "nice work 🎉" : "keep going"}
                />
              </div>
              {pipelineStats.tailoredEdge &&
                pipelineStats.tailoredEdge.tailoredRate >
                  pipelineStats.tailoredEdge.untailoredRate && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      marginTop: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Sparkles
                      className="w-3.5 h-3.5"
                      style={{ color: "var(--primary)", flexShrink: 0 }}
                    />
                    Applications with a tailored resume hear back{" "}
                    {Math.round(pipelineStats.tailoredEdge.tailoredRate * 100)}% of the time, vs{" "}
                    {Math.round(pipelineStats.tailoredEdge.untailoredRate * 100)}% without —
                    tailoring is working for you.
                  </div>
                )}
            </div>
          )}

          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 24,
              boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "36px 1fr auto" : "44px 1.6fr 1fr 1fr 148px",
                gap: isMobile ? 12 : 16,
                padding: isMobile ? "12px 16px" : "12px 22px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {(isMobile
                ? ["", "Company · Role", "Status"]
                : ["", "Company · Role", "Location", "Applied", "Status"]
              ).map((h, i) => (
                <div key={i} className="eyebrow">
                  {h}
                </div>
              ))}
            </div>

            {postings.length === 0 ? (
              <div
                style={{
                  padding: "40px 22px",
                  textAlign: "center",
                  color: "var(--muted-foreground)",
                }}
              >
                <div style={{ fontSize: 14, marginBottom: 12 }}>No postings tracked yet.</div>
                <button
                  onClick={() => go("job_postings")}
                  style={{
                    height: 38,
                    padding: "0 16px",
                    background: "var(--primary)",
                    color: "#FFF",
                    border: "none",
                    borderRadius: 12,
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Curate job postings
                </button>
              </div>
            ) : (
              postings.slice(0, 6).map((p, i, shown) => (
                <div
                  key={p.id}
                  onClick={() => go("job_postings")}
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "36px 1fr auto" : "44px 1.6fr 1fr 1fr 148px",
                    gap: isMobile ? 12 : 16,
                    padding: isMobile ? "14px 16px" : "16px 22px",
                    alignItems: "center",
                    cursor: "pointer",
                    borderBottom: i < shown.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      background: "var(--muted)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--primary)",
                      fontFamily: "'Fraunces',Georgia,serif",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {(p.company ?? p.title).slice(0, 2)}
                  </div>

                  {/* Role + company */}
                  <div style={{ minWidth: 0 }}>
                    <div
                      className="font-display"
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "var(--foreground)",
                        letterSpacing: "-0.01em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                      {p.company ?? "—"}
                    </div>
                  </div>

                  {!isMobile && (
                    <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                      {p.location ?? "—"}
                    </div>
                  )}
                  {!isMobile && (
                    <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                      {new Date(p.appliedAt ?? p.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                  <div>
                    <StatusPill kind={p.status}>{STATUS_MAP[p.status].label}</StatusPill>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Suggested next actions ─────────────────────────────── */}
        <div>
          <h3
            className="font-display"
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "var(--foreground)",
              margin: "0 0 14px",
            }}
          >
            Things you can do
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
              gap: 16,
            }}
          >
            {actions.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.label}
                  onClick={() => go(tool.view)}
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 24,
                    padding: 22,
                    boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                  className="group hover:border-primary/30 transition-colors duration-200"
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: "rgba(217,119,87,0.10)",
                      border: "1px solid rgba(217,119,87,0.25)",
                      color: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 14,
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div
                    className="font-display"
                    style={{
                      fontSize: 17,
                      fontWeight: 600,
                      color: "var(--foreground)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {tool.label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>
                    {tool.note}
                  </div>
                  <div
                    style={{
                      marginTop: 14,
                      color: "var(--primary)",
                      fontSize: 12,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    Open <ArrowRight className="w-3 h-3" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Add application modal ──────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: "rgba(31,27,22,0.4)", backdropFilter: "blur(8px)" }}
          onClick={() => setIsModalOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setIsModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add application"
            className="animate-in zoom-in-95 duration-200"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 28,
              boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
              width: "100%",
              maxWidth: 480,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "24px 28px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: "var(--foreground)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Add application
                </div>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
                  Track a new role in your pipeline
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label="Close dialog"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: "var(--muted)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--muted-foreground)",
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleAddApplication}
              style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}
            >
              {[
                { placeholder: "Company name", key: "company", required: true },
                { placeholder: "Role / title", key: "role", required: true },
              ].map(({ placeholder, key, required }) => (
                <input
                  key={key}
                  required={required}
                  autoFocus={key === "company"}
                  aria-label={placeholder}
                  placeholder={placeholder}
                  value={(newApp as any)[key] || ""}
                  onChange={(e) => setNewApp({ ...newApp, [key]: e.target.value })}
                  style={{
                    height: 52,
                    background: "var(--muted)",
                    border: "1px solid var(--border)",
                    borderRadius: 14,
                    padding: "0 16px",
                    fontFamily: "inherit",
                    fontSize: 14,
                    color: "var(--foreground)",
                    outline: "none",
                    width: "100%",
                  }}
                />
              ))}
              <LocationInput
                value={newApp.location || ""}
                onChange={(v) => setNewApp({ ...newApp, location: v })}
                placeholder="Location (e.g. Remote, Austin, TX)"
                style={{
                  height: 52,
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "0 16px",
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "var(--foreground)",
                  outline: "none",
                  width: "100%",
                }}
              />
              <select
                value={newApp.status || "applied"}
                onChange={(e) => setNewApp({ ...newApp, status: e.target.value as JobStatus })}
                style={{
                  height: 52,
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "0 16px",
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "var(--foreground)",
                  outline: "none",
                }}
              >
                <option value="saved">Saved</option>
                <option value="applied">Applied</option>
                <option value="interviewing">Interviewing</option>
                <option value="offer">Offer</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                type="submit"
                disabled={isAddingApp}
                style={{
                  height: 52,
                  background: "var(--primary)",
                  color: "#FFF",
                  border: "1px solid var(--primary)",
                  borderRadius: 14,
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: isAddingApp ? "default" : "pointer",
                  opacity: isAddingApp ? 0.6 : 1,
                  marginTop: 4,
                  boxShadow: "0 4px 14px rgba(217,119,87,0.25)",
                }}
              >
                {isAddingApp ? "Adding…" : "Add to pipeline"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Funnel stat (pipeline analytics) ─────────────────────────────── */
function FunnelStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 18,
        padding: "14px 18px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
      }}
    >
      <div className="eyebrow">{label}</div>
      <div
        className="font-display"
        style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--foreground)",
          marginTop: 4,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>{hint}</div>
    </div>
  );
}

/* ── Score card (Resume / LinkedIn) ───────────────────────────────── */
function ScoreCard({
  label,
  icon: Icon,
  accent,
  score,
  updatedAt,
  emptyHint,
  ctaLabel,
  onRun,
}: {
  label: string;
  icon: typeof FileText;
  accent: string;
  score?: number;
  updatedAt?: string;
  emptyHint: string;
  ctaLabel: string;
  onRun: () => void;
}) {
  const has = score != null;
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 24,
        padding: 22,
        boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accent }} /> {label} score
        </div>
        {has && updatedAt && (
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            updated {timeAgo(updatedAt)}
          </span>
        )}
      </div>

      {has ? (
        <>
          <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 2 }}>
            <div
              className="font-display"
              style={{
                fontSize: 44,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: scoreColor(score!),
                lineHeight: 1,
              }}
            >
              {score}
            </div>
            <span style={{ fontSize: 18, color: "var(--muted-foreground)", fontWeight: 600 }}>
              /100
            </span>
          </div>
          <div
            style={{
              marginTop: 14,
              height: 6,
              background: "var(--muted)",
              borderRadius: 9999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${score}%`,
                height: "100%",
                background: scoreColor(score!),
                borderRadius: 9999,
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <button
            onClick={onRun}
            style={{
              marginTop: 14,
              alignSelf: "flex-start",
              background: "transparent",
              border: "none",
              color: accent,
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: 0,
            }}
          >
            Re-run analysis <ArrowRight className="w-3 h-3" />
          </button>
        </>
      ) : (
        <div style={{ marginTop: 10, flex: 1, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--muted-foreground)",
            }}
          >
            <Lock className="w-4 h-4" style={{ opacity: 0.6 }} />
            <span
              className="font-display"
              style={{ fontSize: 22, fontWeight: 600, color: "var(--muted-foreground)" }}
            >
              —
            </span>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              margin: "8px 0 0",
              lineHeight: 1.5,
            }}
          >
            {emptyHint}
          </p>
          <button
            onClick={onRun}
            style={{
              marginTop: "auto",
              height: 38,
              background: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--foreground)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {ctaLabel} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Career path strip ────────────────────────────────────────────── */
interface PlanProgress {
  done: number;
  total: number;
  next?: { title: string };
  quietDays: number;
}

function CareerPath({
  currentRole,
  targetRole,
  yoe,
  planProgress,
  onBuildPlan,
  onSetTarget,
}: {
  currentRole: string;
  targetRole: string;
  yoe?: number;
  planProgress: PlanProgress | null;
  onBuildPlan: () => void;
  onSetTarget: () => void;
}) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 24,
        padding: 24,
        boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <h3
          className="font-display"
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            color: "var(--foreground)",
            margin: 0,
          }}
        >
          Your career path
        </h3>
        {targetRole && (
          <button
            onClick={onBuildPlan}
            style={{
              height: 34,
              padding: "0 14px",
              background: "var(--primary)",
              color: "#FFF",
              border: "none",
              borderRadius: 12,
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 4px 14px rgba(217,119,87,0.25)",
            }}
          >
            Build full plan <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!targetRole ? (
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            gap: 16,
            padding: "8px 0",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgba(217,119,87,0.10)",
              border: "1px solid rgba(217,119,87,0.25)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Target className="w-5 h-5" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
              Tell us your target role
            </div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
              Set a goal and we'll map a path from where you are today.
            </div>
          </div>
          <button
            onClick={onSetTarget}
            style={{
              height: 38,
              padding: "0 16px",
              background: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--foreground)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Set target role
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "stretch",
            gap: 12,
          }}
        >
          <PathNode
            kind="now"
            title={currentRole || "Where you are now"}
            sub={yoe != null ? `${yoe} ${yoe === 1 ? "year" : "years"} experience` : "Current role"}
          />
          <PathConnector />
          <PathNode kind="target" title={targetRole} sub="Your target role" />
          <PathConnector />
          {planProgress ? (
            <PathNode
              kind="plan"
              title={`${planProgress.done}/${planProgress.total} milestones done`}
              sub={
                planProgress.quietDays > 14
                  ? `Quiet for ${planProgress.quietDays} days — time for a check-in`
                  : planProgress.next
                    ? `Next: ${planProgress.next.title}`
                    : "All milestones complete 🎉"
              }
              progress={planProgress.total > 0 ? planProgress.done / planProgress.total : 0}
              onClick={onBuildPlan}
            />
          ) : (
            <PathNode
              kind="plan"
              title="Your roadmap"
              sub="Get AI-tailored milestones"
              onClick={onBuildPlan}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PathNode({
  kind,
  title,
  sub,
  progress,
  onClick,
}: {
  kind: "now" | "target" | "plan";
  title: string;
  sub: string;
  progress?: number;
  onClick?: () => void;
}) {
  const styles = {
    now: {
      bg: "var(--muted)",
      border: "1px solid var(--border)",
      fg: "var(--foreground)",
      dot: "var(--muted-foreground)",
    },
    target: {
      bg: "rgba(47,107,79,0.08)",
      border: "1px solid rgba(47,107,79,0.25)",
      fg: "var(--foreground)",
      dot: "var(--forest)",
    },
    plan: {
      bg: "rgba(217,119,87,0.08)",
      border: "1px dashed rgba(217,119,87,0.40)",
      fg: "var(--primary)",
      dot: "var(--primary)",
    },
  }[kind];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        background: styles.bg,
        border: styles.border,
        borderRadius: 16,
        padding: "16px 18px",
        textAlign: "left",
        fontFamily: "inherit",
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ width: 10, height: 10, borderRadius: 9999, background: styles.dot }} />
      <div
        className="font-display"
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: styles.fg,
          letterSpacing: "-0.01em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--muted-foreground)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {sub}
      </div>
      {progress != null && (
        <div
          style={{ height: 5, background: "var(--muted)", borderRadius: 9999, overflow: "hidden" }}
        >
          <div
            style={{
              width: `${Math.round(progress * 100)}%`,
              height: "100%",
              background: "var(--forest)",
              borderRadius: 9999,
            }}
          />
        </div>
      )}
    </Tag>
  );
}

/* ── Interview practice progress strip ────────────────────────────── */
function InterviewProgress({
  sessions,
  onPractice,
}: {
  sessions: ReturnType<typeof useInterviewSessions>["sessions"];
  onPractice: (workflow: MockWorkflowId) => void;
}) {
  const isMobile = useIsMobile();
  // Per-workflow latest score + delta vs the session before it.
  const byWorkflow = MOCK_WORKFLOW_IDS.map((w) => {
    const list = sessions.filter((s) => s.workflow === w); // newest first
    if (list.length === 0) return null;
    const latest = list[0].overallScore!;
    const prev = list[1]?.overallScore;
    return { workflow: w, latest, delta: prev != null ? latest - prev : null, count: list.length };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const chronological = [...sessions].reverse().slice(-14); // oldest → newest
  const barColor = (s: number) =>
    s >= 80 ? "var(--forest)" : s >= 60 ? "var(--marigold, #E8B948)" : "var(--primary)";

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 24,
        padding: 24,
        boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h3
          className="font-display"
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            color: "var(--foreground)",
            margin: 0,
          }}
        >
          Interview practice
        </h3>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          {sessions.length} scored session{sessions.length === 1 ? "" : "s"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: 20,
          alignItems: isMobile ? "stretch" : "flex-end",
        }}
      >
        {/* Score history bars (all workflows, chronological) */}
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 5, height: 64 }}>
          {chronological.map((s) => (
            <div
              key={s.id}
              title={`${MOCK_WORKFLOW_LABELS[s.workflow]} · ${s.overallScore}/100 · ${new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
              style={{
                flex: 1,
                maxWidth: 30,
                height: `${Math.max(8, s.overallScore ?? 0)}%`,
                background: barColor(s.overallScore ?? 0),
                borderRadius: 5,
              }}
            />
          ))}
        </div>

        {/* Per-track latest + delta */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: isMobile ? undefined : 240,
          }}
        >
          {byWorkflow.map(({ workflow, latest, delta, count }) => (
            <button
              key={workflow}
              onClick={() => onPractice(workflow)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--muted)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "8px 12px",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", flex: 1 }}>
                {MOCK_WORKFLOW_LABELS[workflow]}
              </span>
              <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{count}×</span>
              <span
                className="font-display"
                style={{ fontSize: 16, fontWeight: 700, color: barColor(latest) }}
              >
                {latest}
              </span>
              {delta != null && delta !== 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: delta > 0 ? "var(--forest)" : "var(--primary)",
                  }}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              )}
              <ArrowRight className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PathConnector() {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--muted-foreground)",
        flexShrink: 0,
      }}
    >
      <ArrowRight
        className="w-4 h-4"
        style={{ opacity: 0.5, transform: isMobile ? "rotate(90deg)" : "none" }}
      />
    </div>
  );
}

function StatusPill({ kind, children }: { kind: JobStatus; children: React.ReactNode }) {
  const c = STATUS_MAP[kind] || STATUS_MAP.saved;
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        padding: "5px 12px",
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}
