import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2, Sparkles, Send, User as UserIcon, ArrowLeft, Trash2,
  Flag, TrendingUp, TrendingDown, Minus, History, ChevronDown, ChevronRight,
  CheckCircle2, Lightbulb, Play,
} from "lucide-react";
import Markdown from "react-markdown";
import { useUserProfile } from "@/context/UserProfileContext";
import { useInterviewSessions } from "@/hooks/useInterviewSessions";
import { workflowsConfig } from "@/config/workflows";
import {
  createCoachingChat, sendMessageStream, evaluateInterviewTranscript,
  type InterviewEvaluation,
} from "@/services/geminiService";
import { buildProfileBaseline } from "@/lib/careerBaseline";
import {
  SCORE_DIMENSIONS, MOCK_WORKFLOW_LABELS,
  type MockWorkflowId, type InterviewSession, type ChatTurn,
} from "@/types/interviewSession";

// Mock-interview workspace shared by the three simulators. Unlike the old
// one-shot flow, the interview is a stateful conversation (the interviewer
// remembers its own questions), and every finished session is scored against
// a fixed rubric and persisted — so practice shows visible progress over time.

interface Props {
  workflowId: MockWorkflowId;
}

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 24,
  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
};

const scoreColor = (s: number) => (s >= 80 ? "var(--forest)" : s >= 60 ? "var(--marigold, #E8B948)" : "var(--primary)");

function Delta({ value }: { value: number }) {
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const color = value > 0 ? "var(--forest)" : value < 0 ? "var(--primary)" : "var(--muted-foreground)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 700, color }}>
      <Icon className="w-3.5 h-3.5" /> {value > 0 ? `+${value}` : value}
    </span>
  );
}

