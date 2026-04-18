import { useState, useRef, useEffect } from "react";
import { WorkflowId } from "@/components/Sidebar";
import { workflowsConfig } from "@/config/workflows";
import { createTechCoachChat, sendMessageStream, analyzeResume } from "@/services/geminiService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, Send, User, Bot, FileText, Link as LinkIcon, ChevronLeft, ChevronRight, X, MessageCircle } from "lucide-react";
import Markdown from "react-markdown";
import type { Chat } from "@google/genai";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ResumeWorkspace } from "@/components/ResumeWorkspace";
import { ResumeGeneratorWorkspace } from "@/components/ResumeGeneratorWorkspace";
import { ResumeGenerationForm } from "@/components/ResumeGenerationForm";
import { MarketCompensationViz, MarketCompData } from "@/components/MarketCompensationViz";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Message {
  role: "user" | "model";
  text: string;
}

interface FileData {
  data: string;
  mimeType: string;
  objectUrl: string;
  name: string;
}

interface WorkflowViewProps {
  workflowId: WorkflowId;
}

export function WorkflowView({ workflowId }: WorkflowViewProps) {
  const config = workflowsConfig[workflowId];
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [fileData, setFileData] = useState<Record<string, FileData>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInstance, setChatInstance] = useState<Chat | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Resume Workspace State
  const [resumeWorkspaceData, setResumeWorkspaceData] = useState<{ resumeText: string; annotations: any[] } | null>(null);

  // Resume Generator State
  const [resumeGeneratorData, setResumeGeneratorData] = useState<Record<string, any> | null>(null);

  const tryParseMarketData = (text: string): MarketCompData | null => {
    try {
      const match = text.match(/```json\s*([\s\S]*?)\s*(?:```|$)/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1]);
        if (parsed.locations && Array.isArray(parsed.locations)) return parsed;
      }
    } catch (e) {
      // ignore parsing errors
    }
    return null;
  };

  // Market Workflow State
  const [marketData, setMarketData] = useState<MarketCompData | null>(null);
  const [isGeneratingMarketData, setIsGeneratingMarketData] = useState(false);

  // PDF state
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);

  // Standard Text Workflows State
  const [mainDocumentText, setMainDocumentText] = useState("");

  // Use a key to force re-render when workflowId changes
  const key = workflowId;

  // Auto-scroll chat
  useEffect(() => {
    if (isChatOpen) {
      scrollToBottom();
    }
  }, [messages, isChatOpen]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleInputChange = (id: string, value: string) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleFileChange = async (id: string, file: File | null) => {
    if (!file) {
      setFileData((prev) => {
        const next = { ...prev };
        if (next[id]?.objectUrl) URL.revokeObjectURL(next[id].objectUrl);
        delete next[id];
        return next;
      });
      setFormData((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      const newFileData = {
        data: base64,
        mimeType: file.type,
        objectUrl,
        name: file.name
      };
      
      setFileData((prev) => ({ ...prev, [id]: newFileData }));
      setFormData((prev) => ({ ...prev, [id]: newFileData }));
    };
    
    reader.readAsDataURL(file);
  };

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating || isGeneratingMarketData) return;

    if (workflowId === "market") {
      setIsGeneratingMarketData(true);
      const prompt = config.generatePrompt(formData);
      const newChat = createTechCoachChat(config.systemInstruction, config.enableSearch);
      setChatInstance(newChat);
      
      try {
        let fullResponse = "";
        await sendMessageStream(newChat, prompt as string, (chunk) => {
          fullResponse += chunk;
        });
        const parsed = tryParseMarketData(fullResponse);
        if (parsed) {
          setMarketData(parsed);
          setMessages([
            { role: "model", text: "I've published the market compensation data directly to the dashboard on this page. Feel free to ask me any follow-up questions about this location or role!" }
          ]);
        } else {
           // fallback if parse fails
           setMarketData(null);
           setMessages([
            { role: "model", text: "I had trouble rendering the visualization, but here is my raw analysis:\n" + fullResponse }
          ]);
          setIsChatOpen(true);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsGeneratingMarketData(false);
      }
      return;
    }

    setIsGenerating(true);
    setIsChatOpen(true);

    if (workflowId === "resume") {
      try {
        const result = await analyzeResume(
          formData.resumeText || "",
          fileData.resumeFile || null,
          formData.jd || "",
          formData.jdUrl || ""
        );
        setResumeWorkspaceData(result);
        
        // Also start a chat session in the background for follow-up questions
        const newChat = createTechCoachChat(config.systemInstruction, config.enableSearch);
        setChatInstance(newChat);
        setMessages([
          { role: "user", text: "I've uploaded my resume for analysis." },
          { role: "model", text: "I've analyzed your resume and prepared an interactive workspace for you to review my suggestions and make edits. You can also ask me any follow-up questions here!" }
        ]);
      } catch (error) {
        console.error("Error analyzing resume:", error);
        alert("Failed to analyze resume. Please try again.");
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    if (workflowId === "resume_generation") {
      setResumeGeneratorData(formData);
      setIsGenerating(false);
      return;
    }

    // Handle generic text-based workflows (linkedin, interview, career, salary)
    setIsGenerating(true);
    setIsChatOpen(false); // DO NOT POP UP
    setMainDocumentText(" "); // Set to space to trigger UI transition
    
    const prompt = config.generatePrompt(formData);
    const newChat = createTechCoachChat(config.systemInstruction, config.enableSearch);
    setChatInstance(newChat);

    try {
      let isFirstChunk = true;
      await sendMessageStream(newChat, prompt as string, (chunk) => {
        setMainDocumentText((prev) => {
           if (isFirstChunk) {
              isFirstChunk = false;
              return chunk; 
           }
           return prev + chunk;
        });
      });
      setMessages([
        { role: "model", text: "I've drafted the analysis directly on the dashboard. Let me know if you have any questions or want me to refine it!" }
      ]);
    } catch (error) {
      console.error(error);
      setMessages([
        { role: "model", text: "**Error:** Failed to generate response." }
      ]);
      setIsChatOpen(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChatSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const textToSend = overrideText || chatInput.trim();
    
    if (!textToSend || !chatInstance || isGenerating) return;

    setChatInput("");
    setIsGenerating(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", text: textToSend },
      { role: "model", text: "" }
    ]);

    try {
      await sendMessageStream(chatInstance, textToSend, (chunk) => {
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

  const renderLeftColumn = () => {
    if (messages.length > 0 || mainDocumentText || isGenerating) {
      if (!isGenerating && messages.length === 0 && !mainDocumentText && !marketData) {
         // Should not naturally hit this if conditions are tight, but just in case
      }

      // Session started, show preview if available
      const hasFile = Object.values(fileData).length > 0;
      const hasUrl = formData.url;

      const resetSession = () => {
        setMessages([]);
        setChatInstance(null);
        setMainDocumentText("");
      };

      return (
        <div className="space-y-6">
          {hasFile && (
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
              <CardHeader className="shrink-0 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Document Preview ({Object.values(fileData)[0].name})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden flex flex-col bg-zinc-100 dark:bg-zinc-900">
                {Object.values(fileData)[0].mimeType === "application/pdf" ? (
                  <div className="overflow-auto flex flex-col items-center p-4">
                    <Document
                      file={Object.values(fileData)[0].objectUrl}
                      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                      className="max-w-full"
                      loading={<div className="p-4 text-zinc-500">Loading PDF...</div>}
                      error={<div className="p-4 text-red-500">Failed to load PDF.</div>}
                    >
                      <Page pageNumber={pageNumber} renderTextLayer={false} renderAnnotationLayer={false} className="shadow-md" width={400} />
                    </Document>
                    {numPages && numPages > 1 && (
                      <div className="flex items-center gap-4 mt-4 bg-white dark:bg-zinc-800 p-2 rounded-full shadow-sm">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={pageNumber <= 1} onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">{pageNumber} of {numPages}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={pageNumber >= numPages} onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 text-zinc-500">Preview not available for this file type.</div>
                )}
              </CardContent>
            </Card>
          )}

          {hasUrl && (
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col">
              <CardHeader className="shrink-0 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle className="text-lg flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  Linked URL
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 break-all bg-white dark:bg-zinc-950">
                <a href={formData.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  {formData.url}
                </a>
              </CardContent>
            </Card>
          )}

          {/* Render the actual main AI result here! */}
          {(mainDocumentText || isGenerating) && workflowId !== "market" && workflowId !== "resume" && workflowId !== "resume_generation" && (
              <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in fade-in">
                 <CardHeader className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                       {isGenerating && !mainDocumentText.trim() ? <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> : <Sparkles className="w-5 h-5 text-indigo-500" />}
                       {isGenerating && !mainDocumentText.trim() ? "Analyzing & Generating..." : "Analysis Results"}
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6 md:p-8 bg-white dark:bg-zinc-950">
                    {mainDocumentText.trim() ? (
                       <div className="prose prose-zinc dark:prose-invert max-w-none">
                          <Markdown>{mainDocumentText}</Markdown>
                       </div>
                    ) : (
                       <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
                          <Loader2 className="w-8 h-8 animate-spin mb-4" />
                          <p>Processing your request...</p>
                       </div>
                    )}
                 </CardContent>
              </Card>
          )}

          {workflowId !== "market" && workflowId !== "resume" && workflowId !== "resume_generation" && (
            <Button variant="outline" className="w-full h-12 shadow-sm rounded-xl mt-4" onClick={resetSession}>
              Start New Analysis
            </Button>
          )}
        </div>
      );
    }

    // Form state
    return (
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Input Details</CardTitle>
          <CardDescription>Provide the necessary information to start.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInitialSubmit} className="space-y-4">
            {config.fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {field.label} {field.required === false && <span className="text-zinc-400">(Optional)</span>}
                </label>
                {field.type === "textarea" ? (
                  <Textarea
                    required={field.required !== false}
                    placeholder={field.placeholder}
                    className="min-h-[120px] resize-y bg-white dark:bg-zinc-900"
                    value={formData[field.id] || ""}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                  />
                ) : field.type === "file" ? (
                  <Input
                    type="file"
                    accept={field.accept}
                    required={field.required !== false}
                    className="bg-white dark:bg-zinc-900 file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    onChange={(e) => handleFileChange(field.id, e.target.files?.[0] || null)}
                  />
                ) : field.type === "select" ? (
                  <div className="space-y-2">
                    <select
                      required={field.required !== false && formData[`${field.id}_select`] !== "Other"}
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300"
                      value={formData[`${field.id}_select`] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleInputChange(`${field.id}_select`, val);
                        if (val === "") {
                          handleInputChange(field.id, "");
                        } else if (val !== "Other") {
                          handleInputChange(field.id, val);
                        } else {
                          // For 'Other', clear the main property to force the user to type it in the secondary input
                          handleInputChange(field.id, "");
                        }
                      }}
                    >
                      <option value="" disabled={field.required !== false}>Select an option...</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {field.allowCustom && formData[`${field.id}_select`] === "Other" && (
                      <Input
                        type="text"
                        required={field.required !== false}
                        placeholder="Please specify..."
                        className="bg-white dark:bg-zinc-900 mt-2"
                        value={formData[field.id] || ""}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                      />
                    )}
                  </div>
                ) : (
                  <Input
                    type={field.type}
                    required={field.required !== false}
                    placeholder={field.placeholder}
                    className="bg-white dark:bg-zinc-900"
                    value={formData[field.id] || ""}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                  />
                )}
              </div>
            ))}
            <Button
              type="submit"
              disabled={isGenerating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Start Session
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  };

  const renderFloatingChat = () => {
    if (messages.length === 0) return null;
    return (
        <>
          {/* Floating Action Button */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`absolute bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all z-40 ${isChatOpen ? 'bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-zinc-200 dark:hover:bg-zinc-300 dark:text-zinc-900 scale-90' : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105'}`}
          >
            {isChatOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
          </button>

          {/* Chat Modal */}
          <div 
            className={`absolute bottom-24 right-6 w-full max-w-md h-[600px] max-h-[calc(100vh-140px)] flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 transition-all duration-300 transform origin-bottom-right z-40 overflow-hidden ${
              isChatOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 pointer-events-none translate-y-4"
            }`}
          >
            <div className="shrink-0 p-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-between items-center z-10">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Coach's Analysis</h3>
                <p className="text-xs text-zinc-500">TechCoach AI</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)} className="h-8 w-8 rounded-full">
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <ScrollArea className="flex-1 p-4 bg-zinc-50/50 dark:bg-zinc-950/50">
              <div className="space-y-6 pb-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300" : "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"}`}>
                      {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-tl-sm"}`}>
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                      ) : (
                        <div className="prose prose-sm prose-zinc dark:prose-invert max-w-none leading-relaxed overflow-hidden">
                          {msg.text ? (
                            <Markdown>{msg.text}</Markdown>
                          ) : (
                            <div className="flex items-center gap-1 mt-1">
                               <div className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce"></div>
                               <div className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                               <div className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>
            
            <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 shrink-0 flex flex-col gap-3 relative z-10">
              {config.suggestedPrompts && config.suggestedPrompts.length > 0 && messages.length < 4 && (
                <div className="flex overflow-x-auto pb-1 gap-2 no-scrollbar scroll-smooth">
                  {config.suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleChatSubmit(undefined, prompt)}
                      disabled={isGenerating}
                      className="shrink-0 text-xs px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-full transition-colors disabled:opacity-50 border border-zinc-200/50 dark:border-zinc-700/50 whitespace-nowrap"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={(e) => handleChatSubmit(e)} className="flex gap-2 relative shadow-sm">
                <Input
                  placeholder="Ask a question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isGenerating}
                  className="flex-1 pl-4 pr-10 py-5 rounded-xl border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-sm"
                />
                <Button 
                  type="submit" 
                  disabled={isGenerating || !chatInput.trim()}
                  className="absolute right-1 top-1 bottom-1 w-8 h-8 p-0 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>
          </div>
        </>
    );
  };

  if (workflowId === "resume" && resumeWorkspaceData) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <ResumeWorkspace
          initialResumeText={resumeWorkspaceData.resumeText}
          annotations={resumeWorkspaceData.annotations}
          onReset={() => {
            setResumeWorkspaceData(null);
            setMessages([]);
            setChatInstance(null);
          }}
        />
        {renderFloatingChat()}
      </div>
    );
  }

  if (workflowId === "resume_generation" && resumeGeneratorData) {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        <ResumeGeneratorWorkspace
          initialFormData={resumeGeneratorData}
          onReset={() => {
            setResumeGeneratorData(null);
          }}
        />
        {renderFloatingChat()}
      </div>
    );
  }

  if (workflowId === "resume_generation" && !resumeGeneratorData) {
    return (
      <div key={key} className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        <header className="px-8 py-6 border-b bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shrink-0">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            {config.title}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">{config.description}</p>
        </header>

        <div className="flex-1 overflow-auto p-8">
          <ResumeGenerationForm 
            isGenerating={isGenerating} 
            onSubmit={(data) => {
              setResumeGeneratorData(data);
            }} 
          />
        </div>
      </div>
    );
  }

  return (
    <div key={key} className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 relative">
      <header className="px-8 py-6 border-b bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shrink-0">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          {config.title}
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">{config.description}</p>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {workflowId !== "market" && renderLeftColumn()}
          
          {workflowId === "market" && !isGeneratingMarketData && !marketData && renderLeftColumn()}
          
          {workflowId === "market" && isGeneratingMarketData && (
               <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm p-12 flex flex-col items-center justify-center text-center">
                 <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                 <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">Researching Compensation</h3>
                 <p className="text-zinc-500 mt-2">Analyzing market data and building models. This may take a moment...</p>
               </Card>
          )}

          {workflowId === "market" && marketData && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <MarketCompensationViz data={marketData} />
               <Button variant="outline" onClick={() => { setMarketData(null); setMessages([]); setChatInstance(null); }} className="w-full h-12 shadow-sm rounded-xl">
                  Start New Analysis
               </Button>
             </div>
          )}
        </div>
      </div>

      {renderFloatingChat()}
    </div>
  );
}
