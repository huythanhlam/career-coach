import React, { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, User, Send, X, MessageSquare, Loader2, Sparkles } from "lucide-react";
import Markdown from "react-markdown";
import { cn } from "@/lib/utils";
import { createTechCoachChat, sendMessageStream } from "@/services/geminiService";
import { workflowsConfig, basePersona } from "@/config/workflows";
import { ViewId } from "@/components/Sidebar";

interface Message {
  role: "user" | "model";
  text: string;
}

interface GlobalChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: ViewId;
}

export function GlobalChatPanel({ isOpen, onClose, activeView }: GlobalChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatInstance, setChatInstance] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const workflowConfig = workflowsConfig[activeView as any];
  const systemInstruction = workflowConfig?.systemInstruction || basePersona;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const text = overrideText || input.trim();
    if (!text || isGenerating) return;

    setInput("");
    setIsGenerating(true);

    const newMessages: Message[] = [...messages, { role: "user", text }];
    setMessages([...newMessages, { role: "model", text: "" }]);

    try {
      let currentChat = chatInstance;
      if (!currentChat) {
        currentChat = createTechCoachChat(systemInstruction, true);
        setChatInstance(currentChat);
      }

      await sendMessageStream(currentChat, text, (chunk) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last.role === "model") {
            return [...prev.slice(0, -1), { ...last, text: last.text + chunk }];
          }
          return prev;
        });
      });
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "model", text: "**Error:** Failed to connect to AI. Ensure server is running." }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-[400px] h-full border-l border-border flex flex-col shadow-xl animate-in slide-in-from-right duration-300 z-50"
      style={{ background: "var(--card)" }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border"
        style={{ padding: "14px 18px", background: "var(--muted)" }}>
        <div className="flex items-center gap-3">
          <div className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center border"
            style={{ background: "rgba(217,119,87,0.10)", borderColor: "rgba(217,119,87,0.25)", color: "var(--primary)" }}>
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>The Coach</div>
            <div className="text-[10px] font-semibold" style={{ color: "var(--forest)" }}>
              ● Listening · {workflowConfig?.title || "All tools"}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted w-8 h-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" style={{ padding: "18px" }}>
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "rgba(217,119,87,0.08)", color: "rgba(217,119,87,0.35)" }}>
                <MessageSquare className="w-7 h-7" />
              </div>
              <div>
                <div className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                  Hey, I'm your coach 👋
                </div>
                <p className="text-xs leading-relaxed max-w-[200px] mx-auto" style={{ color: "var(--muted-foreground)" }}>
                  I'm watching your current workspace. Ask me anything about your strategy.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex gap-3 items-end", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              <div className={cn(
                "w-[34px] h-[34px] rounded-xl flex items-center justify-center shrink-0 border text-xs font-semibold",
                msg.role === "user"
                  ? "border-border text-foreground"
                  : "border-primary/20 text-primary"
              )} style={{ background: msg.role === "user" ? "var(--muted)" : "rgba(217,119,87,0.10)" }}>
                {msg.role === "user" ? "HL" : <Sparkles className="w-3.5 h-3.5" />}
              </div>
              <div className={cn(
                "max-w-[80%] rounded-[18px] px-4 py-3 text-sm leading-relaxed",
                msg.role === "user"
                  ? "rounded-tr-[4px] text-white"
                  : "rounded-tl-[4px] border border-border"
              )} style={{
                background: msg.role === "user" ? "var(--primary)" : "var(--card)",
                color: msg.role === "user" ? "#FFF" : "var(--foreground)",
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
                style={{ background: "var(--card)", color: "var(--muted-foreground)", fontFamily: "inherit" }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-2 rounded-[14px] border border-border"
          style={{ background: "var(--card)", padding: "8px 8px 8px 14px" }}>
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the coach…"
            className="flex-1 h-9 border-0 bg-transparent text-sm outline-none shadow-none focus-visible:ring-0 p-0"
            style={{ color: "var(--foreground)" }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isGenerating || !input.trim()}
            className="w-9 h-9 rounded-[10px] flex-shrink-0"
            style={{ background: "var(--primary)", color: "#FFF", border: "none" }}
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
