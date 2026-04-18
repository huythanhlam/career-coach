import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download, Save, Edit3, FileText } from "lucide-react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { createTechCoachChat, sendMessageStream } from "@/services/geminiService";
import { workflowsConfig } from "@/config/workflows";
import type { Chat } from "@google/genai";

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
          await sendMessageStream(newChat, prompt as string, (chunk) => {
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1].text += chunk;
              return newMessages;
            });
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

  const handleChatSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const textToSend = overrideText || chatInput.trim();
    
    if (!textToSend || !chatInstance || isGenerating) return;

    setChatInput("");
    setIsGenerating(true);

    // Provide the current resume state so the AI can modify it.
    const internalPrompt = `User Request: ${textToSend}\n\nHere is my current resume text in case you need to edit it:\n\n${resumeText}\n\nPlease apply the edits and provide the full updated resume in a \`\`\`markdown\`\`\` block.`;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: textToSend },
      { role: "model", text: "" }
    ]);

    try {
      await sendMessageStream(chatInstance, internalPrompt, (chunk) => {
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text += chunk;
          return newMessages;
        });
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
        <div className="flex-1 overflow-y-auto bg-[#f3f4f6] dark:bg-zinc-900 relative flex justify-center py-10 px-4 sm:px-8 print:bg-white print:p-0 print:overflow-visible">
           <div className="bg-white dark:bg-zinc-950 shadow-[0_4px_25px_rgba(0,0,0,0.06)] dark:shadow-none dark:border w-full max-w-[850px] min-h-[1100px] p-10 sm:p-14 shrink-0 print:shadow-none print:border-0 print:m-0 print:p-0 transition-all">
             {resumeText ? (
               <div className="prose prose-zinc dark:prose-invert max-w-none prose-sm">
                 <Markdown rehypePlugins={[rehypeRaw]}>{resumeText}</Markdown>
               </div>
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-zinc-400 min-h-[500px]">
                 <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                 <p className="font-medium">Generating your structured resume...</p>
               </div>
             )}
           </div>
        </div>

        {/* Right Sidebar: Resume Editor */}
        <div className="w-full lg:w-[420px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col z-20 shrink-0 print:hidden">
           <div className="flex-1 flex flex-col min-h-0">
              <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 flex justify-between items-center shrink-0">
                 <h3 className="font-semibold text-sm flex items-center text-zinc-800 dark:text-zinc-200">
                   <Edit3 className="w-4 h-4 mr-2 text-zinc-500" />
                   Resume Editor
                 </h3>
              </div>
              <Textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                className="flex-1 border-0 focus-visible:ring-0 p-5 resize-none rounded-none font-mono text-xs leading-relaxed bg-white dark:bg-zinc-950"
                placeholder="Markdown formatted resume text will appear here..."
              />
           </div>
        </div>

      </div>
    </div>
  );
}
