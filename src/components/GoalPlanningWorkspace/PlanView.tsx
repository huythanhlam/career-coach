import React from "react";
import {
  Loader2,
  Sparkles,
  Bookmark,
  Target,
  ArrowLeft,
  Send,
  User as UserIcon,
  Check,
  Pencil,
  SlidersHorizontal,
  Copy,
  ChevronDown,
  ListChecks,
  CheckCircle2,
  Circle,
  MessageCircleHeart,
} from "lucide-react";
import Markdown from "react-markdown";
import { workflowsConfig } from "@/config/workflows";
import type { SavedCareerPlan, PlanMilestone } from "@/types/userProfile";
import type { GoalPlanIntakeData } from "@/components/GoalPlanIntakeForm";

type ChatMsg = { role: "user" | "model"; text: string };

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 24,
  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
};

interface PlanViewProps {
  planMarkdown: string;
  messages: ChatMsg[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: (e?: React.FormEvent, override?: string) => void;
  isGenerating: boolean;
  editingSheet: boolean;
  draftMarkdown: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onApplyEdit: () => void;
  onCancelEdit: () => void;
  onBack: () => void;
  onSave: () => void;
  onSaveAsCopy: () => void;
  currentIntake: GoalPlanIntakeData | null;
  onViewResponses: () => void;
  goalSummary: string;
  goalType: string;
  editingPlanId: string | null;
  savedPlans: SavedCareerPlan[];
  scrollRef: React.RefObject<HTMLDivElement>;
  switcherOpen: boolean;
  onSwitcherToggle: () => void;
  onSwitcherClose: () => void;
  onOpenPlan: (plan: SavedCareerPlan) => void;
  milestones: PlanMilestone[];
  extractingMilestones: boolean;
  onToggleMilestone: (id: string) => void;
  onExtractMilestones: () => void;
  onCheckIn: () => void;
}

export const PlanView = React.memo(function PlanView({
  planMarkdown,
  messages,
  input,
  onInputChange,
  onSend,
  isGenerating,
  editingSheet,
  draftMarkdown,
  onDraftChange,
  onStartEdit,
  onApplyEdit,
  onCancelEdit,
  onBack,
  onSave,
  onSaveAsCopy,
  currentIntake,
  onViewResponses,
  goalSummary,
  goalType,
  editingPlanId,
  savedPlans,
  scrollRef,
  switcherOpen,
  onSwitcherToggle,
  onSwitcherClose,
  onOpenPlan,
  milestones,
  extractingMilestones,
  onToggleMilestone,
  onExtractMilestones,
  onCheckIn,
}: PlanViewProps) {
  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 10,
            height: 36,
            padding: "0 12px",
            cursor: "pointer",
            color: "var(--foreground)",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="font-display"
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--foreground)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {goalSummary || "Your Development Plan"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {goalType}
            {editingPlanId ? " · Saved plan" : ""}
          </div>
        </div>
        {savedPlans.length > 1 && (
          <div style={{ position: "relative" }}>
            <button
              onClick={onSwitcherToggle}
              disabled={isGenerating}
              aria-haspopup="listbox"
              aria-expanded={switcherOpen}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                height: 36,
                padding: "0 12px",
                cursor: isGenerating ? "not-allowed" : "pointer",
                color: "var(--foreground)",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                opacity: isGenerating ? 0.6 : 1,
              }}
            >
              <Bookmark className="w-3.5 h-3.5" /> Switch plan{" "}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {switcherOpen && (
              <>
                <div
                  onClick={onSwitcherClose}
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                />
                <div
                  role="listbox"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    zIndex: 50,
                    width: 300,
                    maxHeight: 340,
                    overflow: "auto",
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
                    padding: 6,
                  }}
                >
                  {savedPlans
                    .slice()
                    .sort(
                      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                    )
                    .map((p) => {
                      const isCurrent = p.id === editingPlanId;
                      return (
                        <button
                          key={p.id}
                          role="option"
                          aria-selected={isCurrent}
                          onClick={() => {
                            onSwitcherClose();
                            if (!isCurrent) onOpenPlan(p);
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "9px 10px",
                            borderRadius: 8,
                            border: "none",
                            background: isCurrent
                              ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                              : "transparent",
                            cursor: isCurrent ? "default" : "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          <Target
                            className="w-4 h-4 shrink-0"
                            style={{ color: "var(--primary)" }}
                          />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                display: "block",
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--foreground)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {p.name}
                            </span>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                color: "var(--muted-foreground)",
                              }}
                            >
                              {p.goalType} ·{" "}
                              {new Date(p.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </span>
                          {isCurrent && (
                            <Check
                              className="w-3.5 h-3.5 shrink-0"
                              style={{ color: "var(--primary)" }}
                            />
                          )}
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
            onClick={onViewResponses}
            disabled={isGenerating}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              height: 36,
              padding: "0 14px",
              cursor: isGenerating ? "not-allowed" : "pointer",
              color: "var(--foreground)",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              opacity: isGenerating ? 0.6 : 1,
            }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Edit responses
          </button>
        )}
        {editingPlanId && (
          <button
            onClick={onSaveAsCopy}
            disabled={isGenerating || !planMarkdown.trim()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              height: 36,
              padding: "0 14px",
              cursor: isGenerating || !planMarkdown.trim() ? "not-allowed" : "pointer",
              color: "var(--foreground)",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              opacity: isGenerating || !planMarkdown.trim() ? 0.6 : 1,
            }}
          >
            <Copy className="w-3.5 h-3.5" /> Save as copy
          </button>
        )}
        <button
          onClick={onSave}
          disabled={isGenerating || !planMarkdown.trim()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--primary)",
            border: "none",
            borderRadius: 10,
            height: 36,
            padding: "0 16px",
            cursor: isGenerating || !planMarkdown.trim() ? "not-allowed" : "pointer",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            opacity: isGenerating || !planMarkdown.trim() ? 0.6 : 1,
          }}
        >
          <Bookmark className="w-3.5 h-3.5" /> {editingPlanId ? "Save changes" : "Save plan"}
        </button>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Plan pane */}
        <div className="flex-1 min-h-0 overflow-auto no-scrollbar p-4 sm:p-7">
          {/* Milestones — the plan as a living checklist */}
          {planMarkdown.trim() && !isGenerating && (
            <div style={{ maxWidth: 720, margin: "0 auto 20px", ...cardStyle, overflow: "hidden" }}>
              <div
                style={{
                  padding: "16px 22px",
                  borderBottom: milestones.length > 0 ? "1px solid var(--border)" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <ListChecks className="w-4 h-4" style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                  Milestones
                </span>
                {milestones.length > 0 ? (
                  <>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                      {milestones.filter((m) => m.done).length} of {milestones.length} done
                    </span>
                    <div
                      style={{
                        flex: "1 1 80px",
                        minWidth: 60,
                        height: 6,
                        background: "var(--muted)",
                        borderRadius: 9999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100)}%`,
                          height: "100%",
                          background: "var(--forest)",
                          borderRadius: 9999,
                          transition: "width 300ms ease",
                        }}
                      />
                    </div>
                    <button
                      onClick={onCheckIn}
                      disabled={isGenerating}
                      title="Tell the coach where things stand and get the plan adjusted"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "var(--primary)",
                        border: "none",
                        borderRadius: 8,
                        height: 32,
                        padding: "0 12px",
                        cursor: isGenerating ? "not-allowed" : "pointer",
                        color: "#fff",
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 600,
                        opacity: isGenerating ? 0.6 : 1,
                      }}
                    >
                      <MessageCircleHeart className="w-3.5 h-3.5" /> Check in
                    </button>
                  </>
                ) : (
                  <button
                    onClick={onExtractMilestones}
                    disabled={extractingMilestones}
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      height: 32,
                      padding: "0 12px",
                      cursor: extractingMilestones ? "not-allowed" : "pointer",
                      color: "var(--foreground)",
                      fontFamily: "inherit",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {extractingMilestones ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Building…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" /> Turn the plan into a checklist
                      </>
                    )}
                  </button>
                )}
              </div>
              {milestones.length > 0 && (
                <div style={{ padding: "8px 12px" }}>
                  {milestones.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onToggleMilestone(m.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "9px 10px",
                        borderRadius: 10,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                      }}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      {m.done ? (
                        <CheckCircle2
                          className="w-[18px] h-[18px] shrink-0"
                          style={{ color: "var(--forest)", marginTop: 1 }}
                        />
                      ) : (
                        <Circle
                          className="w-[18px] h-[18px] shrink-0"
                          style={{ color: "var(--muted-foreground)", opacity: 0.5, marginTop: 1 }}
                        />
                      )}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 13,
                            fontWeight: 500,
                            color: m.done ? "var(--muted-foreground)" : "var(--foreground)",
                            textDecoration: m.done ? "line-through" : "none",
                            lineHeight: 1.45,
                          }}
                        >
                          {m.title}
                        </span>
                        {m.timeframe && (
                          <span
                            style={{
                              display: "block",
                              fontSize: 11,
                              color: "var(--muted-foreground)",
                              marginTop: 1,
                            }}
                          >
                            {m.timeframe}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                  {!editingPlanId && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        padding: "6px 10px 4px",
                      }}
                    >
                      Save the plan to keep tracking these between visits.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ maxWidth: 720, margin: "0 auto", ...cardStyle, overflow: "hidden" }}>
            <div
              style={{
                padding: "16px 22px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {isGenerating && !planMarkdown.trim() ? (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
              ) : (
                <Target className="w-4 h-4" style={{ color: "var(--primary)" }} />
              )}
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                {isGenerating && !planMarkdown.trim()
                  ? "Building your plan…"
                  : "Career Goal Planning Sheet"}
              </span>
              {!isGenerating &&
                planMarkdown.trim() &&
                (editingSheet ? (
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button
                      onClick={onCancelEdit}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        height: 30,
                        padding: "0 12px",
                        cursor: "pointer",
                        color: "var(--muted-foreground)",
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onApplyEdit}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        background: "var(--primary)",
                        border: "none",
                        borderRadius: 8,
                        height: 30,
                        padding: "0 12px",
                        cursor: "pointer",
                        color: "#fff",
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <Check className="w-3.5 h-3.5" /> Done
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onStartEdit}
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      height: 30,
                      padding: "0 12px",
                      cursor: "pointer",
                      color: "var(--foreground)",
                      fontFamily: "inherit",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                ))}
            </div>
            <div style={{ padding: "20px 24px" }}>
              {editingSheet ? (
                <div>
                  <textarea
                    value={draftMarkdown}
                    onChange={(e) => onDraftChange(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: 420,
                      resize: "vertical",
                      background: "var(--muted)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "var(--foreground)",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      outline: "none",
                    }}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted-foreground)" }}>
                    Markdown supported. Click <strong>Done</strong> to apply, then{" "}
                    <strong>{editingPlanId ? "Save changes" : "Save plan"}</strong> to persist.
                  </div>
                </div>
              ) : planMarkdown.trim() ? (
                <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
                  <Markdown>{planMarkdown}</Markdown>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: 48,
                    color: "var(--muted-foreground)",
                  }}
                >
                  <Loader2
                    className="w-8 h-8 animate-spin mb-4"
                    style={{ color: "var(--primary)" }}
                  />
                  <p style={{ fontSize: 14 }}>Analyzing your profile and drafting a plan…</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coaching chat pane */}
        <div
          className="w-full lg:w-[400px] h-[55vh] lg:h-full border-t lg:border-t-0 lg:border-l border-border flex flex-col flex-shrink-0"
          style={{ background: "var(--card)" }}
        >
          <div
            className="flex items-center gap-3 border-b border-border"
            style={{ padding: "14px 18px", background: "var(--muted)" }}
          >
            <div
              className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center border"
              style={{
                background: "rgba(217,119,87,0.10)",
                borderColor: "rgba(217,119,87,0.25)",
                color: "var(--primary)",
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                The Coach
              </div>
              <div className="text-[10px] font-semibold" style={{ color: "var(--forest)" }}>
                ● Grounded in your profile
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto no-scrollbar" style={{ padding: 18 }}>
            <div className="space-y-4 pb-2">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 items-end ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className="w-[30px] h-[30px] rounded-xl flex items-center justify-center shrink-0 border text-xs font-semibold"
                    style={{
                      background: msg.role === "user" ? "var(--muted)" : "rgba(217,119,87,0.10)",
                      borderColor: msg.role === "user" ? "var(--border)" : "rgba(217,119,87,0.2)",
                      color: msg.role === "user" ? "var(--foreground)" : "var(--primary)",
                    }}
                  >
                    {msg.role === "user" ? (
                      <UserIcon className="w-3.5 h-3.5" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div
                    className="max-w-[80%] rounded-[18px] px-4 py-2.5 text-sm leading-relaxed"
                    style={{
                      background: msg.role === "user" ? "var(--primary)" : "var(--card)",
                      color: msg.role === "user" ? "#FFF" : "var(--foreground)",
                      border: msg.role === "user" ? "none" : "1px solid var(--border)",
                      boxShadow: msg.role === "user" ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div className="prose prose-sm max-w-none" style={{ color: "inherit" }}>
                      <Markdown>{msg.text}</Markdown>
                      {msg.role === "model" && !msg.text && (
                        <div className="flex items-center gap-1 h-4">
                          <div
                            className="w-1.5 h-1.5 rounded-full animate-bounce"
                            style={{ background: "var(--primary)" }}
                          />
                          <div
                            className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.2s]"
                            style={{ background: "var(--primary)" }}
                          />
                          <div
                            className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0.4s]"
                            style={{ background: "var(--primary)" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          </div>

          <div
            className="border-t border-border"
            style={{ padding: 12, background: "var(--muted)" }}
          >
            {messages.length < 3 && (
              <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
                {workflowsConfig.goal_planning.suggestedPrompts.slice(0, 3).map((p, i) => (
                  <button
                    key={i}
                    onClick={() => onSend(undefined, p)}
                    disabled={isGenerating}
                    className="whitespace-nowrap px-3 py-1.5 rounded-full border border-border text-[11px] font-medium transition-colors hover:border-primary/40"
                    style={{
                      background: "var(--card)",
                      color: "var(--muted-foreground)",
                      fontFamily: "inherit",
                      cursor: isGenerating ? "not-allowed" : "pointer",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={onSend}
              className="flex items-center gap-2 rounded-[14px] border border-border"
              style={{ background: "var(--card)", padding: "8px 8px 8px 14px" }}
            >
              <Sparkles
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: "var(--muted-foreground)" }}
              />
              <input
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Ask the coach to refine your plan…"
                className="flex-1 h-9 border-0 bg-transparent text-sm outline-none p-0"
                style={{ color: "var(--foreground)", fontFamily: "inherit" }}
              />
              <button
                type="submit"
                disabled={isGenerating || !input.trim()}
                className="w-9 h-9 rounded-[10px] flex-shrink-0 flex items-center justify-center"
                style={{
                  background: "var(--primary)",
                  color: "#FFF",
                  border: "none",
                  cursor: isGenerating || !input.trim() ? "not-allowed" : "pointer",
                  opacity: isGenerating || !input.trim() ? 0.6 : 1,
                }}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
});
