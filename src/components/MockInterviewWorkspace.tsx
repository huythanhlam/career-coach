import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Sparkles,
  Send,
  User as UserIcon,
  ArrowLeft,
  Trash2,
  Flag,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Lightbulb,
  Play,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Clock,
  AlertTriangle,
  RotateCcw,
  Bot,
  MessageSquare,
  PhoneOff,
  Captions,
  X,
  Radio,
  Check,
} from "lucide-react";
import Markdown from "react-markdown";
import { useUserProfile } from "@/context/UserProfileContext";
import { useInterviewSessions } from "@/hooks/useInterviewSessions";
import { useSpeech } from "@/hooks/useSpeech";
import { useDictation } from "@/hooks/useDictation";
import { workflowsConfig } from "@/config/workflows";
import { evaluateInterviewTranscript, type InterviewEvaluation } from "@/services/geminiService";
import { createCoachingSession, type CoachingSession } from "@/ai/coachingSession";
import { buildProfileBaseline } from "@/lib/careerBaseline";
import { deriveChatStatus } from "@/lib/chatStatus";
import { stripMarkdown } from "@/lib/speechText";
import {
  KOKORO_VOICES,
  DEFAULT_KOKORO_VOICE,
  preloadKokoro,
  kokoroGenerate,
  isKokoroVoice,
  type KokoroVoice,
} from "@/services/kokoroTts";
import { QUESTION_BANK } from "@/config/interviewQuestions";
import {
  SCORE_DIMENSIONS,
  MOCK_WORKFLOW_LABELS,
  STAR_ELEMENTS,
  type MockWorkflowId,
  type InterviewSession,
  type ChatTurn,
  type QuestionFeedback,
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

const scoreColor = (s: number) =>
  s >= 80 ? "var(--forest)" : s >= 60 ? "var(--marigold, #E8B948)" : "var(--primary)";

function Delta({ value }: { value: number }) {
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const color =
    value > 0 ? "var(--forest)" : value < 0 ? "var(--primary)" : "var(--muted-foreground)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 12,
        fontWeight: 700,
        color,
      }}
    >
      <Icon className="w-3.5 h-3.5" /> {value > 0 ? `+${value}` : value}
    </span>
  );
}

/* ── Setup form field (select with optional custom value) ───────────────── */
function FieldSelect({
  label,
  options,
  value,
  onChange,
  allowCustom,
  required,
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
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--muted-foreground)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 6,
        }}
      >
        {label}
        {required ? " *" : ""}
      </label>
      {custom ? (
        <div>
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Custom ${label.toLowerCase()}…`}
            style={{
              width: "100%",
              height: 44,
              background: "var(--muted)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "0 14px",
              fontSize: 13,
              color: "var(--foreground)",
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => {
              setCustomMode(false);
              onChange("");
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginTop: 6,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--primary)",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <ArrowLeft className="w-3 h-3" /> Choose from list
          </button>
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === "__custom__") {
              setCustomMode(true);
              onChange("");
            } else onChange(e.target.value);
          }}
          style={{
            width: "100%",
            height: 44,
            background: "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "0 12px",
            fontSize: 13,
            color: "var(--foreground)",
            fontFamily: "inherit",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          {allowCustom && <option value="__custom__">Other (type your own)…</option>}
        </select>
      )}
    </div>
  );
}

/* ── Score bars (used in review + history detail) ───────────────────────── */
function ScoreBars({
  scores,
  overall,
}: {
  scores: NonNullable<InterviewSession["scores"]>;
  overall?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {overall != null && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span
            className="font-display"
            style={{
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: scoreColor(overall),
            }}
          >
            {overall}
          </span>
          <span style={{ fontSize: 15, color: "var(--muted-foreground)", fontWeight: 600 }}>
            /100 overall
          </span>
        </div>
      )}
      {SCORE_DIMENSIONS.map((d) => {
        const v = scores[d.key];
        return (
          <div key={d.key}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                {d.label}
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}>
                  {" "}
                  · {d.hint}
                </span>
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor(v) }}>{v}</span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 9999,
                background: "var(--muted)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${v}%`,
                  background: scoreColor(v),
                  borderRadius: 9999,
                  transition: "width 300ms ease",
                }}
              />
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
    <div
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
  );
}