/* ── Setup form field (select with optional custom value) ───────────────── */
function FieldSelect({
  label, options, value, onChange, allowCustom, required,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  allowCustom?: boolean;
  required?: boolean;
}) {
  const isCustom = allowCustom && value !== "" && !options.some((o) => o.value === value);
  const [customMode, setCustomMode] = useState(false);
  const custom = customMode || isCustom;
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        {label}{required ? " *" : ""}
      </label>
      {custom ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Custom ${label.toLowerCase()}…`}
          style={{ width: "100%", height: 44, background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "0 14px", fontSize: 13, color: "var(--foreground)", fontFamily: "inherit", outline: "none" }}
        />
      ) : (
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === "__custom__") { setCustomMode(true); onChange(""); }
            else onChange(e.target.value);
          }}
          style={{ width: "100%", height: 44, background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "0 12px", fontSize: 13, color: "var(--foreground)", fontFamily: "inherit", cursor: "pointer", outline: "none" }}
        >
          <option value="">Select…</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          {allowCustom && <option value="__custom__">Other (type your own)…</option>}
        </select>
      )}
    </div>
  );
}

/* ── Score bars (used in review + history detail) ───────────────────────── */
function ScoreBars({ scores, overall }: { scores: NonNullable<InterviewSession["scores"]>; overall?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {overall != null && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span className="font-display" style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1, color: scoreColor(overall) }}>{overall}</span>
          <span style={{ fontSize: 15, color: "var(--muted-foreground)", fontWeight: 600 }}>/100 overall</span>
        </div>
      )}
      {SCORE_DIMENSIONS.map((d) => {
        const v = scores[d.key];
        return (
          <div key={d.key}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                {d.label}<span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}> · {d.hint}</span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(v) }}>{v}</span>
            </div>
            <div style={{ height: 6, borderRadius: 9999, background: "var(--muted)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${v}%`, background: scoreColor(v), borderRadius: 9999, transition: "width 300ms ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Chat bubbles (shared by live + review transcript) ──────────────────── */
function ChatBubble({ msg }: { msg: ChatTurn }) {
  return (
    <div className={`flex gap-3 items-end ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
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
  );
}

export function MockInterviewWorkspace({ workflowId }: Props) {
  const config = workflowsConfig[workflowId];
  const { profile } = useUserProfile();
  const { sessions, addSession, deleteSession } = useInterviewSessions();

  type Mode =
    | { kind: "setup" }
    | { kind: "live" }
    | { kind: "review"; session: InterviewSession; previousOverall?: number };
  const [mode, setMode] = useState<Mode>({ kind: "setup" });

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Setup fields come from the workflow config (role/focus, type/level, …),
  // skipping the JD-URL field — the interviewer can't open links anyway.
  const setupFields = config.fields.filter((f) => f.id !== "jdUrl" && f.type === "select");
  const requiredOk = setupFields.filter((f) => f.required).every((f) => (formData[f.id] ?? "").trim());

  const mySessions = useMemo(
    () => sessions.filter((s) => s.workflow === workflowId && s.overallScore != null),
    [sessions, workflowId],
  );
  const latest = mySessions[0];

  /** The "role" shown on history rows — whichever identity field this workflow uses. */
  const roleOf = (data: Record<string, string>) => data.role || data.type || "";
  const focusOf = (data: Record<string, string>) => data.focus || data.topic || data.level || "";

  const buildSystemInstruction = () => {
    const baseline = buildProfileBaseline(profile);
    const focusHint = latest?.improvements?.length
      ? `\n\nFrom their last session, the candidate's areas to improve were: ${latest.improvements.join("; ")}. Probe these areas during the interview.`
      : "";
    return (
      config.systemInstruction +
      (baseline ? `\n\n--- CANDIDATE PROFILE (tailor questions to their real background) ---\n${baseline}` : "") +
      focusHint
    );
  };

  /* ── Start a session ─────────────────────────────────────────────── */
  const handleStart = async () => {
    if (!requiredOk || isGenerating) return;
    chatRef.current = createCoachingChat(buildSystemInstruction());
    // generatePrompt is typed string | parts[], but the mock workflows always build a string.
    const generated = config.generatePrompt(formData);
    const request = typeof generated === "string" ? generated : String(generated);
    const friendly = `Start the interview — ${[roleOf(formData), focusOf(formData)].filter(Boolean).join(" · ")}.`;
    setMessages([{ role: "user", text: friendly }, { role: "model", text: "" }]);
    setMode({ kind: "live" });
    setIsGenerating(true);
    try {
      let full = "";
      await sendMessageStream(chatRef.current, request, (chunk) => {
        full += chunk;
        setMessages((prev) => [...prev.slice(0, -1), { role: "model", text: full }]);
      });
    } catch (err) {
      console.error("Interview start failed:", err);
      setMessages((prev) => [...prev.slice(0, -1), { role: "model", text: "**Error:** Could not reach the AI gateway. Is it running?" }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || isGenerating || !chatRef.current) return;
    setInput("");
    setIsGenerating(true);
    setMessages((prev) => [...prev, { role: "user", text }, { role: "model", text: "" }]);
    try {
      let full = "";
      await sendMessageStream(chatRef.current, text, (chunk) => {
        full += chunk;
        setMessages((prev) => [...prev.slice(0, -1), { role: "model", text: full }]);
      });
    } catch (err) {
      console.error("Interview reply failed:", err);
      setMessages((prev) => [...prev.slice(0, -1), { role: "model", text: "**Error:** Failed to reach the interviewer. Is the AI gateway running?" }]);
    } finally {
      setIsGenerating(false);
    }
  };

  /* ── Finish: score the transcript and persist the session ────────── */
  const answered = messages.filter((m) => m.role === "user").length > 1; // beyond the kickoff
  const handleFinish = async () => {
    if (isScoring || isGenerating) return;
    setIsScoring(true);
    try {
      let evaluation: InterviewEvaluation | undefined;
      try {
        evaluation = await evaluateInterviewTranscript(config.title, roleOf(formData), messages);
      } catch (err) {
        console.error("Scoring failed:", err);
      }
      const saved = await addSession({
        workflow: workflowId,
        role: roleOf(formData) || undefined,
        focus: focusOf(formData) || undefined,
        transcript: messages,
        scores: evaluation?.scores,
        overallScore: evaluation?.overall,
        summary: evaluation?.summary,
        strengths: evaluation?.strengths,
        improvements: evaluation?.improvements,
      });
      const session: InterviewSession = saved ?? {
        id: "unsaved",
        workflow: workflowId,
        role: roleOf(formData) || undefined,
        focus: focusOf(formData) || undefined,
        transcript: messages,
        scores: evaluation?.scores,
        overallScore: evaluation?.overall,
        summary: evaluation?.summary,
        strengths: evaluation?.strengths,
        improvements: evaluation?.improvements,
        createdAt: new Date().toISOString(),
      };
      setShowTranscript(false);
      setMode({ kind: "review", session, previousOverall: latest?.overallScore });
    } finally {
      setIsScoring(false);
    }
  };

  const reset = () => {
    chatRef.current = null;
    setMessages([]);
    setMode({ kind: "setup" });
  };

  /* ════════════════════════════ REVIEW ═════════════════════════════ */
  if (mode.kind === "review") {
    const s = mode.session;
    const delta = mode.previousOverall != null && s.overallScore != null ? s.overallScore - mode.previousOverall : null;
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
        <header style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <button onClick={reset}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--border)", borderRadius: 10, height: 36, padding: "0 12px", cursor: "pointer", color: "var(--foreground)", fontFamily: "inherit", fontSize: 13, fontWeight: 500 }}>
            <ArrowLeft className="w-4 h-4" /> Done
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)" }}>Session feedback</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {config.title}{s.role ? ` · ${s.role}` : ""}
            </div>
          </div>
          <button onClick={reset}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--primary)", border: "none", borderRadius: 10, height: 36, padding: "0 16px", cursor: "pointer", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
            <Play className="w-3.5 h-3.5" /> Practice again
          </button>
        </header>

        <div className="flex-1 overflow-auto no-scrollbar p-8">
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
            {s.scores ? (
              <div style={{ ...cardStyle, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Flag className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Your scores</span>
                  {delta != null && <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 6 }}>vs last session <Delta value={delta} /></span>}
                </div>
                <ScoreBars scores={s.scores} overall={s.overallScore} />
                {s.summary && <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6, marginTop: 16, marginBottom: 0 }}>{s.summary}</p>}
              </div>
            ) : (
              <div style={{ ...cardStyle, padding: 24, fontSize: 13, color: "var(--muted-foreground)" }}>
                Scoring didn't complete for this session — the transcript was still saved to your history.
              </div>
            )}

            {(s.strengths?.length || s.improvements?.length) ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {s.strengths?.length ? (
                  <div style={{ ...cardStyle, padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                      <CheckCircle2 className="w-4 h-4" style={{ color: "var(--forest)" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>What worked</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                      {s.strengths.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </div>
                ) : null}
                {s.improvements?.length ? (
                  <div style={{ ...cardStyle, padding: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                      <Lightbulb className="w-4 h-4" style={{ color: "var(--marigold, #E8B948)" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>Practice next</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.7 }}>
                      {s.improvements.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <button onClick={() => setShowTranscript((t) => !t)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                {showTranscript ? <ChevronDown className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /> : <ChevronRight className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />}
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Transcript</span>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{s.transcript.length} turns</span>
              </button>
              {showTranscript && (
                <div style={{ padding: "4px 20px 20px", display: "flex", flexDirection: "column", gap: 14, maxHeight: 480, overflow: "auto" }}>
                  {s.transcript.map((m, i) => <ChatBubble key={i} msg={m} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═════════════════════════════ LIVE ══════════════════════════════ */
  if (mode.kind === "live") {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
        <header style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <button onClick={reset} disabled={isScoring}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--border)", borderRadius: 10, height: 36, padding: "0 12px", cursor: isScoring ? "not-allowed" : "pointer", color: "var(--foreground)", fontFamily: "inherit", fontSize: 13, fontWeight: 500 }}>
            <ArrowLeft className="w-4 h-4" /> Exit
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {config.title}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {[roleOf(formData), focusOf(formData)].filter(Boolean).join(" · ") || "Live session"}
            </div>
          </div>
          <button
            onClick={handleFinish}
            disabled={isScoring || isGenerating || !answered}
            title={answered ? "Get scored feedback and save this session" : "Answer at least one question first"}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--primary)", border: "none", borderRadius: 10, height: 36, padding: "0 16px", cursor: isScoring || isGenerating || !answered ? "not-allowed" : "pointer", color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 600, opacity: isScoring || isGenerating || !answered ? 0.6 : 1 }}
          >
            {isScoring ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scoring…</> : <><Flag className="w-3.5 h-3.5" /> End & get feedback</>}
          </button>
        </header>

        <div className="flex-1 overflow-auto no-scrollbar" style={{ padding: "24px 0" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }} className="space-y-4">
            {messages.map((msg, idx) => <ChatBubble key={idx} msg={msg} />)}
            <div ref={scrollRef} />
          </div>
        </div>

        <div className="border-t border-border" style={{ padding: 12, background: "var(--muted)", flexShrink: 0 }}>
          <form onSubmit={handleSend} className="flex items-end gap-2 rounded-[14px] border border-border" style={{ background: "var(--card)", padding: 8, maxWidth: 760, margin: "0 auto" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Type your answer… (Shift+Enter for a new line)"
              rows={Math.min(6, Math.max(1, input.split("\n").length))}
              className="flex-1 border-0 bg-transparent text-sm outline-none resize-none"
              style={{ color: "var(--foreground)", fontFamily: "inherit", padding: "8px 6px", lineHeight: 1.5 }}
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
    );
  }

  /* ════════════════════════════ SETUP ══════════════════════════════ */
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ background: "var(--background)" }}>
      <header style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <h2 className="font-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--foreground)", margin: "0 0 4px" }}>
          {config.title}
        </h2>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{config.description}</p>
      </header>

      <div className="flex-1 overflow-auto no-scrollbar p-8">
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Progress strip — visible improvement is the point of practicing */}
          {mySessions.length > 0 && latest?.scores && (
            <div style={{ ...cardStyle, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Your progress</span>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{mySessions.length} scored session{mySessions.length === 1 ? "" : "s"}</span>
                {mySessions.length >= 2 && mySessions[0].overallScore != null && mySessions[1].overallScore != null && (
                  <span style={{ marginLeft: "auto" }}><Delta value={mySessions[0].overallScore - mySessions[1].overallScore} /></span>
                )}
              </div>
              {/* Last sessions, oldest → newest, as a mini bar chart */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 72 }}>
                {[...mySessions].reverse().slice(-12).map((s) => (
                  <div key={s.id} title={`${s.overallScore}/100 · ${new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    style={{ flex: 1, maxWidth: 36, height: `${Math.max(8, s.overallScore ?? 0)}%`, background: scoreColor(s.overallScore ?? 0), borderRadius: 6, opacity: s.id === latest.id ? 1 : 0.55 }} />
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 10 }}>
                Latest: <strong style={{ color: scoreColor(latest.overallScore ?? 0) }}>{latest.overallScore}/100</strong>
                {latest.improvements?.length ? <> · next session will probe: {latest.improvements[0]}</> : null}
              </div>
            </div>
          )}

          {/* Setup */}
          <div style={{ ...cardStyle, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Set up your session</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: setupFields.length > 1 ? "1fr 1fr" : "1fr", gap: 14 }}>
              {setupFields.map((f) => (
                <FieldSelect
                  key={f.id}
                  label={f.label.replace(" (Optional)", "")}
                  options={(f.options ?? []) as { label: string; value: string }[]}
                  value={formData[f.id] ?? ""}
                  onChange={(v) => setFormData((prev) => ({ ...prev, [f.id]: v }))}
                  allowCustom={f.allowCustom}
                  required={f.required}
                />
              ))}
            </div>
            <button
              onClick={handleStart}
              disabled={!requiredOk || isGenerating}
              style={{ marginTop: 18, width: "100%", height: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--primary)", border: "none", borderRadius: 12, cursor: !requiredOk || isGenerating ? "not-allowed" : "pointer", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 600, opacity: !requiredOk || isGenerating ? 0.5 : 1 }}
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Start interview
            </button>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "10px 0 0", lineHeight: 1.5 }}>
              One question at a time, with feedback after each answer. End whenever you like — you'll get rubric scores and the session is saved to your history.
            </p>
          </div>

          {/* History */}
          {mySessions.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <History className="w-3.5 h-3.5" /> Past sessions <span style={{ fontWeight: 600, letterSpacing: 0, textTransform: "none" }}>({mySessions.length})</span>
              </div>
              <div className="flex flex-col gap-3">
                {mySessions.map((s, i) => {
                  const prev = mySessions[i + 1];
                  const delta = prev?.overallScore != null && s.overallScore != null ? s.overallScore - prev.overallScore : null;
                  const open = openHistoryId === s.id;
                  return (
                    <div key={s.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px" }}>
                        <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: scoreColor(s.overallScore ?? 0), width: 44, flexShrink: 0 }}>
                          {s.overallScore}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {[s.role, s.focus].filter(Boolean).join(" · ") || MOCK_WORKFLOW_LABELS[s.workflow]}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                            {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            {delta != null && <Delta value={delta} />}
                          </div>
                        </div>
                        <button onClick={() => setOpenHistoryId(open ? null : s.id)}
                          style={{ height: 34, padding: "0 14px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--foreground)", cursor: "pointer" }}>
                          {open ? "Hide" : "Review"}
                        </button>
                        <button onClick={() => deleteSession(s.id)} title="Delete session"
                          style={{ height: 34, width: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", color: "var(--muted-foreground)" }}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {open && (
                        <div style={{ borderTop: "1px solid var(--border)", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                          {s.scores && <ScoreBars scores={s.scores} />}
                          {s.summary && <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6, margin: 0 }}>{s.summary}</p>}
                          {s.improvements?.length ? (
                            <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                              <strong style={{ color: "var(--foreground)" }}>Practice next:</strong> {s.improvements.join("; ")}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
