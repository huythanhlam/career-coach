import React, { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X, MessageSquare, Loader2, Sparkles, Trash2, RotateCcw } from "lucide-react";
import Markdown from "react-markdown";
import { cn } from "@/lib/utils";
import { streamWorkflow } from "@/ai/client";
import { coachingChatWorkflow } from "@/ai/workflows/coachingChat";
import { createConversation } from "@/ai/conversation";
import { workflowsConfig, basePersona } from "@/config/workflows";
import { ViewId } from "@/components/Sidebar";
import { useUserProfile } from "@/context/UserProfileContext";
import { useJobPostings } from "@/hooks/useJobPostings";
import { assembleCoachContext } from "@/ai/coach/context";
import { topMemories, type UserMemory } from "@/services/coachMemory";

interface Message {
  role: "user" | "model";
  text: string;
}

interface GlobalChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: ViewId;
}

const CHAT_STORAGE_KEY = "coachChatHistory";
// Durable conversation id (ai_conversations) reused across reloads so the
// gateway keeps appending to the same conversation.
const CONVO_STORAGE_KEY = "coachConversationId";
const CHAT_HISTORY_LIMIT = 40; // turns kept across reloads

function restoreMessages(): Message[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is Message =>
        m &&
        (m.role === "user" || m.role === "model") &&
        typeof m.text === "string" &&
        m.text !== "",
    );
  } catch {
    return [];
  }
}