/* ── Per-question STAR feedback card (review mode) ───────────────────────── */
function QuestionFeedbackCard({ qf, index }: { qf: QuestionFeedback; index: number }) {
  const qualityColor =
    qf.quality === "Strong"
      ? "var(--forest)"
      : qf.quality === "Adequate"
        ? "var(--marigold, #E8B948)"
        : "var(--primary)";
  return (
    <div style={{ ...cardStyle, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--muted-foreground)",
              marginBottom: 4,
            }}
          >
            Question {index + 1}
          </div>
          <div
            style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.45 }}
          >
            {qf.question}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            className="font-display"
            style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: qualityColor }}
          >
            {qf.score}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: qualityColor,
              background: "color-mix(in srgb, " + qualityColor + " 12%, transparent)",
              borderRadius: 6,
              padding: "2px 7px",
            }}
          >
            {qf.quality}
          </div>
        </div>
      </div>

      {/* STAR breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {STAR_ELEMENTS.map(({ key, label }) => {
          const value = qf.star[key];
          const present = !!value;
          return (
            <div
              key={key}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "baseline",
                fontSize: 12.5,
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  width: 74,
                  flexShrink: 0,
                  fontWeight: 700,
                  color: present ? "var(--foreground)" : "var(--primary)",
                }}
              >
                {label}
              </span>
              {present ? (
                <span style={{ color: "var(--muted-foreground)" }}>{value}</span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontWeight: 600,
                    color: "var(--primary)",
                  }}
                >
                  <AlertTriangle className="w-3 h-3" /> Missing
                </span>
              )}
            </div>
          );
        })}
      </div>

      {qf.feedback && (
        <p
          style={{
            fontSize: 13,
            color: "var(--muted-foreground)",
            lineHeight: 1.6,
            margin: 0,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
          }}
        >
          {qf.feedback}
        </p>
      )}
    </div>
  );
}

/* ── Video-call tile (Zoom/Teams-style participant) ─────────────────────── */
function CallTile({
  name,
  sublabel,
  initials,
  active,
  accent,
  muted,
}: {
  name: string;
  sublabel?: string;
  initials?: string;
  active?: boolean;
  accent: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        flex: "1 1 320px",
        maxWidth: 560,
        minHeight: 220,
        aspectRatio: "16 / 10",
        borderRadius: 18,
        background: "#1b1e25",
        border: `1px solid ${active ? accent : "#2a2e37"}`,
        boxShadow: active ? `0 0 0 3px ${accent}55, 0 0 50px ${accent}44` : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        transition: "box-shadow 150ms ease, border-color 150ms ease",
      }}
    >
      <div
        style={{
          width: 104,
          height: 104,
          borderRadius: "50%",
          background: `${accent}22`,
          color: accent,
          border: `2px solid ${accent}66`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 34,
          fontWeight: 700,
        }}
      >
        {initials ? initials : <Bot className="w-12 h-12" />}
      </div>

      {/* Speaking equalizer — the "who's talking" cue from real call apps */}
      {active && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            display: "flex",
            gap: 3,
            alignItems: "flex-end",
            height: 22,
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="mi-eqbar"
              style={{
                width: 3,
                height: 5,
                background: accent,
                borderRadius: 2,
                animationDelay: `${i * 0.11}s`,
              }}
            />
          ))}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(0,0,0,0.5)",
          color: "#fff",
          padding: "4px 10px",
          borderRadius: 8,
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        {muted ? (
          <MicOff className="w-3.5 h-3.5" style={{ opacity: 0.85 }} />
        ) : (
          <Mic className="w-3.5 h-3.5" style={{ opacity: 0.85 }} />
        )}
        {name}
        {sublabel ? <span style={{ opacity: 0.7, fontWeight: 500 }}>· {sublabel}</span> : null}
      </div>
    </div>
  );
}

