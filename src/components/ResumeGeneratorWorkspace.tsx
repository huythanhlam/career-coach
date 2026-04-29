import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Download, Save, Edit3, FileText, Send, Sparkles, MessageSquare } from "lucide-react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { createTechCoachChat, sendMessageStream } from "@/services/geminiService";
import { workflowsConfig } from "@/config/workflows";
import type { Chat } from "@google/genai";
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
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "">("");
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInstance, setChatInstance] = useState<Chat | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize the chat and generate the first draft
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

    return () => {
      mounted = false;
    };
  }, [initialFormData]);

  // Parse out resume text from AI messages
  useEffect(() => {
    if (messages.length > 0 && !isGenerating) {
      const lastModelMessage = messages.filter(m => m.role === "model").pop();
      if (lastModelMessage) {
        const text = lastModelMessage.text;
        const markdownMatch = text.match(/```(?:markdown|md)?\s*([\s\S]*?)```/);
        if (markdownMatch && markdownMatch[1]) {
          setResumeText(markdownMatch[1].trim());
        } else if (!resumeText && text.trim().length > 100) {
          // Fallback if the model forgot the markdown block for the first big generation
          setResumeText(text.trim());
        }
      }
    }
  }, [messages, isGenerating]);


  // Auto-save edited resume text
  useEffect(() => {
    if (!resumeText) return;
    setSaveStatus("saving");
    const timer = setTimeout(() => {
      // We could use localStorage, but for now just visual feedback
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resumeText]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        if (markdownMatch && markdownMatch[1]) {
          setResumeText(markdownMatch[1].trim());
        }
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

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportDocx = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML to Word Document with JavaScript</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + "<pre style='font-family: Arial, sans-serif; white-space: pre-wrap;'>" + resumeText.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</pre>" + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'resume.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-100 dark:bg-zinc-950 absolute inset-0 z-50 overflow-hidden font-sans">
      {/* Header Toolbar */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 py-3 shrink-0 shadow-sm z-20 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-md text-white shadow-sm">
            <FileText className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100 leading-tight">Resume Builder</h2>
            <div className="flex items-center text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {saveStatus === "saving" && <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving...</>}
              {saveStatus === "saved" && <><Save className="w-3 h-3 mr-1 text-green-600" /> <span className="text-green-600">Saved</span></>}
              {saveStatus === "" && <span>Draft</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex space-x-2 border-r border-zinc-200 dark:border-zinc-800 pr-3 mr-1">
             <Button variant="outline" size="sm" onClick={handleExportDocx} className="h-9">
               <Download className="w-4 h-4 mr-2" /> DOCX
             </Button>
             <Button variant="default" size="sm" onClick={handleExportPDF} className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
               <Download className="w-4 h-4 mr-2" /> PDF
             </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={onReset} className="h-9 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300">
            Exit
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Mini Sidebar (Canva Style Toolbar) */}
        <div className="w-16 bg-zinc-950 dark:bg-zinc-900 flex flex-col items-center py-6 gap-6 z-10 shrink-0 print:hidden">
           <div className="group flex flex-col items-center gap-1 cursor-pointer text-indigo-400">
             <div className="p-3 rounded-xl bg-zinc-800 text-indigo-400">
               <Edit3 className="w-5 h-5" />
             </div>
             <span className="text-[10px] font-medium tracking-wider">Edit</span>
           </div>
           {/* Future items could go here like Settings, Templates, etc. */}
        </div>

        {/* Center Canvas Area */}
        <div className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/50 relative flex justify-center py-10 px-4 sm:px-8 print:bg-white print:p-0 print:overflow-visible custom-scrollbar">
           <div className="bg-white dark:bg-zinc-950 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-black/[0.04] dark:border-white/[0.04] w-full max-w-[850px] min-h-[1100px] p-10 sm:p-14 shrink-0 print:shadow-none print:border-0 print:m-0 print:p-0 transition-all">
             {resumeText ? (
               <ResumeRenderer markdownContent={resumeText} templateType={initialFormData.template || "Modern & Clean"} />
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-zinc-400 min-h-[500px]">
                 <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                 <p className="font-medium">Generating your structured resume...</p>
               </div>
             )}
           </div>
        </div>

        {/* Right Sidebar: Resume Editor & Assistant */}
        <div className="w-full lg:w-[420px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col z-20 shrink-0 print:hidden">
           <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 shrink-0">
             <button
               className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "assistant" ? "border-indigo-600 text-indigo-700 dark:text-indigo-400" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"}`}
               onClick={() => setActiveTab("assistant")}
             >
               <div className="flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> AI Assistant</div>
             </button>
             <button
               className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "editor" ? "border-indigo-600 text-indigo-700 dark:text-indigo-400" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"}`}
               onClick={() => setActiveTab("editor")}
             >
               <div className="flex items-center justify-center gap-2"><Edit3 className="w-4 h-4" /> Raw Editor</div>
             </button>
           </div>
           
           {activeTab === "editor" ? (
             <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950">
               <Textarea
                 value={resumeText}
                 onChange={(e) => setResumeText(e.target.value)}
                 className="flex-1 border-0 focus-visible:ring-0 p-5 resize-none rounded-none font-mono text-xs leading-relaxed bg-transparent"
                 placeholder="Markdown formatted resume text will appear here..."
               />
             </div>
           ) : (
             <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950">
               <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {messages.filter(m => m.text).map((msg, i) => (
                   <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                     <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${msg.role === "user" ? "bg-indigo-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"}`}>
                       <div className="prose dark:prose-invert prose-sm max-w-none text-current">
                         <Markdown>
                           {msg.text.includes("```markdown") ? msg.text.replace(/```(?:markdown|md)?\s*([\s\S]*?)```/g, "*(Updated the resume text)*") : msg.text}
                         </Markdown>
                       </div>
                     </div>
                   </div>
                 ))}
                 {isGenerating && (!messages.length || messages[messages.length - 1].role !== "model" || !messages[messages.length - 1].text) && (
                   <div className="flex justify-start">
                     <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-2 text-zinc-500 text-sm">
                       <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                     </div>
                   </div>
                 )}
                 <div ref={scrollRef} />
               </div>
               <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                 <form onSubmit={handleChatSubmit} className="space-y-3">
                   <div className="space-y-1">
                     <label className="text-xs font-semibold text-zinc-500 ml-1">Target Bullet/Section (Optional)</label>
                     <Input 
                        placeholder="e.g. 3rd bullet in Customer Service" 
                        value={targetText}
                        onChange={(e) => setTargetText(e.target.value)}
                        className="h-9 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                     />
                   </div>
                   <div className="flex items-end gap-2">
                     <Textarea
                       value={chatInput}
                       onChange={(e) => setChatInput(e.target.value)}
                       placeholder="Ask AI to refine or rewrite..."
                       className="min-h-[44px] max-h-32 resize-y bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 py-2.5"
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' && !e.shiftKey) {
                           e.preventDefault();
                           handleChatSubmit();
                         }
                       }}
                     />
                     <Button type="submit" size="icon" disabled={!chatInput.trim() || isGenerating} className="shrink-0 h-11 w-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                       <Send className="w-5 h-5" />
                     </Button>
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
