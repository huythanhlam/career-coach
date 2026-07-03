import React, { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Send,
  ArrowLeft,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  DollarSign,
  Sparkles,
  Bot,
  User as UserIcon,
  History,
  Trash2,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import Markdown from "react-markdown";
import { useUserProfile } from "@/context/UserProfileContext";
import { useNegotiationSessions } from "@/hooks/useNegotiationSessions";
import { useSpeech } from "@/hooks/useSpeech";
import { useDictation } from "@/hooks/useDictation";
import { createCoachingChat, sendMessageStream } from "@/services/geminiService";
import {
  buildRecruiterSystemInstruction,
  evaluateNegotiationTranscript,
  type NegotiationSetup,
} from "@/services/negotiationEval";
import { buildProfileBaseline } from "@/lib/careerBaseline";
import { DEFAULT_KOKORO_VOICE, preloadKokoro, isKokoroVoice } from "@/services/kokoroTts";
import { COMMON_ROLES } from "@/config/workflows";
import {
  COUNTERPART_LABELS,
  DIFFICULTY_LABELS,
  NEGOTIATION_DIMENSIONS,
  type Counterpart,
  type Difficulty,
  type ChatTurn,
  type NegotiationSession,
  type NegotiationEvaluation,
} from "@/types/negotiationSession";

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 24,
};

const scoreColor = (s: number) =>
  s >= 80 ? "var(--forest)" : s >= 60 ? "#E8B948" : "var(--primary)";

const COUNTERPARTS: Counterpart[] = ["recruiter", "hiring_manager"];
const DIFFICULTIES: Difficulty[] = ["easy", "standard", "tough"];