export function GlobalChatPanel({ isOpen, onClose, activeView }: GlobalChatPanelProps) {
  const { profile } = useUserProfile();
  const { postings } = useJobPostings();
  const [messages, setMessages] = useState<Message[]>(restoreMessages);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [failedInput, setFailedInput] = useState<string | null>(null);
  // Top-k durable coach memories, fetched once when the panel opens and injected
  // into every turn's context (Coach OS / F1). Best-effort — never blocks chat.
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Durable conversation id; created lazily on the first send, then reused.
  const conversationIdRef = useRef<string | null>(
    (() => {
      try {
        return localStorage.getItem(CONVO_STORAGE_KEY);
      } catch {
        return null;
      }
    })(),
  );
  // Cancels an in-flight stream on clear/unmount (real AbortController).
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Persist the conversation so a refresh doesn't lose it. Skipped while
  // streaming to avoid a write per chunk.
  useEffect(() => {
    if (isGenerating) return;
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-CHAT_HISTORY_LIMIT)));
    } catch {
      // storage full/unavailable — losing chat persistence is acceptable
    }
  }, [messages, isGenerating]);

  const clearConversation = () => {
    abortRef.current?.abort();
    setMessages([]);
    setFailedInput(null);
    conversationIdRef.current = null;
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.removeItem(CONVO_STORAGE_KEY);
    } catch {}
  };

  const workflowConfig = workflowsConfig[activeView as any];
  const systemInstruction = workflowConfig?.systemInstruction || basePersona;

  const initials =
    (profile.preferredName || profile.fullName || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "You";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Load the coach's durable memories once the panel opens. Fail-soft: an empty
  // list just means the coach falls back to profile/pipeline context only.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    topMemories().then((m) => {
      if (!cancelled) setMemories(m);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Ground every turn in what the app already knows — profile, pipeline, scores,
  // and durable memories — so the coach advises on the user's actual situation
  // instead of asking for context they've already given.
  const buildContextualInstruction = () =>
    assembleCoachContext({ systemInstruction, profile, postings, memories });

  // Stream a model reply to `text` (the trailing empty model bubble is already
  // in place). `history` is the transcript BEFORE this turn — the coach workflow
  // replays it for context, and the gateway persists the turn to the durable
  // conversation. On failure, leave a calm message and remember `text` so the
  // user can retry the same turn without retyping.
  const streamReply = async (text: string, history: Message[]) => {
    setIsGenerating(true);
    setFailedInput(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Create the durable conversation lazily on the first send, then reuse it.
      if (!conversationIdRef.current) {
        const id = await createConversation(coachingChatWorkflow.id);
        if (id) {
          conversationIdRef.current = id;
          try {
            localStorage.setItem(CONVO_STORAGE_KEY, id);
          } catch {}
        }
      }

      await streamWorkflow(
        coachingChatWorkflow,
        { systemInstruction: buildContextualInstruction(), history, message: text },
        {
          signal: controller.signal,
          conversationId: conversationIdRef.current ?? undefined,
          userMessage: text,
          onToken: (delta) => {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last.role === "model") {
                return [...prev.slice(0, -1), { ...last, text: last.text + delta }];
              }
              return prev;
            });
          },
        },
      );
    } catch (err) {
      // A user-initiated cancel leaves the partial reply in place, no error.
      if (controller.signal.aborted) return;
      console.error(err);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "model",
          text: "I couldn't reach the AI just now. No worries — tap Retry to try again.",
        },
      ]);
      setFailedInput(text);
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const text = overrideText || input.trim();
    if (!text || isGenerating) return;

    const history = messages; // transcript before this turn
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }, { role: "model", text: "" }]);
    await streamReply(text, history);
  };

  // Re-attempt the last failed turn: swap the error bubble for a fresh empty one
  // and stream again, without re-adding the user's message. The trailing two
  // entries (the user turn + the error bubble) aren't part of the replay history.
  const retry = async () => {
    if (!failedInput || isGenerating) return;
    const text = failedInput;
    const history = messages.slice(0, -2);
    setMessages((prev) => [...prev.slice(0, -1), { role: "model", text: "" }]);
    await streamReply(text, history);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 w-full md:static md:inset-auto md:w-[400px] h-full border-l border-border flex flex-col shadow-xl animate-in slide-in-from-right duration-300 z-50"
      style={{ background: "var(--card)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 border-b border-border"
        style={{ padding: "14px 18px", background: "var(--muted)" }}
      >
        <div className="flex items-center gap-3">
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
            <div
              className="text-[10px] font-semibold"
              aria-live="polite"
              style={{ color: "var(--forest)" }}
            >
              ● {isGenerating ? "Thinking…" : "AI coach"} · {workflowConfig?.title || "All tools"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearConversation}
              disabled={isGenerating}
              aria-label="Clear conversation"
              title="Clear conversation"
              className="rounded-full hover:bg-muted w-8 h-8"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close coach panel"
            className="rounded-full hover:bg-muted w-8 h-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" style={{ padding: "18px" }}>
        <div
          className="space-y-4 pb-4"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="Coach conversation"
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "rgba(217,119,87,0.08)", color: "rgba(217,119,87,0.35)" }}
              >
                <MessageSquare className="w-7 h-7" />
              </div>
              <div>
                <div className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                  Hey, I'm your coach 👋
                </div>
                <p
                  className="text-xs leading-relaxed max-w-[200px] mx-auto"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  I know your profile, your pipeline, and this workspace. Ask me anything about your
                  strategy.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-3 items-end",
                msg.role === "user" ? "flex-row-reverse" : "flex-row",
              )}
            >
              <div
                className={cn(
                  "w-[34px] h-[34px] rounded-xl flex items-center justify-center shrink-0 border text-xs font-semibold",
                  msg.role === "user"
                    ? "border-border text-foreground"
                    : "border-primary/20 text-primary",
                )}
                style={{
                  background: msg.role === "user" ? "var(--muted)" : "rgba(217,119,87,0.10)",
                }}
              >
                {msg.role === "user" ? initials : <Sparkles className="w-3.5 h-3.5" />}
              </div>
              <div
                className={cn(
                  "max-w-[80%] rounded-[18px] px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "rounded-tr-[4px] text-white"
                    : "rounded-tl-[4px] border border-border",
                )}
                style={{
                  background: msg.role === "user" ? "var(--primary)" : "var(--card)",
                  color: msg.role === "user" ? "#FFF" : "var(--foreground)",
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
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border" style={{ padding: 12, background: "var(--muted)" }}>
        {workflowConfig?.suggestedPrompts && messages.length < 2 && (
          <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
            {workflowConfig.suggestedPrompts.slice(0, 3).map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(undefined, p)}
                className="whitespace-nowrap px-3 py-1.5 rounded-full border border-border text-[11px] font-medium transition-colors hover:border-primary/40"
                style={{
                  background: "var(--card)",
                  color: "var(--muted-foreground)",
                  fontFamily: "inherit",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 rounded-[14px] border border-border"
          style={{ background: "var(--card)", padding: "8px 8px 8px 14px" }}
        >
          <Sparkles
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: "var(--muted-foreground)" }}
          />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the coach…"
            aria-label="Message the coach"
            className="flex-1 h-9 border-0 bg-transparent text-sm outline-none shadow-none focus-visible:ring-0 p-0"
            style={{ color: "var(--foreground)" }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isGenerating || !input.trim()}
            aria-label="Send message"
            className="w-9 h-9 rounded-[10px] flex-shrink-0"
            style={{ background: "var(--primary)", color: "#FFF", border: "none" }}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