/* ── Call control-bar button (vertical icon + label, Zoom-style) ────────── */
function CallControl({
  onClick,
  active,
  disabled,
  title,
  icon,
  text,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      aria-pressed={active}
      title={title}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        width: 66,
        height: 56,
        borderRadius: 12,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: active ? "rgba(217,119,87,0.22)" : "#23262e",
        color: active ? "#ffb59b" : "#cdd2da",
        fontFamily: "inherit",
        fontSize: 10,
        fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      <span>{text}</span>
    </button>
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
  const chatRef = useRef<CoachingSession | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Voice: the interviewer speaks (TTS), the user can answer by mic (STT) ──
  const speech = useSpeech();
  const [voiceOn, setVoiceOn] = useState(true);
  const voiceEnabled = speech.supported && voiceOn;
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    try {
      const stored = localStorage.getItem("interviewVoice");
      return stored && isKokoroVoice(stored) ? stored : DEFAULT_KOKORO_VOICE;
    } catch {
      return DEFAULT_KOKORO_VOICE;
    }
  });
  const [samplingVoice, setSamplingVoice] = useState<string | null>(null);
  // Surfaced when a voice preview can't be played, so a silent failure doesn't
  // read as "this voice is broken".
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // Hold onto the playing sample so it isn't garbage-collected mid-clip and can
  // be stopped before the next preview (no overlapping samples).
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const stopSample = () => {
    const a = sampleAudioRef.current;
    if (a) {
      try {
        a.pause();
      } catch {
        /* ignore */
      }
      a.src = "";
      sampleAudioRef.current = null;
    }
  };
  useEffect(() => stopSample, []);
  // Warm the ~80MB Kokoro model up front while the user reads the setup screen.
  // Cold generation takes many seconds; if the user taps Sample first and waits
  // that long, the browser drops the click's user-activation and blocks
  // audio.play() (silent "nothing happened"). A pre-warmed model generates in
  // ~1s, so playback stays inside the activation window.
  // Only warm the ~80MB model when the interviewer voice is actually on (the default).
  // A user who muted the interviewer shouldn't download the model speculatively;
  // if they unmute here, voiceEnabled flips and this re-runs to warm it then. An
  // explicit Sample tap still loads on demand regardless.
  useEffect(() => {
    if (mode.kind === "setup" && voiceEnabled) preloadKokoro();
  }, [mode.kind, voiceEnabled]);

  // ── Hands-free conversation: auto-submit after the user pauses speaking ──
  const [conversational, setConversational] = useState(true);
  // Wait this long after the user stops talking before treating the turn as
  // finished. Generous so natural mid-answer "thinking" pauses (2-3s) don't
  // cut the user off prematurely.
  const SILENCE_MS = 4500;
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadSpeechRef = useRef(false);
  const conversationalRef = useRef(conversational);
  useEffect(() => {
    conversationalRef.current = conversational;
  }, [conversational]);
  const handleSendRef = useRef<(text: string) => void>(() => {});

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const dictation = useDictation({
    onText: (t) => {
      setInput(t);
      if (!conversationalRef.current) return; // manual mode: just fill the box
      if (t.trim()) hadSpeechRef.current = true;
      clearSilenceTimer();
      // A pause after speech = the user finished their turn → auto-submit.
      silenceTimerRef.current = setTimeout(() => {
        if (!conversationalRef.current || !hadSpeechRef.current) return;
        const text = t.trim();
        if (!text) return;
        hadSpeechRef.current = false;
        try {
          dictation.stop();
        } catch {
          /* ignore */
        }
        handleSendRef.current(text);
      }, SILENCE_MS);
    },
  });

  // ── Timed interview: countdown then auto-finish ──
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [failedInput, setFailedInput] = useState<string | null>(null);
  // Video-call view controls
  const [showChat, setShowChat] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const handleFinishRef = useRef<() => void>(() => {});

  // Question source: random (default, recommended) vs hand-picked from the bank.
  const [questionMode, setQuestionMode] = useState<"random" | "pick">("random");
  const [pickedQuestions, setPickedQuestions] = useState<string[]>([]);
  const toggleQuestion = (q: string) =>
    setPickedQuestions((prev) => (prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]));

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Tick the countdown once per second while a timed session is live.
  useEffect(() => {
    if (mode.kind !== "live" || secondsLeft == null) return;
    if (secondsLeft <= 0) {
      setSecondsLeft(null);
      setTimeUp(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [mode.kind, secondsLeft]);

  // When time's up, auto-finish — but wait if the interviewer is mid-response.
  useEffect(() => {
    if (timeUp && mode.kind === "live" && !isGenerating && !isScoring) {
      setTimeUp(false);
      handleFinishRef.current();
    }
  }, [timeUp, mode.kind, isGenerating, isScoring]);

  /** Start listening for the user's answer (resets the pause/auto-submit state). */
  const startListening = () => {
    if (!dictation.supported) return;
    speech.cancel();
    clearSilenceTimer();
    hadSpeechRef.current = false;
    setInput("");
    try {
      dictation.start();
    } catch {
      /* ignore */
    }
  };

  /** After the interviewer finishes a turn, auto-open the mic in hands-free mode. */
  const continueConversation = () => {
    if (!conversationalRef.current || !dictation.supported) return;
    startListening();
  };

  // Stream an interviewer reply to `text` into the trailing empty model bubble.
  // On failure, leave a calm message and remember `text` so the user can retry
  // the same turn — never a dead end.
  const streamReply = async (text: string) => {
    if (!chatRef.current) return;
    setFailedInput(null);
    setIsGenerating(true);
    try {
      const full = await chatRef.current.send(text, (running) => {
        setMessages((prev) => [...prev.slice(0, -1), { role: "model", text: running }]);
      });
      // Speak the question, then (hands-free) reopen the mic when it finishes.
      if (voiceEnabled) speech.speak(full, { voice: selectedVoice, onEnd: continueConversation });
      else continueConversation();
    } catch (err) {
      console.error("Interview reply failed:", err);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "model",
          text: "I couldn't reach the interviewer just now. No worries — tap Retry to continue where we left off.",
        },
      ]);
      setFailedInput(text);
    } finally {
      setIsGenerating(false);
    }
  };

  // Setup fields come from the workflow config (role/focus, type/level, …),
  // skipping the JD-URL field — the interviewer can't open links anyway.
  const setupFields = config.fields.filter((f) => f.id !== "jdUrl" && f.type === "select");
  const requiredOk =
    setupFields.filter((f) => f.required).every((f) => (formData[f.id] ?? "").trim()) &&
    (questionMode === "random" || pickedQuestions.length > 0) &&
    !!selectedVoice;

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
      (baseline
        ? `\n\n--- CANDIDATE PROFILE (tailor questions to their real background) ---\n${baseline}`
        : "") +
      focusHint
    );
  };

  /* ── Start a session ─────────────────────────────────────────────── */
  const handleStart = async () => {
    if (!requiredOk || isGenerating) return;
    if (voiceEnabled) preloadKokoro(); // warm the in-browser voice model
    chatRef.current = createCoachingSession(buildSystemInstruction());
    // generatePrompt is typed string | parts[], but the mock workflows always build a string.
    const generated = config.generatePrompt(formData);
    let request = typeof generated === "string" ? generated : String(generated);
    // If the user hand-picked questions, instruct the interviewer to use exactly
    // those (rephrased for the role), overriding the random/count guidance.
    if (questionMode === "pick" && pickedQuestions.length) {
      const role = roleOf(formData) || "this role";
      request +=
        `\n\nIMPORTANT — the candidate chose specific questions to practice. Ignore any earlier guidance about how many questions to ask. Ask EXACTLY these ${pickedQuestions.length} question(s), in this order, one at a time. Rephrase each naturally to fit a ${role} and add brief follow-ups, but do not introduce other main questions:\n` +
        pickedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n");
    }
    const friendly = `Start the interview — ${[roleOf(formData), focusOf(formData)].filter(Boolean).join(" · ")}.`;
    setMessages([
      { role: "user", text: friendly },
      { role: "model", text: "" },
    ]);
    setMode({ kind: "live" });
    // Begin the countdown for the chosen length (default 10 min).
    const minutes = parseInt(formData.duration || "10", 10);
    setSecondsLeft(Number.isFinite(minutes) && minutes > 0 ? minutes * 60 : 600);
    setTimeUp(false);
    await streamReply(request);
  };

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const text = (overrideText ?? input).trim();
    if (!text || isGenerating || !chatRef.current) return;
    clearSilenceTimer();
    hadSpeechRef.current = false;
    if (dictation.listening) {
      try {
        dictation.stop();
      } catch {
        /* ignore */
      }
    }
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }, { role: "model", text: "" }]);
    await streamReply(text);
  };
  // Keep the pause/auto-submit timer pointed at the latest handleSend closure.
  useEffect(() => {
    handleSendRef.current = (t: string) => handleSend(undefined, t);
  });

  // Re-attempt the last failed turn: swap the error bubble for a fresh empty one
  // and stream again, without re-adding the user's message.
  const retry = async () => {
    if (!failedInput || isGenerating || !chatRef.current) return;
    const text = failedInput;
    setMessages((prev) => [...prev.slice(0, -1), { role: "model", text: "" }]);
    await streamReply(text);
  };

  /**
   * Call-style mic toggle: tap to talk (interrupts the interviewer's voice);
   * tap again to stop and auto-send the spoken answer — like unmuting/muting in
   * a real call. Typed answers still go through the chat panel's Send button.
   */
  const toggleMic = () => {
    if (dictation.listening) {
      clearSilenceTimer();
      hadSpeechRef.current = false;
      try {
        dictation.stop();
      } catch {
        /* ignore */
      }
      const t = input.trim();
      if (t && !isGenerating) handleSend(undefined, t);
    } else {
      startListening();
    }
  };

  const toggleVoice = () => {
    setVoiceOn((on) => {
      if (on) speech.cancel(); // turning off — silence any current speech
      return !on;
    });
  };

  /** Sample a Kokoro voice (plays a short line) so the user can choose. */
  const sampleVoice = async (voiceId: string) => {
    // Silence the interviewer and any previous sample so previews don't overlap.
    speech.cancel();
    stopSample();
    setVoiceError(null);
    setSamplingVoice(voiceId);
    try {
      const blob = await kokoroGenerate(
        "Hi, I'm your interviewer today. Let's get started — tell me about yourself.",
        voiceId,
        { waitForLoad: true },
      );
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      sampleAudioRef.current = audio;
      // Resolve on natural end; reject if playback can't start (e.g. the browser
      // blocked it) so the failure surfaces instead of being swallowed.
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          URL.revokeObjectURL(url);
          if (sampleAudioRef.current === audio) sampleAudioRef.current = null;
        };
        audio.onended = () => {
          cleanup();
          resolve();
        };
        audio.onerror = () => {
          cleanup();
          reject(new Error("playback failed"));
        };
        audio.play().catch((err) => {
          cleanup();
          reject(err);
        });
      });
    } catch (err) {
      console.error("Voice sample failed:", err);
      const label = KOKORO_VOICES.find((v) => v.id === voiceId)?.label ?? "this voice";
      setVoiceError(`Couldn't play the ${label} sample — tap Sample again to try.`);
    } finally {
      setSamplingVoice(null);
    }
  };

  const selectVoice = (voiceId: string) => {
    setSelectedVoice(voiceId);
    try {
      localStorage.setItem("interviewVoice", voiceId);
    } catch {
      /* ignore */
    }
    preloadKokoro();
  };

  /* ── Finish: score the transcript and persist the session ────────── */
  const answered = messages.filter((m) => m.role === "user").length > 1; // beyond the kickoff
  const handleFinish = async () => {
    if (isScoring || isGenerating) return;
    // Stop any voice activity while we score.
    speech.cancel();
    clearSilenceTimer();
    hadSpeechRef.current = false;
    if (dictation.listening) {
      try {
        dictation.stop();
      } catch {
        /* ignore */
      }
    }
    setSecondsLeft(null);
    setIsScoring(true);
    try {
      let evaluation: InterviewEvaluation | undefined;
      try {
        evaluation = await evaluateInterviewTranscript(config.title, roleOf(formData), messages);
      } catch (err) {
        console.error("Scoring failed:", err);
      }
      const sessionData = {
        workflow: workflowId,
        role: roleOf(formData) || undefined,
        focus: focusOf(formData) || undefined,
        transcript: messages,
        scores: evaluation?.scores,
        overallScore: evaluation?.overall,
        summary: evaluation?.summary,
        strengths: evaluation?.strengths,
        improvements: evaluation?.improvements,
        questionFeedback: evaluation?.questionFeedback,
      };
      const saved = await addSession(sessionData);
      const session: InterviewSession = saved ?? {
        id: "unsaved",
        ...sessionData,
        createdAt: new Date().toISOString(),
      };
      setShowTranscript(false);
      setMode({ kind: "review", session, previousOverall: latest?.overallScore });
    } finally {
      setIsScoring(false);
    }
  };
  // Keep the timer's auto-finish pointed at the latest closure.
  useEffect(() => {
    handleFinishRef.current = handleFinish;
  });

  const reset = () => {
    speech.cancel();
    clearSilenceTimer();
    hadSpeechRef.current = false;
    if (dictation.listening) {
      try {
        dictation.stop();
      } catch {
        /* ignore */
      }
    }
    chatRef.current = null;
    setMessages([]);
    setInput("");
    setSecondsLeft(null);
    setTimeUp(false);
    setShowStopConfirm(false);
    setFailedInput(null);
    setMode({ kind: "setup" });
  };

  // Clean up the pause timer if the component unmounts mid-session.
  useEffect(() => () => clearSilenceTimer(), []);

  /* ════════════════════════════ REVIEW ═════════════════════════════ */
  if (mode.kind === "review") {
    const s = mode.session;
    const delta =
      mode.previousOverall != null && s.overallScore != null
        ? s.overallScore - mode.previousOverall
        : null;
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
            gap: 16,
            flexShrink: 0,
          }}
        >
          <button
            onClick={reset}
            aria-label="Done — back to setup"
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
            <ArrowLeft className="w-4 h-4" /> Done
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="font-display"
              style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)" }}
            >
              Session feedback
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {config.title}
              {s.role ? ` · ${s.role}` : ""}
            </div>
          </div>
          <button
            onClick={reset}
            aria-label="Practice again"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--primary)",
              border: "none",
              borderRadius: 10,
              height: 36,
              padding: "0 16px",
              cursor: "pointer",
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Play className="w-3.5 h-3.5" /> Practice again
          </button>
        </header>

        <div className="flex-1 overflow-auto no-scrollbar p-4 sm:p-8">
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {s.scores ? (
              <div style={{ ...cardStyle, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Flag className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                    Your scores
                  </span>
                  {delta != null && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 12,
                        color: "var(--muted-foreground)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      vs last session <Delta value={delta} />
                    </span>
                  )}
                </div>
                <ScoreBars scores={s.scores} overall={s.overallScore} />
                {s.summary && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--muted-foreground)",
                      lineHeight: 1.6,
                      marginTop: 16,
                      marginBottom: 0,
                    }}
                  >
                    {s.summary}
                  </p>
                )}
              </div>
            ) : (
              <div
                style={{
                  ...cardStyle,
                  padding: 24,
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                }}
              >
                Scoring didn't complete for this session — the transcript was still saved to your
                history.
              </div>
            )}

            {s.strengths?.length || s.improvements?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
                {s.strengths?.length ? (
                  <div style={{ ...cardStyle, padding: 20 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}
                    >
                      <CheckCircle2 className="w-4 h-4" style={{ color: "var(--forest)" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                        What worked
                      </span>
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        fontSize: 13,
                        color: "var(--muted-foreground)",
                        lineHeight: 1.7,
                      }}
                    >
                      {s.strengths.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {s.improvements?.length ? (
                  <div style={{ ...cardStyle, padding: 20 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}
                    >
                      <Lightbulb
                        className="w-4 h-4"
                        style={{ color: "var(--marigold, #E8B948)" }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                        Practice next
                      </span>
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        fontSize: 13,
                        color: "var(--muted-foreground)",
                        lineHeight: 1.7,
                      }}
                    >
                      {s.improvements.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {s.questionFeedback?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                    Per-question feedback
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    STAR breakdown of each answer
                  </span>
                </div>
                {s.questionFeedback.map((qf, i) => (
                  <QuestionFeedbackCard key={i} qf={qf} index={i} />
                ))}
              </div>
            ) : null}

            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <button
                onClick={() => setShowTranscript((t) => !t)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 20px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {showTranscript ? (
                  <ChevronDown className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                ) : (
                  <ChevronRight className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                  Transcript
                </span>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  {s.transcript.length} turns
                </span>
              </button>
              {showTranscript && (
                <div
                  style={{
                    padding: "4px 20px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    maxHeight: 480,
                    overflow: "auto",
                  }}
                >
                  {s.transcript.map((m, i) => (
                    <ChatBubble key={i} msg={m} />
                  ))}
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
    // Questions asked so far = completed interviewer turns — gives the user a
    // sense of progress alongside the countdown timer.
    const askedCount = messages.filter((m) => m.role === "model" && m.text.trim()).length;
    const statusText = deriveChatStatus({
      isScoring,
      isGenerating,
      speaking: speech.speaking,
      listening: dictation.listening,
    });
    const initials =
      (profile.preferredName || profile.fullName || "You")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || "You";
    const lastModel = [...messages].reverse().find((m) => m.role === "model" && m.text.trim());
    const captionText = lastModel ? stripMarkdown(lastModel.text) : "";
    return (
      <div
        className="flex-1 flex flex-col h-full overflow-hidden relative"
        style={{ background: "#0f1115" }}
      >
        <style>{`@keyframes mi-eq{0%,100%{height:5px}50%{height:20px}}.mi-eqbar{animation:mi-eq .8s ease-in-out infinite}`}</style>

        {/* Meeting top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 18px",
            background: "#16181d",
            borderBottom: "1px solid #23262e",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 9999, background: "#ef4444" }} />{" "}
              {config.title}
            </span>
            <span
              title="You're talking to an AI interviewer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
                background: "rgba(217,119,87,0.28)",
                borderRadius: 6,
                padding: "2px 7px",
              }}
            >
              <Bot className="w-3 h-3" /> AI
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#9aa0aa",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {[roleOf(formData), focusOf(formData)].filter(Boolean).join(" · ")}
            </span>
          </div>
          {askedCount > 0 && (
            <span
              title="Questions asked so far"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#cdd2da",
                background: "#23262e",
                borderRadius: 8,
                padding: "6px 10px",
              }}
            >
              Q{askedCount}
            </span>
          )}
          {secondsLeft != null && (
            <span
              title="Time remaining — ends automatically at zero"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontVariantNumeric: "tabular-nums",
                fontSize: 13,
                fontWeight: 700,
                color: secondsLeft <= 60 ? "#ff8f6b" : "#cdd2da",
                background: "#23262e",
                borderRadius: 8,
                padding: "6px 10px",
              }}
            >
              <Clock className="w-3.5 h-3.5" />{" "}
              {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </span>
          )}
        </div>

        {/* Stage + chat side panel */}
        <div className="flex-1 flex min-h-0">
          <div
            style={{
              flex: 1,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: 16,
              flexWrap: "wrap",
            }}
          >
            <CallTile
              name="AI Interviewer"
              sublabel="Interviewer"
              active={speech.speaking}
              accent="#d97757"
            />
            <CallTile
              name="You"
              initials={initials}
              active={dictation.listening}
              accent="#3b82f6"
              muted={!dictation.listening}
            />

            {/* Live captions */}
            {showCaptions && (captionText || (dictation.listening && input.trim())) && (
              <div
                style={{
                  position: "absolute",
                  left: 16,
                  right: 16,
                  bottom: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  alignItems: "center",
                  pointerEvents: "none",
                }}
              >
                {captionText && (
                  <div
                    style={{
                      maxWidth: 760,
                      background: "rgba(0,0,0,0.66)",
                      color: "#fff",
                      padding: "10px 16px",
                      borderRadius: 12,
                      fontSize: 15,
                      lineHeight: 1.5,
                      textAlign: "center",
                      maxHeight: 120,
                      overflow: "auto",
                    }}
                  >
                    <span style={{ color: "#ffb59b", fontWeight: 700 }}>Interviewer: </span>
                    {captionText}
                  </div>
                )}
                {dictation.listening && input.trim() && (
                  <div
                    style={{
                      maxWidth: 760,
                      background: "rgba(59,130,246,0.85)",
                      color: "#fff",
                      padding: "8px 14px",
                      borderRadius: 12,
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>You: </span>
                    {input}
                  </div>
                )}
              </div>
            )}
          </div>

          {showChat && (
            <div
              className="absolute md:static inset-y-0 right-0 z-30 w-full md:w-[360px] flex flex-col"
              style={{ background: "var(--card)", borderLeft: "1px solid var(--border)" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
                  Chat
                </span>
                <button
                  onClick={() => setShowChat(false)}
                  aria-label="Close chat"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--muted-foreground)",
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div
                className="flex-1 overflow-auto no-scrollbar"
                style={{ padding: 16 }}
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                aria-label="Interview conversation"
              >
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <ChatBubble key={idx} msg={msg} />
                  ))}
                  {failedInput && !isGenerating && (
                    <div className="flex justify-center">
                      <button
                        onClick={retry}
                        aria-label="Retry the last message"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-[12px] font-semibold transition-colors hover:border-primary/40"
                        style={{
                          background: "var(--card)",
                          color: "var(--primary)",
                          fontFamily: "inherit",
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Retry
                      </button>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </div>
              <div
                className="border-t border-border"
                style={{ padding: 12, background: "var(--muted)" }}
              >
                {config.suggestedPrompts && config.suggestedPrompts.length > 0 && (
                  <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-1">
                    {config.suggestedPrompts.slice(0, 3).map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSend(undefined, p)}
                        disabled={isGenerating}
                        className="whitespace-nowrap px-3 py-1.5 rounded-full border border-border text-[11px] font-medium transition-colors hover:border-primary/40 disabled:opacity-50"
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
                  onSubmit={handleSend}
                  className="flex items-end gap-2 rounded-[14px] border border-border"
                  style={{ background: "var(--card)", padding: 8 }}
                >
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type your answer…"
                    aria-label="Your answer"
                    rows={Math.min(6, Math.max(1, input.split("\n").length))}
                    className="flex-1 border-0 bg-transparent text-sm outline-none resize-none"
                    style={{
                      color: "var(--foreground)",
                      fontFamily: "inherit",
                      padding: "8px 6px",
                      lineHeight: 1.5,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isGenerating || !input.trim()}
                    aria-label="Send answer"
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
          )}
        </div>

        {/* Status line */}
        <div
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "#9aa0aa",
            padding: "6px 0",
            background: "#16181d",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 9999,
              background:
                isGenerating || isScoring
                  ? "#E8B948"
                  : speech.speaking
                    ? "#d97757"
                    : dictation.listening
                      ? "#22c55e"
                      : "#3a3f49",
            }}
          />
          {statusText}
        </div>

        {/* Control bar (Zoom/Teams-style) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "14px 16px",
            background: "#16181d",
            borderTop: "1px solid #23262e",
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          {dictation.supported && (
            <CallControl
              onClick={toggleMic}
              active={dictation.listening}
              disabled={isGenerating}
              title={
                dictation.listening
                  ? "Mute mic and send your answer"
                  : "Unmute mic to answer by voice"
              }
              icon={
                dictation.listening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />
              }
              text={dictation.listening ? "Mic on" : "Mic"}
            />
          )}
          {dictation.supported && (
            <CallControl
              onClick={() =>
                setConversational((c) => {
                  const nowOn = !c;
                  if (!nowOn) {
                    clearSilenceTimer();
                    if (dictation.listening) {
                      try {
                        dictation.stop();
                      } catch {
                        /* ignore */
                      }
                    }
                  }
                  return nowOn;
                })
              }
              active={conversational}
              title={
                conversational
                  ? "Hands-free is on — answers auto-submit when you pause"
                  : "Turn on hands-free conversation"
              }
              icon={<Radio className="w-5 h-5" />}
              text="Hands-free"
            />
          )}
          {speech.supported && (
            <CallControl
              onClick={toggleVoice}
              active={voiceOn}
              title={voiceOn ? "Mute interviewer voice" : "Unmute interviewer voice"}
              icon={voiceOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              text="Sound"
            />
          )}
          <CallControl
            onClick={() => setShowCaptions((c) => !c)}
            active={showCaptions}
            title={showCaptions ? "Hide captions" : "Show captions"}
            icon={<Captions className="w-5 h-5" />}
            text="Captions"
          />
          <CallControl
            onClick={() => setShowChat((c) => !c)}
            active={showChat}
            title={showChat ? "Hide chat" : "Show chat"}
            icon={<MessageSquare className="w-5 h-5" />}
            text="Chat"
          />
          <button
            onClick={handleFinish}
            disabled={isScoring || isGenerating || !answered}
            aria-label="End interview and get feedback"
            title={
              answered
                ? "Get scored feedback and save this session"
                : "Answer at least one question first"
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 56,
              padding: "0 18px",
              borderRadius: 12,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              cursor: isScoring || isGenerating || !answered ? "not-allowed" : "pointer",
              opacity: isScoring || isGenerating || !answered ? 0.6 : 1,
            }}
          >
            {isScoring ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Scoring…
              </>
            ) : (
              <>
                <Flag className="w-4 h-4" /> End &amp; feedback
              </>
            )}
          </button>
          <button
            onClick={() => setShowStopConfirm(true)}
            disabled={isScoring}
            aria-label="Leave interview"
            title="Leave — this won't be scored or saved"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 56,
              padding: "0 18px",
              borderRadius: 12,
              border: "none",
              background: "#ef4444",
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              cursor: isScoring ? "not-allowed" : "pointer",
              opacity: isScoring ? 0.6 : 1,
            }}
          >
            <PhoneOff className="w-4 h-4" /> Leave
          </button>
        </div>

        {/* Stop confirmation — stopping abandons the session (no score, start over) */}
        {showStopConfirm && (
          <div
            onClick={() => setShowStopConfirm(false)}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 50,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ ...cardStyle, padding: 24, maxWidth: 420, width: "100%" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(217,119,87,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle className="w-4 h-4" style={{ color: "var(--primary)" }} />
                </div>
                <div
                  className="font-display"
                  style={{ fontSize: 17, fontWeight: 600, color: "var(--foreground)" }}
                >
                  Stop the interview?
                </div>
              </div>
              <p
                style={{
                  fontSize: 13.5,
                  color: "var(--muted-foreground)",
                  lineHeight: 1.6,
                  margin: "0 0 20px",
                }}
              >
                Stopping ends this interview now — it{" "}
                <strong style={{ color: "var(--foreground)" }}>won't be scored or saved</strong>,
                and you'll start over from the beginning. To get feedback instead, use{" "}
                <strong style={{ color: "var(--foreground)" }}>End &amp; get feedback</strong>.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowStopConfirm(false)}
                  style={{
                    height: 40,
                    padding: "0 16px",
                    background: "var(--muted)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--foreground)",
                  }}
                >
                  Keep going
                </button>
                <button
                  onClick={reset}
                  style={{
                    height: 40,
                    padding: "0 16px",
                    background: "var(--primary)",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#fff",
                  }}
                >
                  Stop &amp; start over
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ════════════════════════════ SETUP ══════════════════════════════ */
  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      <header
        style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            color: "var(--foreground)",
            margin: "0 0 4px",
          }}
        >
          {config.title}
        </h2>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
          {config.description}
        </p>
      </header>

      <div className="flex-1 overflow-auto no-scrollbar p-8">
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {/* Progress strip — visible improvement is the point of practicing */}
          {mySessions.length > 0 && latest?.scores && (
            <div style={{ ...cardStyle, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <TrendingUp className="w-4 h-4" style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                  Your progress
                </span>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  {mySessions.length} scored session{mySessions.length === 1 ? "" : "s"}
                </span>
                {mySessions.length >= 2 &&
                  mySessions[0].overallScore != null &&
                  mySessions[1].overallScore != null && (
                    <span style={{ marginLeft: "auto" }}>
                      <Delta value={mySessions[0].overallScore - mySessions[1].overallScore} />
                    </span>
                  )}
              </div>
              {/* Last sessions, oldest → newest, as a mini bar chart */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 72 }}>
                {[...mySessions]
                  .reverse()
                  .slice(-12)
                  .map((s) => (
                    <div
                      key={s.id}
                      title={`${s.overallScore}/100 · ${new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      style={{
                        flex: 1,
                        maxWidth: 36,
                        height: `${Math.max(8, s.overallScore ?? 0)}%`,
                        background: scoreColor(s.overallScore ?? 0),
                        borderRadius: 6,
                        opacity: s.id === latest.id ? 1 : 0.55,
                      }}
                    />
                  ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 10 }}>
                Latest:{" "}
                <strong style={{ color: scoreColor(latest.overallScore ?? 0) }}>
                  {latest.overallScore}/100
                </strong>
                {latest.improvements?.length ? (
                  <> · next session will probe: {latest.improvements[0]}</>
                ) : null}
              </div>
            </div>
          )}

          {/* Setup */}
          <div style={{ ...cardStyle, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                Set up your session
              </span>
            </div>
            <div
              className={
                setupFields.length > 1 ? "grid grid-cols-1 sm:grid-cols-2" : "grid grid-cols-1"
              }
              style={{ gap: 14 }}
            >
              {setupFields.map((f) => (
                <FieldSelect
                  key={f.id}
                  label={f.label.replace(" (Optional)", "")}
                  // Drop a literal "Other" — when custom is allowed, FieldSelect
                  // already adds an "Other (type your own)…" entry, so a bare
                  // "Other" would be a confusing duplicate.
                  options={((f.options ?? []) as { label: string; value: string }[]).filter(
                    (o) => !(f.allowCustom && o.value === "Other"),
                  )}
                  value={formData[f.id] ?? ""}
                  onChange={(v) => setFormData((prev) => ({ ...prev, [f.id]: v }))}
                  allowCustom={f.allowCustom}
                  required={f.required}
                />
              ))}
            </div>
          </div>

          {/* Question source — random (recommended) or pick from the bank */}
          <div style={{ ...cardStyle, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                Questions
              </span>
            </div>
            <div
              style={{ display: "flex", gap: 10, marginBottom: questionMode === "pick" ? 16 : 0 }}
            >
              {(
                [
                  {
                    id: "random",
                    title: "Surprise me",
                    sub: "Recommended · role-tailored, random",
                  },
                  { id: "pick", title: "Choose questions", sub: "Practice specific ones" },
                ] as const
              ).map((opt) => {
                const on = questionMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setQuestionMode(opt.id)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 12,
                      cursor: "pointer",
                      border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`,
                      background: on ? "rgba(217,119,87,0.08)" : "var(--card)",
                      fontFamily: "inherit",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: on ? "var(--primary)" : "var(--foreground)",
                      }}
                    >
                      {opt.title}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 2 }}>
                      {opt.sub}
                    </div>
                  </button>
                );
              })}
            </div>

            {questionMode === "pick" && (
              <div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12 }}>
                  Pick the questions you want to practice — the interviewer asks exactly these
                  (rephrased for your role).
                  <strong style={{ color: "var(--foreground)" }}>
                    {" "}
                    {pickedQuestions.length} selected.
                  </strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    maxHeight: 360,
                    overflow: "auto",
                  }}
                >
                  {QUESTION_BANK.map((cat) => (
                    <div key={cat.category}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--muted-foreground)",
                          marginBottom: 8,
                        }}
                      >
                        {cat.category}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {cat.questions.map((q) => {
                          const on = pickedQuestions.includes(q);
                          return (
                            <button
                              key={q}
                              type="button"
                              onClick={() => toggleQuestion(q)}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                padding: "9px 12px",
                                borderRadius: 10,
                                cursor: "pointer",
                                textAlign: "left",
                                border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`,
                                background: on ? "rgba(217,119,87,0.08)" : "var(--card)",
                                fontFamily: "inherit",
                              }}
                            >
                              <span
                                style={{
                                  width: 18,
                                  height: 18,
                                  flexShrink: 0,
                                  marginTop: 1,
                                  borderRadius: 5,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: `2px solid ${on ? "var(--primary)" : "var(--border)"}`,
                                  background: on ? "var(--primary)" : "transparent",
                                  color: "#fff",
                                }}
                              >
                                {on && <Check className="w-3 h-3" />}
                              </span>
                              <span
                                style={{
                                  fontSize: 13,
                                  color: "var(--foreground)",
                                  lineHeight: 1.4,
                                }}
                              >
                                {q}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interviewer voice — sample & choose a Kokoro voice */}
          <div style={{ ...cardStyle, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Volume2 className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                Interviewer voice
              </span>
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                margin: "0 0 14px",
                lineHeight: 1.5,
              }}
            >
              Top-graded Kokoro voices, running privately in your browser. Tap ▶ to hear a sample,
              then choose one. First sample downloads the voice model (~80MB), so it may take a
              moment.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {KOKORO_VOICES.map((v: KokoroVoice) => {
                const isSel = selectedVoice === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => selectVoice(v.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 12,
                      cursor: "pointer",
                      border: `1px solid ${isSel ? "var(--primary)" : "var(--border)"}`,
                      background: isSel ? "rgba(217,119,87,0.08)" : "var(--card)",
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `2px solid ${isSel ? "var(--primary)" : "var(--border)"}`,
                        background: isSel ? "var(--primary)" : "transparent",
                        color: "#fff",
                      }}
                    >
                      {isSel && <Check className="w-3 h-3" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                        {v.label}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                        {v.accent} · {v.gender}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sampleVoice(v.id);
                      }}
                      disabled={samplingVoice != null}
                      aria-label={`Play a sample of the ${v.label} voice`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        height: 34,
                        padding: "0 12px",
                        borderRadius: 9,
                        border: "1px solid var(--border)",
                        background: "var(--muted)",
                        color: "var(--foreground)",
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: samplingVoice != null ? "not-allowed" : "pointer",
                        opacity: samplingVoice != null && samplingVoice !== v.id ? 0.5 : 1,
                      }}
                    >
                      {samplingVoice === v.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      Sample
                    </button>
                  </div>
                );
              })}
            </div>
            {voiceError && (
              <p
                role="alert"
                style={{
                  fontSize: 12,
                  color: "var(--destructive)",
                  margin: "12px 0 0",
                  lineHeight: 1.5,
                }}
              >
                {voiceError}
              </p>
            )}
          </div>

          {/* Start — at the bottom, once role, length, questions & voice are set */}
          <div>
            <button
              onClick={handleStart}
              disabled={!requiredOk || isGenerating}
              style={{
                width: "100%",
                height: 52,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "var(--primary)",
                border: "none",
                borderRadius: 14,
                cursor: !requiredOk || isGenerating ? "not-allowed" : "pointer",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 700,
                opacity: !requiredOk || isGenerating ? 0.5 : 1,
              }}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}{" "}
              Start interview
            </button>
            {!requiredOk && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  margin: "10px 0 0",
                  textAlign: "center",
                }}
              >
                {questionMode === "pick" && pickedQuestions.length === 0
                  ? "Pick at least one question to practice, or switch to “Surprise me”."
                  : "Choose your target role and length to begin."}
              </p>
            )}
            <p
              style={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                margin: "10px 0 0",
                lineHeight: 1.5,
              }}
            >
              You'll talk with an AI interviewer that asks one question at a time — answer by voice
              (mic access needed) or by typing. It stays in character like a real interview; your
              detailed STAR feedback and scores come at the end, and the session is saved to your
              history.
            </p>
          </div>

          {/* History */}
          {mySessions.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--muted-foreground)",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <History className="w-3.5 h-3.5" /> Past sessions{" "}
                <span style={{ fontWeight: 600, letterSpacing: 0, textTransform: "none" }}>
                  ({mySessions.length})
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {mySessions.map((s, i) => {
                  const prev = mySessions[i + 1];
                  const delta =
                    prev?.overallScore != null && s.overallScore != null
                      ? s.overallScore - prev.overallScore
                      : null;
                  const open = openHistoryId === s.id;
                  return (
                    <div
                      key={s.id}
                      style={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 14,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "14px 18px",
                        }}
                      >
                        <div
                          className="font-display"
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: scoreColor(s.overallScore ?? 0),
                            width: 44,
                            flexShrink: 0,
                          }}
                        >
                          {s.overallScore}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 14,
                              color: "var(--foreground)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {[s.role, s.focus].filter(Boolean).join(" · ") ||
                              MOCK_WORKFLOW_LABELS[s.workflow]}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--muted-foreground)",
                              marginTop: 2,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {new Date(s.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            {delta != null && <Delta value={delta} />}
                          </div>
                        </div>
                        <button
                          onClick={() => setOpenHistoryId(open ? null : s.id)}
                          aria-label={open ? "Hide session details" : "Review session details"}
                          aria-expanded={open}
                          style={{
                            height: 34,
                            padding: "0 14px",
                            background: "var(--muted)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--foreground)",
                            cursor: "pointer",
                          }}
                        >
                          {open ? "Hide" : "Review"}
                        </button>
                        <button
                          onClick={() => deleteSession(s.id)}
                          title="Delete session"
                          aria-label="Delete session"
                          style={{
                            height: 34,
                            width: 34,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "transparent",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            cursor: "pointer",
                            color: "var(--muted-foreground)",
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {open && (
                        <div
                          style={{
                            borderTop: "1px solid var(--border)",
                            padding: 18,
                            display: "flex",
                            flexDirection: "column",
                            gap: 14,
                          }}
                        >
                          {s.scores && <ScoreBars scores={s.scores} />}
                          {s.summary && (
                            <p
                              style={{
                                fontSize: 13,
                                color: "var(--muted-foreground)",
                                lineHeight: 1.6,
                                margin: 0,
                              }}
                            >
                              {s.summary}
                            </p>
                          )}
                          {s.improvements?.length ? (
                            <div
                              style={{
                                fontSize: 13,
                                color: "var(--muted-foreground)",
                                lineHeight: 1.6,
                              }}
                            >
                              <strong style={{ color: "var(--foreground)" }}>Practice next:</strong>{" "}
                              {s.improvements.join("; ")}
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