export function NegotiationRoleplayWorkspace() {
  const { profile } = useUserProfile();
  const { sessions, addSession, deleteSession } = useNegotiationSessions();

  type Mode =
    { kind: "setup" } | { kind: "live" } | { kind: "review"; session: NegotiationSession };
  const [mode, setMode] = useState<Mode>({ kind: "setup" });

  // Setup
  const [role, setRole] = useState("");
  const [counterpart, setCounterpart] = useState<Counterpart>("recruiter");
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [scenario, setScenario] = useState("");

  // Live
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [failedInput, setFailedInput] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chatRef = useRef<any>(null);
  const setupRef = useRef<NegotiationSetup | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Voice
  const speech = useSpeech();
  const [voiceOn, setVoiceOn] = useState(true);
  const voiceEnabled = speech.supported && voiceOn;
  const selectedVoice = isKokoroVoice(DEFAULT_KOKORO_VOICE)
    ? DEFAULT_KOKORO_VOICE
    : DEFAULT_KOKORO_VOICE;

  const conversationalRef = useRef(true);
  const handleSendRef = useRef<(t: string) => void>(() => {});
  const hadSpeechRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SILENCE_MS = 4500;
  const clearSilence = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const dictation = useDictation({
    onText: (t) => {
      setInput(t);
      if (!conversationalRef.current) return;
      if (t.trim()) hadSpeechRef.current = true;
      clearSilence();
      silenceTimerRef.current = setTimeout(() => {
        if (!hadSpeechRef.current) return;
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

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  // Only warm the ~80MB model when the recruiter voice is on (the default); a user
  // who muted it shouldn't download the model speculatively. Unmuting flips
  // voiceEnabled and re-runs this to warm it then.
  useEffect(() => {
    if (mode.kind === "setup" && voiceEnabled) preloadKokoro();
  }, [mode.kind, voiceEnabled]);
  useEffect(
    () => () => {
      speech.cancel();
      clearSilence();
    },
    [],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const startListening = () => {
    if (!dictation.supported) return;
    speech.cancel();
    clearSilence();
    hadSpeechRef.current = false;
    setInput("");
    try {
      dictation.start();
    } catch {
      /* ignore */
    }
  };
  const continueConversation = () => {
    if (dictation.supported) startListening();
  };

  const streamReply = async (text: string) => {
    if (!chatRef.current) return;
    setFailedInput(null);
    setIsGenerating(true);
    try {
      let full = "";
      await sendMessageStream(chatRef.current, text, (chunk) => {
        full += chunk;
        setMessages((prev) => [...prev.slice(0, -1), { role: "model", text: full }]);
      });
      if (voiceEnabled) speech.speak(full, { voice: selectedVoice, onEnd: continueConversation });
      else continueConversation();
    } catch (err) {
      console.error("Negotiation reply failed:", err);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "model",
          text: "I couldn't reach the other side just now — tap Retry to continue where we left off.",
        },
      ]);
      setFailedInput(text);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStart = async () => {
    if (!role.trim() || isGenerating) return;
    if (voiceEnabled) preloadKokoro();
    const setup: NegotiationSetup = {
      role: role.trim(),
      counterpart,
      difficulty,
      scenario: scenario.trim(),
      baseline: buildProfileBaseline(profile),
    };
    setupRef.current = setup;
    chatRef.current = createCoachingChat(buildRecruiterSystemInstruction(setup));
    setMessages([
      { role: "user", text: `Let's begin the negotiation for the ${setup.role} offer.` },
      { role: "model", text: "" },
    ]);
    setMode({ kind: "live" });
    await streamReply("Begin the call: greet me and open the negotiation.");
  };

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const text = (overrideText ?? input).trim();
    if (!text || isGenerating || !chatRef.current) return;
    clearSilence();
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
  useEffect(() => {
    handleSendRef.current = (t: string) => handleSend(undefined, t);
  });

  const retry = async () => {
    if (!failedInput || isGenerating || !chatRef.current) return;
    const text = failedInput;
    setMessages((prev) => [...prev.slice(0, -1), { role: "model", text: "" }]);
    await streamReply(text);
  };

  const toggleMic = () => {
    if (dictation.listening) {
      clearSilence();
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

  const toggleVoice = () =>
    setVoiceOn((on) => {
      if (on) speech.cancel();
      return !on;
    });

  const answered = messages.filter((m) => m.role === "user").length > 1;
  const handleFinish = async () => {
    if (isScoring || isGenerating) return;
    speech.cancel();
    clearSilence();
    if (dictation.listening) {
      try {
        dictation.stop();
      } catch {
        /* ignore */
      }
    }
    const setup = setupRef.current;
    setIsScoring(true);
    try {
      let evaluation: NegotiationEvaluation | undefined;
      try {
        evaluation = await evaluateNegotiationTranscript({ role: setup?.role ?? role }, messages);
      } catch (err) {
        console.error("Negotiation scoring failed:", err);
      }
      const sessionData = {
        role: setup?.role ?? role,
        counterpart: setup?.counterpart ?? counterpart,
        scenario: setup?.scenario ?? scenario,
        transcript: messages,
        scores: evaluation?.scores,
        overallScore: evaluation?.overall,
        summary: evaluation?.summary,
        strengths: evaluation?.strengths,
        improvements: evaluation?.improvements,
        moveFeedback: evaluation?.moveFeedback,
      };
      const saved = await addSession(sessionData);
      const session: NegotiationSession = saved ?? {
        id: "unsaved",
        ...sessionData,
        createdAt: new Date().toISOString(),
      };
      setMode({ kind: "review", session });
    } finally {
      setIsScoring(false);
    }
  };

  const reset = () => {
    speech.cancel();
    clearSilence();
    chatRef.current = null;
    setMessages([]);
    setInput("");
    setFailedInput(null);
    setMode({ kind: "setup" });
  };

  const mySessions = sessions.filter((s) => s.overallScore != null);

  /* ── Setup screen ──────────────────────────────────────────── */
  if (mode.kind === "setup") {
    const pill = (active: boolean): React.CSSProperties => ({
      background: active ? "rgba(217,119,87,0.12)" : "var(--muted)",
      border: active ? "1px solid rgba(217,119,87,0.40)" : "1px solid var(--border)",
      color: active ? "var(--primary)" : "var(--muted-foreground)",
      cursor: "pointer",
    });
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-8" style={{ background: "var(--muted)" }}>
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(217,119,87,0.12)", color: "var(--primary)" }}
            >
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h1
                className="font-display text-xl font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                Negotiation Practice
              </h1>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Roleplay a real salary negotiation against an AI recruiter — then get scored on how
                you did.
              </p>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-4" style={cardStyle}>
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: "var(--muted-foreground)" }}
              >
                Role being negotiated *
              </label>
              <input
                list="negotiation-roles"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="w-full h-11 rounded-xl px-3 text-sm"
                style={{
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <datalist id="negotiation-roles">
                {COMMON_ROLES.map((r) => (
                  <option key={r.value} value={r.value} />
                ))}
              </datalist>
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: "var(--muted-foreground)" }}
              >
                Who you're negotiating with
              </label>
              <div className="flex flex-wrap gap-2">
                {COUNTERPARTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCounterpart(c)}
                    className="h-9 px-4 rounded-lg text-xs font-medium"
                    style={pill(counterpart === c)}
                  >
                    {COUNTERPART_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: "var(--muted-foreground)" }}
              >
                Difficulty
              </label>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className="h-9 px-4 rounded-lg text-xs font-medium"
                    style={pill(difficulty === d)}
                  >
                    {DIFFICULTY_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: "var(--muted-foreground)" }}
              >
                The offer on the table (optional)
              </label>
              <textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                rows={4}
                placeholder="Paste the offer details or describe the situation — e.g. 'Base $150k, $20k bonus, $200k equity/4yr. I'm targeting $170k base.' Leave blank to let the recruiter ask."
                className="w-full rounded-xl p-3 text-sm resize-y"
                style={{
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            <div
              className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
            >
              <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                Recruiter speaks aloud (voice)
              </span>
              <button
                onClick={() => setVoiceOn((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: voiceOn ? "var(--forest)" : "var(--muted-foreground)",
                }}
              >
                {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                {voiceOn ? "On" : "Off"}
              </button>
            </div>

            <button
              onClick={handleStart}
              disabled={!role.trim() || isGenerating}
              className="h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              style={{
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                opacity: !role.trim() || isGenerating ? 0.5 : 1,
                cursor: !role.trim() || isGenerating ? "not-allowed" : "pointer",
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Start negotiation
                </>
              )}
            </button>
          </div>

          {mySessions.length > 0 && (
            <div className="p-5 flex flex-col gap-3" style={cardStyle}>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  Past sessions
                </span>
              </div>
              {mySessions.slice(0, 5).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setMode({ kind: "review", session: s })}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                  style={{
                    background: "var(--muted)",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <span
                    className="font-display text-lg font-semibold"
                    style={{ color: scoreColor(s.overallScore ?? 0) }}
                  >
                    {s.overallScore}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs font-medium truncate"
                      style={{ color: "var(--foreground)" }}
                    >
                      {s.role || "Negotiation"}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Trash2
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--muted-foreground)" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(s.id);
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Review screen ─────────────────────────────────────────── */
  if (mode.kind === "review") {
    const s = mode.session;
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-8" style={{ background: "var(--muted)" }}>
        <div className="max-w-2xl mx-auto flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-1 text-sm"
              style={{
                color: "var(--muted-foreground)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <ArrowLeft className="w-4 h-4" /> New session
            </button>
          </div>

          <div className="p-6 flex flex-col gap-5" style={cardStyle}>
            <div className="flex items-baseline gap-2">
              <span
                className="font-display"
                style={{
                  fontSize: 44,
                  fontWeight: 600,
                  lineHeight: 1,
                  color: scoreColor(s.overallScore ?? 0),
                }}
              >
                {s.overallScore ?? "—"}
              </span>
              <span className="text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>
                /100 overall
              </span>
            </div>
            {s.summary && (
              <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
                {s.summary}
              </p>
            )}

            {s.scores && (
              <div className="flex flex-col gap-3">
                {NEGOTIATION_DIMENSIONS.map((d) => {
                  const v = s.scores![d.key];
                  return (
                    <div key={d.key}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          {d.label}
                          <span
                            className="font-normal"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {" "}
                            · {d.hint}
                          </span>
                        </span>
                        <span className="text-xs font-bold" style={{ color: scoreColor(v) }}>
                          {v}
                        </span>
                      </div>
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ background: "var(--muted)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${v}%`, background: scoreColor(v) }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {s.strengths?.length || s.improvements?.length ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {s.strengths?.length ? (
                <div className="p-4 flex flex-col gap-2" style={cardStyle}>
                  <div
                    className="flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: "var(--forest)" }}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Strengths
                  </div>
                  {s.strengths.map((x, i) => (
                    <p
                      key={i}
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--foreground)" }}
                    >
                      • {x}
                    </p>
                  ))}
                </div>
              ) : null}
              {s.improvements?.length ? (
                <div className="p-4 flex flex-col gap-2" style={cardStyle}>
                  <div
                    className="flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: "var(--primary)" }}
                  >
                    <Lightbulb className="w-4 h-4" /> Work on next
                  </div>
                  {s.improvements.map((x, i) => (
                    <p
                      key={i}
                      className="text-xs leading-relaxed"
                      style={{ color: "var(--foreground)" }}
                    >
                      • {x}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {s.moveFeedback?.length ? (
            <div className="p-5 flex flex-col gap-3" style={cardStyle}>
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Move-by-move feedback
              </span>
              {s.moveFeedback.map((m, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1 pb-3"
                  style={{
                    borderBottom:
                      i < s.moveFeedback!.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase"
                      style={{
                        background:
                          m.rating === "Strong"
                            ? "rgba(47,107,79,0.12)"
                            : m.rating === "Weak"
                              ? "rgba(217,119,87,0.12)"
                              : "rgba(110,101,87,0.10)",
                        color:
                          m.rating === "Strong"
                            ? "var(--forest)"
                            : m.rating === "Weak"
                              ? "var(--primary)"
                              : "var(--muted-foreground)",
                      }}
                    >
                      {m.rating}
                    </span>
                    <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                      {m.move}
                    </span>
                  </div>
                  {m.feedback && (
                    <p
                      className="text-[11px] leading-relaxed pl-1"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {m.feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  /* ── Live screen ───────────────────────────────────────────── */
  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ background: "var(--muted)" }}
    >
      <div
        className="flex items-center justify-between px-4 sm:px-6 py-3"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(217,119,87,0.12)", color: "var(--primary)" }}
          >
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {COUNTERPART_LABELS[counterpart]} · {role}
            </div>
            <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {DIFFICULTY_LABELS[difficulty]} negotiation
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleVoice}
            title={voiceOn ? "Mute recruiter" : "Unmute recruiter"}
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
              color: voiceOn ? "var(--forest)" : "var(--muted-foreground)",
              cursor: "pointer",
            }}
          >
            {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={handleFinish}
            disabled={isScoring || !answered}
            className="h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            style={{
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              opacity: isScoring || !answered ? 0.5 : 1,
              cursor: isScoring || !answered ? "not-allowed" : "pointer",
            }}
          >
            {isScoring ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scoring…
              </>
            ) : (
              <>
                <PhoneOff className="w-3.5 h-3.5" /> End & score
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {messages.slice(1).map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: m.role === "user" ? "var(--foreground)" : "rgba(217,119,87,0.12)",
                  color: m.role === "user" ? "var(--background)" : "var(--primary)",
                }}
              >
                {m.role === "user" ? (
                  <UserIcon className="w-3.5 h-3.5" />
                ) : (
                  <Bot className="w-3.5 h-3.5" />
                )}
              </div>
              <div
                className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                style={{
                  background: m.role === "user" ? "var(--foreground)" : "var(--card)",
                  color: m.role === "user" ? "var(--background)" : "var(--foreground)",
                  border: m.role === "user" ? "none" : "1px solid var(--border)",
                }}
              >
                {m.text ? (
                  m.role === "model" ? (
                    <div className="prose prose-sm max-w-none [&_p]:my-1">
                      <Markdown>{m.text}</Markdown>
                    </div>
                  ) : (
                    m.text
                  )
                ) : (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                )}
              </div>
            </div>
          ))}
          {failedInput && (
            <button
              onClick={retry}
              className="self-center h-9 px-4 rounded-lg text-xs font-semibold"
              style={{
                background: "var(--muted)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      <form
        onSubmit={handleSend}
        className="px-4 sm:px-6 py-3"
        style={{ borderTop: "1px solid var(--border)", background: "var(--card)" }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          {dictation.supported && (
            <button
              type="button"
              onClick={toggleMic}
              title={dictation.listening ? "Stop & send" : "Speak"}
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: dictation.listening ? "var(--primary)" : "var(--muted)",
                border: "1px solid var(--border)",
                color: dictation.listening ? "#fff" : "var(--muted-foreground)",
                cursor: "pointer",
              }}
            >
              {dictation.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={dictation.listening ? "Listening…" : "Type your response…"}
            disabled={isGenerating}
            className="flex-1 h-11 rounded-xl px-3 text-sm"
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          <button
            type="submit"
            disabled={isGenerating || !input.trim()}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              opacity: isGenerating || !input.trim() ? 0.5 : 1,
              cursor: isGenerating || !input.trim() ? "not-allowed" : "pointer",
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
