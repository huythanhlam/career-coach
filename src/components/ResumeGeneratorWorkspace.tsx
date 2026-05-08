import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Download, Save, Edit3, FileText, Send, Sparkles } from "lucide-react";
import Markdown from "react-markdown";
import { createTechCoachChat, sendMessageStream } from "@/services/geminiService";
import { workflowsConfig } from "@/config/workflows";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Chat = any;
import { ResumeRenderer } from "./ResumeRenderer";

interface Message {
  role: "user" | "model";
  text: string;
}

interface ResumeGeneratorWorkspaceProps {
  initialFormData: Record<string, any>;
  onReset: () => void;
}

export function ResumeGeneratorWorkspace({ initialFormData, onReset }: ResumeGeneratorWorkspaceProps) {
  const [resumeText, setResumeText] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "">("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInstance, setChatInstance] = useState<Chat | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const initChat = async () => {
      const config = workflowsConfig["resume_generation"];
      const newChat = createTechCoachChat(
        config.systemInstruction + "\n\nCRITICAL INSTRUCTION: When you provide the resume, wrap it ENTIRELY in ```markdown\n[your resume content]\n``` block so the system can parse it into the editor. If you are just answering a question, do not use the markdown block unless you want to update the resume.",
        config.enableSearch
      );
      if (mounted) setChatInstance(newChat);

      const prompt = config.generatePrompt(initialFormData);

      if (mounted) {
        setMessages([
          { role: "user", text: "Please generate my resume based on my details." },
          { role: "model", text: "" }
        ]);

        try {
          let fullText = "";
          await sendMessageStream(newChat, prompt as string, (chunk) => {
            fullText += chunk;
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1].text = fullText;
              return newMessages;
            });
            const markdownMatch = fullText.match(/```(?:markdown|md)?\s*([\s\S]*?)(?:```|$)/);
            if (markdownMatch && markdownMatch[1]) {
              setResumeText(markdownMatch[1].trim());
            } else if (fullText.trim().length > 100 && !fullText.includes("```")) {
              setResumeText(fullText.trim());
            }
          });
        } catch (error) {
          console.error("Error generating initial resume:", error);
        } finally {
          setIsGenerating(false);
        }
      }
    };
    initChat();
    return () => { mounted = false; };
  }, [initialFormData]);

  useEffect(() => {
    if (messages.length > 0 && !isGenerating) {
      const lastModelMessage = messages.filter(m => m.role === "model").pop();
      if (lastModelMessage) {
        const text = lastModelMessage.text;
        const markdownMatch = text.match(/```(?:markdown|md)?\s*([\s\S]*?)```/);
        if (markdownMatch && markdownMatch[1]) {
          setResumeText(markdownMatch[1].trim());
        } else if (!resumeText && text.trim().length > 100) {
          setResumeText(text.trim());
        }
      }
    }
  }, [messages, isGenerating]);

  useEffect(() => {
    if (!resumeText) return;
    setSaveStatus("saving");
    const timer = setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resumeText]);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const [activeTab, setActiveTab] = useState<"editor" | "assistant">("assistant");
  const [targetText, setTargetText] = useState("");

  const handleChatSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const textToSend = overrideText || chatInput.trim();
    if (!textToSend || !chatInstance || isGenerating) return;

    setChatInput("");
    setIsGenerating(true);

    const targetContext = targetText.trim() ? `\nTarget Text to modify: "${targetText}"` : "";
    const internalPrompt = `User Request: ${textToSend}${targetContext}\n\nHere is my current resume text in case you need to edit it:\n\n${resumeText}\n\nPlease apply the edits and provide the full updated resume in a \`\`\`markdown\`\`\` block.`;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: textToSend + (targetText ? ` (Target: ${targetText})` : "") },
      { role: "model", text: "" }
    ]);

    try {
      let fullText = "";
      await sendMessageStream(chatInstance, internalPrompt, (chunk) => {
        fullText += chunk;
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text = fullText;
          return newMessages;
        });
        const markdownMatch = fullText.match(/```(?:markdown|md)?\s*([\s\S]*?)(?:```|$)/);
        if (markdownMatch && markdownMatch[1]) setResumeText(markdownMatch[1].trim());
      });
    } catch (error) {
      console.error(error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].text += "\n\n**Error:** Failed to generate response.";
        return newMessages;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = () => window.print();

  const handleExportDocx = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Resume</title></head><body>";
    const footer = "</body></html>";
    const src = header + "<pre style='font-family: Arial,sans-serif; white-space:pre-wrap;'>" + resumeText.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</pre>" + footer;
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = "data:application/vnd.ms-word;charset=utf-8," + encodeURIComponent(src);
    a.download = "resume.doc";
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col h-full w-full absolute inset-0 z-50 overflow-hidden" style={{ background: "var(--muted)" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 shrink-0 print:hidden"
        style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(217,119,87,0.10)", color: "var(--primary)" }}>
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="font-display text-sm font-semibold" style={{ color: "var(--foreground)" }}>Resume Builder</div>
            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {saveStatus === "saving" && <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>}
              {saveStatus === "saved" && <span className="flex items-center gap-1" style={{ color: "var(--forest)" }}><Save className="w-3 h-3" /> Saved</span>}
              {saveStatus === "" && "Draft"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 pr-3 mr-1" style={{ borderRight: "1px solid var(--border)" }}>
            <button onClick={handleExportDocx} style={{ height: 36, padding: "0 14px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--foreground)" }}>
              <Download className="w-3.5 h-3.5" /> DOCX
            </button>
            <button onClick={handleExportPDF} style={{ height: 36, padding: "0 14px", background: "var(--primary)", border: "1px solid var(--primary)", borderRadius: 10, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#FFF" }}>
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
          <button onClick={onReset} style={{ height: 36, padding: "0 14px", background: "transparent", border: "none", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--muted-foreground)" }}>
            Exit
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left mini toolbar */}
        <div className="w-16 flex flex-col items-center py-6 gap-6 shrink-0 print:hidden"
          style={{ background: "var(--foreground)" }}>
          {[
            { id: "assistant" as const, icon: Sparkles, label: "Coach" },
            { id: "editor" as const, icon: Edit3, label: "Editor" },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", background: "transparent", border: "none" }}>
              <div style={{ padding: 12, borderRadius: 12, background: activeTab === id ? "rgba(217,119,87,0.20)" : "transparent", color: activeTab === id ? "var(--primary)" : "rgba(251,247,241,0.45)", transition: "all 0.2s" }}>
                <Icon className="w-5 h-5" />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: activeTab === id ? "var(--primary)" : "rgba(251,247,241,0.4)", letterSpacing: "0.05em" }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Resume canvas */}
        <div className="flex-1 overflow-y-auto no-scrollbar flex justify-center py-10 px-4 sm:px-8 print:p-0"
          style={{ background: "var(--muted)" }}>
          <div className="w-full max-w-[850px] min-h-[1100px] p-10 sm:p-14 shrink-0 print:shadow-none print:m-0 print:p-0"
            style={{ background: "var(--card)", boxShadow: "0 4px 25px rgba(0,0,0,0.06)" }}>
            {resumeText ? (
              <ResumeRenderer markdownContent={resumeText} templateType={initialFormData.template || "Modern & Clean"} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center min-h-[500px]" style={{ color: "var(--muted-foreground)" }}>
                <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: "var(--primary)" }} />
                <p className="font-medium">Generating your resume…</p>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-full lg:w-[420px] flex flex-col shrink-0 print:hidden"
          style={{ background: "var(--card)", borderLeft: "1px solid var(--border)" }}>

          {activeTab === "editor" ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-2 px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)", fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                <Edit3 className="w-4 h-4" style={{ color: "var(--primary)" }} />
                Raw Editor
              </div>
              <Textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                className="flex-1 border-0 focus-visible:ring-0 p-5 resize-none rounded-none font-mono text-xs leading-relaxed"
                style={{ background: "var(--card)", color: "var(--foreground)" }}
                placeholder="Markdown formatted resume text will appear here…"
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-2 px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)", fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
                AI Assistant
              </div>
              <div className="flex-1 overflow-y-auto p-4" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {messages.filter(m => m.text).map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "85%", borderRadius: 18, padding: "10px 14px",
                      background: msg.role === "user" ? "var(--primary)" : "var(--muted)",
                      color: msg.role === "user" ? "#FFF" : "var(--foreground)",
                    }}>
                      <div className="prose prose-sm max-w-none" style={{ color: "inherit" }}>
                        <Markdown>
                          {msg.text.includes("```markdown") ? msg.text.replace(/```(?:markdown|md)?\s*([\s\S]*?)```/g, "*(Updated the resume)*") : msg.text}
                        </Markdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isGenerating && (!messages.length || messages[messages.length - 1].role !== "model" || !messages[messages.length - 1].text) && (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{ background: "var(--muted)", borderRadius: 18, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted-foreground)" }}>
                      <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
              <div style={{ padding: 16, borderTop: "1px solid var(--border)", background: "var(--muted)" }}>
                <form onSubmit={handleChatSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", marginLeft: 4, display: "block", marginBottom: 4 }}>Target Bullet/Section (Optional)</label>
                    <Input
                      placeholder="e.g. 3rd bullet in Customer Service"
                      value={targetText}
                      onChange={(e) => setTargetText(e.target.value)}
                      style={{ height: 36, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                    <Textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask AI to refine or rewrite…"
                      className="min-h-[44px] max-h-32 resize-y"
                      style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, flex: 1, padding: "10px 12px" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isGenerating}
                      style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary)", border: "none", color: "#FFF", cursor: chatInput.trim() && !isGenerating ? "pointer" : "not-allowed", opacity: !chatInput.trim() || isGenerating ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
