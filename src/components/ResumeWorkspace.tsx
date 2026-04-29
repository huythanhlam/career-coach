import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ResumeRenderer } from "./ResumeRenderer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Download, Save, Edit3, Eye, CheckCircle2, AlertCircle, Sparkles, X, ChevronRight, FileText } from "lucide-react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";

interface Annotation {
  textToHighlight: string;
  type: "strength" | "weakness";
  suggestion: string;
}

interface ResumeWorkspaceProps {
  initialResumeText: string;
  annotations: Annotation[];
  onReset: () => void;
}

export function ResumeWorkspace({ initialResumeText, annotations, onReset }: ResumeWorkspaceProps) {
  const [resumeText, setResumeText] = useState(initialResumeText);
  const [activeTab, setActiveTab] = useState<"suggestions" | "edit">("suggestions");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "">("");
  const [selectedAnnotationIndex, setSelectedAnnotationIndex] = useState<number | null>(null);
  
  // Auto-save visual feedback
  useEffect(() => {
    setSaveStatus("saving");
    const timer = setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resumeText]);

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportDocx = () => {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Resume Export</title></head><body>";
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

  const getHighlightedMarkdown = () => {
    let highlighted = resumeText;
    const sortedAnnotations = [...annotations]
      .map((ann, originalIndex) => ({ ...ann, originalIndex }))
      .sort((a, b) => b.textToHighlight.length - a.textToHighlight.length);
    
    sortedAnnotations.forEach((ann) => {
      if (!ann.textToHighlight) return;
      const safeText = ann.textToHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${safeText})`, 'g');
      highlighted = highlighted.replace(regex, `<mark data-annotation-index="${ann.originalIndex}">$1</mark>`);
    });
    
    return highlighted;
  };

  const strengths = annotations.filter(a => a.type === "strength");
  const suggestions = annotations.filter(a => a.type === "weakness");

  return (
    <div className="flex flex-col h-full w-full bg-zinc-100 dark:bg-zinc-950 absolute inset-0 z-50 overflow-hidden font-sans">
      {/* Header Toolbar */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 py-3 shrink-0 shadow-sm z-20 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-md text-white shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100 leading-tight">Resume Analysis</h2>
            <div className="flex items-center text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {saveStatus === "saving" && <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analyzing...</>}
              {saveStatus === "saved" && <><Save className="w-3 h-3 mr-1 text-green-600" /> <span className="text-green-600">Syncing edits</span></>}
              {saveStatus === "" && <span>Interactive Report</span>}
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
           <div 
             onClick={() => setActiveTab("suggestions")}
             className={`group flex flex-col items-center gap-1 cursor-pointer transition-colors ${activeTab === "suggestions" ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-300"}`}
           >
             <div className={`p-3 rounded-xl transition-all ${activeTab === "suggestions" ? "bg-zinc-800 text-indigo-400" : "bg-transparent text-inherit"}`}>
               <Eye className="w-5 h-5" />
             </div>
             <span className="text-[10px] font-medium tracking-wider">Report</span>
           </div>
           <div 
             onClick={() => setActiveTab("edit")}
             className={`group flex flex-col items-center gap-1 cursor-pointer transition-colors ${activeTab === "edit" ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-300"}`}
           >
             <div className={`p-3 rounded-xl transition-all ${activeTab === "edit" ? "bg-zinc-800 text-indigo-400" : "bg-transparent text-inherit"}`}>
               <Edit3 className="w-5 h-5" />
             </div>
             <span className="text-[10px] font-medium tracking-wider">Editor</span>
           </div>
        </div>

        {/* Center Canvas Area (Resume Preview) */}
        <div className="flex-1 overflow-y-auto bg-[#f3f4f6] dark:bg-zinc-900 relative flex justify-center py-10 px-4 sm:px-8 print:bg-white print:p-0 print:overflow-visible">
           <div className="bg-white dark:bg-zinc-950 shadow-[0_4px_25px_rgba(0,0,0,0.06)] dark:shadow-none dark:border w-full max-w-[850px] min-h-[1100px] p-10 sm:p-14 shrink-0 print:shadow-none print:border-0 print:m-0 print:p-0 transition-all">
             <ResumeRenderer
               markdownContent={getHighlightedMarkdown()}
               templateType="Modern & Clean"
               customComponents={{
                 mark: ({ node, children, ...props }: any) => {
                   const indexStr = props['data-annotation-index'];
                   if (indexStr === undefined) return <mark>{children}</mark>;
                   const index = parseInt(indexStr as string, 10);
                   const annotation = annotations[index];
                   if (!annotation) return <mark>{children}</mark>;
                   const isStrength = annotation.type === "strength";
                   const isSelected = selectedAnnotationIndex === index;
                   
                   const markClass = isStrength 
                     ? `bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100 border-b-2 border-green-500 cursor-pointer px-0.5 transition-all ${isSelected ? 'bg-green-200 dark:bg-green-800/50 scale-[1.02]' : 'hover:bg-green-200/50'}` 
                     : `bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100 border-b-2 border-red-500 cursor-pointer px-0.5 transition-all ${isSelected ? 'bg-red-200 dark:bg-red-800/50 scale-[1.02]' : 'hover:bg-red-200/50'}`;

                   return (
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <mark className={markClass} onClick={() => { setActiveTab("suggestions"); setSelectedAnnotationIndex(index); }}>
                           {children}
                         </mark>
                       </TooltipTrigger>
                       <TooltipContent className="max-w-xs p-3 text-sm shadow-xl">
                         <p className="font-semibold mb-1 flex items-center gap-1.5">
                           {isStrength ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                           {isStrength ? "Strength Identified" : "Improvement Suggestion"}
                         </p>
                         <p className="text-zinc-400 italic mb-2">"{annotation.textToHighlight}"</p>
                         <p className="text-zinc-100 leading-relaxed">{annotation.suggestion}</p>
                       </TooltipContent>
                     </Tooltip>
                   );
                 }
               }}
             />
           </div>
        </div>

        {/* Right Sidebar: Analysis Report & Editor */}
        <div className="w-full lg:w-[420px] bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col z-20 shrink-0 print:hidden">
           {activeTab === "suggestions" ? (
             <div className="flex-1 flex flex-col min-h-0">
               <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
                  <h3 className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-indigo-500" />
                    Analysis Report
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase">
                      {annotations.length} Finds
                    </span>
                  </div>
               </div>
               <ScrollArea className="flex-1">
                 <div className="p-5 space-y-6">
                    {/* Overall Summary Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-2">
                       <div className="bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 p-3 rounded-xl">
                          <p className="text-[10px] font-bold text-green-700 dark:text-green-500 uppercase tracking-wider mb-1">Strengths</p>
                          <p className="text-2xl font-black text-green-800 dark:text-green-400">{strengths.length}</p>
                       </div>
                       <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3 rounded-xl">
                          <p className="text-[10px] font-bold text-red-700 dark:text-red-500 uppercase tracking-wider mb-1">Suggestions</p>
                          <p className="text-2xl font-black text-red-800 dark:text-red-400">{suggestions.length}</p>
                       </div>
                    </div>

                    {annotations.length === 0 ? (
                       <div className="py-12 text-center space-y-3">
                          <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                             <CheckCircle2 className="w-6 h-6" />
                          </div>
                          <p className="text-sm text-zinc-500 font-medium">No granular issues found. Your resume looks strong!</p>
                       </div>
                    ) : (
                       <div className="space-y-4">
                          {annotations.map((ann, idx) => (
                             <Card 
                               key={idx} 
                               className={`transition-all border shadow-none cursor-pointer group ${selectedAnnotationIndex === idx ? 'border-indigo-500 ring-1 ring-indigo-500 dark:bg-zinc-900' : 'hover:border-zinc-300 dark:hover:border-zinc-700 dark:bg-zinc-950/50'}`}
                               onClick={() => setSelectedAnnotationIndex(idx)}
                             >
                               <CardContent className="p-4 space-y-3">
                                  <div className="flex justify-between items-start">
                                     <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${ann.type === "strength" ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"}`}>
                                        {ann.type}
                                     </div>
                                     <ChevronRight className={`w-4 h-4 text-zinc-300 transition-transform ${selectedAnnotationIndex === idx ? 'rotate-90 text-indigo-500' : ''}`} />
                                  </div>
                                  <div className="space-y-2">
                                     <p className="text-xs font-mono text-zinc-500 italic bg-zinc-50 dark:bg-zinc-900 p-2 rounded border border-dashed dark:border-zinc-800">
                                        "{ann.textToHighlight}"
                                     </p>
                                     <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                                        {ann.suggestion}
                                     </p>
                                  </div>
                               </CardContent>
                             </Card>
                          ))}
                       </div>
                    )}
                 </div>
               </ScrollArea>
             </div>
           ) : (
             <div className="flex-1 flex flex-col min-h-0">
                <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
                  <h3 className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-indigo-500" />
                    Interactive Editor
                  </h3>
               </div>
               <Textarea
                 value={resumeText}
                 onChange={(e) => setResumeText(e.target.value)}
                 className="flex-1 border-0 focus-visible:ring-0 p-5 resize-none rounded-none font-mono text-xs leading-relaxed bg-white dark:bg-zinc-950"
                 placeholder="Markdown formatted resume text will appear here..."
               />
               <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <p className="text-[10px] text-zinc-500 flex items-center gap-1.5 font-medium">
                     <Sparkles className="w-3 h-3" />
                     Edits here will instantly update the report preview on the left.
                  </p>
               </div>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
