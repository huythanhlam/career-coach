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
  const [isGenerating, setIsGenerating] = useState(false);
  
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
      
      try {
        let fullResponse = "";
        await sendMessageStream(newChat, prompt as string, (chunk) => {
          fullResponse += chunk;
        });
        const parsed = tryParseMarketData(fullResponse);
        if (parsed) {
          setMarketData(parsed);
        } else {
           // fallback if parse fails
           setMarketData(null);
           setMainDocumentText(fullResponse);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsGeneratingMarketData(false);
      }
      return;
    }

    setIsGenerating(true);

    if (workflowId === "resume") {
      try {
        const result = await analyzeResume(
          formData.resumeText || "",
          fileData.resumeFile || null,
          formData.jd || "",
          formData.jdUrl || ""
        );
        setResumeWorkspaceData(result);
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
    setMainDocumentText(" "); // Set to space to trigger UI transition
    
    const prompt = config.generatePrompt(formData);
    const newChat = createTechCoachChat(config.systemInstruction, config.enableSearch);

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
    } catch (error) {
      console.error(error);
      setMainDocumentText("**Error:** Failed to generate response.");
    } finally {
      setIsGenerating(false);
    }
  };

  const renderLeftColumn = () => {
    if (mainDocumentText || isGenerating) {
      // Session started, show preview if available
      const hasFile = Object.values(fileData).length > 0;
      const hasUrl = formData.url;

      const resetSession = () => {
        setMainDocumentText("");
        setFormData({});
        setFileData({});
      };

      return (
        <div className="space-y-6">
          {hasFile && (
            <Card className="border border-black/[0.04] dark:border-white/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[32px] overflow-hidden flex flex-col">
              <CardHeader className="shrink-0 bg-secondary/50 border-b border-border p-6 pb-5">
                <CardTitle className="text-lg flex items-center gap-2 font-semibold">
                  <FileText className="w-5 h-5 text-primary" />
                  Document Preview ({Object.values(fileData)[0].name})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden flex flex-col bg-secondary/20">
                {Object.values(fileData)[0].mimeType === "application/pdf" ? (
                  <div className="overflow-auto flex flex-col items-center p-4">
                    <Document
                      file={Object.values(fileData)[0].objectUrl}
                      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                      className="max-w-full"
                      loading={<div className="p-4 text-muted-foreground">Loading PDF...</div>}
                      error={<div className="p-4 text-destructive">Failed to load PDF.</div>}
                    >
                      <Page pageNumber={pageNumber} renderTextLayer={false} renderAnnotationLayer={false} className="shadow-md" width={400} />
                    </Document>
                    {numPages && numPages > 1 && (
                      <div className="flex items-center gap-4 mt-4 bg-background p-2 rounded-full shadow-sm border border-border">
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
                  <div className="p-4 text-muted-foreground">Preview not available for this file type.</div>
                )}
              </CardContent>
            </Card>
          )}

          {hasUrl && (
            <Card className="border border-black/[0.04] dark:border-white/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[32px] overflow-hidden flex flex-col">
              <CardHeader className="shrink-0 bg-secondary/50 border-b border-border p-6 pb-5">
                <CardTitle className="text-lg flex items-center gap-2 font-semibold">
                  <LinkIcon className="w-5 h-5 text-primary" />
                  Linked URL
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 break-all bg-card">
                <a href={formData.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {formData.url}
                </a>
              </CardContent>
            </Card>
          )}

          {/* Render the actual main AI result here! */}
          {(mainDocumentText || isGenerating) && workflowId !== "market" && workflowId !== "resume" && workflowId !== "resume_generation" && (
              <Card className="border border-black/[0.04] dark:border-white/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[32px] overflow-hidden animate-in fade-in">
                 <CardHeader className="bg-card border-b border-border p-6 pb-5 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2 font-semibold">
                       {isGenerating && !mainDocumentText.trim() ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Sparkles className="w-5 h-5 text-primary" />}
                       {isGenerating && !mainDocumentText.trim() ? "Analyzing & Generating..." : "Analysis Results"}
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6 md:p-8 bg-card">
                    {mainDocumentText.trim() ? (
                       <div className="prose prose-zinc dark:prose-invert max-w-none">
                          <Markdown>{mainDocumentText}</Markdown>
                       </div>
                    ) : (
                       <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                          <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                          <p>Processing your request...</p>
                       </div>
                    )}
                 </CardContent>
              </Card>
          )}

          {workflowId !== "market" && workflowId !== "resume" && workflowId !== "resume_generation" && (
            <Button variant="outline" className="w-full h-14 shadow-sm rounded-xl mt-4 text-base font-medium bg-background hover:bg-secondary transition-colors" onClick={resetSession}>
              Start New Analysis
            </Button>
          )}
        </div>
      );
    }

    // Form state
    return (
      <Card className="border border-black/[0.04] dark:border-white/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[32px] overflow-hidden bg-card">
        <CardHeader className="p-8 pb-6 border-b border-border">
          <CardTitle className="text-xl font-semibold text-foreground">Input Details</CardTitle>
          <CardDescription className="text-base font-light text-muted-foreground">Provide the necessary information to start.</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleInitialSubmit} className="space-y-6">
            {config.fields.map((field) => (
              <div key={field.id} className="space-y-3">
                <label className="text-[15px] font-medium text-foreground">
                  {field.label} {field.required === false && <span className="text-muted-foreground font-light ml-1">(Optional)</span>}
                </label>
                {field.type === "textarea" ? (
                  <Textarea
                    required={field.required !== false}
                    placeholder={field.placeholder}
                    className="min-h-[140px] resize-y bg-secondary/50 border-border rounded-xl px-4 py-3 focus:bg-background text-base transition-colors"
                    value={formData[field.id] || ""}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                  />
                ) : field.type === "file" ? (
                  <Input
                    type="file"
                    accept={field.accept}
                    required={field.required !== false}
                    className="bg-secondary/50 border-border rounded-xl px-4 h-14 flex items-center file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-foreground file:text-background hover:file:opacity-90"
                    onChange={(e) => handleFileChange(field.id, e.target.files?.[0] || null)}
                  />
                ) : field.type === "select" ? (
                  <div className="space-y-3">
                    <select
                      required={field.required !== false && formData[`${field.id}_select`] !== "Other"}
                      className="flex w-full bg-secondary/50 border border-border rounded-xl px-4 h-14 text-base focus:bg-background focus:ring-1 focus:ring-primary/20 outline-none transition-colors text-foreground"
                      value={formData[`${field.id}_select`] || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleInputChange(`${field.id}_select`, val);
                        if (val === "") {
                          handleInputChange(field.id, "");
                        } else if (val !== "Other") {
                          handleInputChange(field.id, val);
                        } else {
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
                        className="bg-secondary/50 border-border rounded-xl px-4 h-14 focus:bg-background text-base mt-3 transition-colors"
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
                    className="bg-secondary/50 border-border rounded-xl px-4 h-14 focus:bg-background text-base transition-colors"
                    value={formData[field.id] || ""}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                  />
                )}
              </div>
            ))}
            <div className="pt-4">
               <Button
                 type="submit"
                 disabled={isGenerating}
                 size="lg"
                 className="w-full text-base font-medium bg-foreground text-background hover:bg-foreground/90 rounded-xl h-14 transition-all"
               >
                 {isGenerating ? (
                   <>
                     <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                     Starting...
                   </>
                 ) : (
                   <>
                     <Sparkles className="mr-2 h-5 w-5" />
                     Start Session
                   </>
                 )}
               </Button>
            </div>
          </form>
        </CardContent>
      </Card>
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
          }}
        />
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
      </div>
    );
  }

  if (workflowId === "resume_generation" && !resumeGeneratorData) {
    return (
      <div key={key} className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        <header className="px-8 py-6 border-b bg-card border-border shrink-0">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            {config.title}
          </h2>
          <p className="text-muted-foreground mt-1">{config.description}</p>
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
    <div key={key} className="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
      <header className="px-8 py-6 border-b bg-card border-border shrink-0">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          {config.title}
        </h2>
        <p className="text-muted-foreground mt-1">{config.description}</p>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {workflowId !== "market" && renderLeftColumn()}
          
          {workflowId === "market" && !isGeneratingMarketData && !marketData && renderLeftColumn()}
          
          {workflowId === "market" && isGeneratingMarketData && (
               <Card className="border-border shadow-sm p-12 flex flex-col items-center justify-center text-center">
                 <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                 <h3 className="text-xl font-medium text-foreground">Researching Compensation</h3>
                 <p className="text-muted-foreground mt-2">Analyzing market data and building models. This may take a moment...</p>
               </Card>
          )}

          {workflowId === "market" && marketData && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <MarketCompensationViz data={marketData} />
               <Button variant="outline" onClick={() => { setMarketData(null); setMainDocumentText(""); }} className="w-full h-12 shadow-sm rounded-xl">
                  Start New Analysis
               </Button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
