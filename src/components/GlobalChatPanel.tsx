import React, { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, User, Send, X, MessageSquare, Loader2, Sparkles } from "lucide-react";
import Markdown from "react-markdown";
import { cn } from "@/lib/utils";
import { createTechCoachChat, sendMessageStream } from "@/services/geminiService";
import { workflowsConfig } from "@/config/workflows";
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
  const systemInstruction = workflowConfig?.systemInstruction || "You are TechCoach AI, a professional career coach.";

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
    <div className="w-[400px] h-full bg-card border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 z-50">
      {/* Header */}
      <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground uppercase tracking-tight italic">Coach Intelligence</h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
              Active Context: {workflowConfig?.title || "Global"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-secondary">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-8 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center text-primary/30">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                 <h4 className="font-bold text-foreground text-sm uppercase">Mission Briefing</h4>
                 <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                   I am monitoring your current workspace. Ask me anything about your career strategy.
                 </p>
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex gap-4", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                msg.role === "user" 
                  ? "bg-secondary border-border text-foreground" 
                  : "bg-primary/10 border-primary/20 text-primary"
              )}>
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={cn(
                "max-w-[85%] rounded-[1.5rem] px-5 py-4 text-sm leading-relaxed",
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground font-medium rounded-tr-none shadow-lg shadow-primary/10" 
                  : "bg-secondary/50 border border-border text-foreground rounded-tl-none"
              )}>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Markdown>{msg.text}</Markdown>
                  {msg.role === "model" && !msg.text && (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
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
      <div className="p-6 border-t border-border bg-card">
        {workflowConfig?.suggestedPrompts && messages.length < 2 && (
           <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
              {workflowConfig.suggestedPrompts.slice(0, 3).map((p, i) => (
                <button 
                  key={i} 
                  onClick={() => handleSend(undefined, p)}
                  className="whitespace-nowrap px-4 py-2 rounded-full bg-secondary border border-border text-[10px] font-bold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all uppercase tracking-wider"
                >
                  {p}
                </button>
              ))}
           </div>
        )}
        <form onSubmit={handleSend} className="relative group">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="TYPE MISSION COMMAND..."
            className="h-14 bg-secondary/50 border-border rounded-2xl px-6 pr-14 text-xs font-bold text-foreground placeholder:text-muted-foreground/50 focus:ring-primary/20 transition-all"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isGenerating || !input.trim()}
            className="absolute right-2 top-2 w-10 h-10 rounded-xl bg-primary text-primary-foreground hover:scale-105 transition-transform shadow-lg shadow-primary/20"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-center gap-2 opacity-50">
           <Sparkles className="w-3 h-3 text-primary" />
           <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">Neural Engine Secured</span>
        </div>
      </div>
    </div>
  );
}
