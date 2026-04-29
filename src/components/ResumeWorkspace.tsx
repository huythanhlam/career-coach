import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ResumeRenderer } from "./ResumeRenderer";
import { Loader2, Download, Save, Edit3, Eye } from "lucide-react";
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
  const [isEditing, setIsEditing] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "">("");
  
  // Auto-save to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("resume_autosave");
    if (saved && saved !== initialResumeText) {
      setResumeText(saved);
    }
  }, [initialResumeText]);

  useEffect(() => {
    setSaveStatus("saving");
    const timer = setTimeout(() => {
      localStorage.setItem("resume_autosave", resumeText);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resumeText]);

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportDocx = () => {
    // Simple fallback for DOCX export using HTML and a Blob
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML to Word Document with JavaScript</title></head><body>";
    const footer = "</body></html>";
    
    // We need to convert markdown to HTML for the docx export
    // A simple way is to just export the text for now, or use a basic markdown parser
    // Since we don't have a full markdown-to-html string converter easily available without rendering,
    // we'll just export the raw text as a .doc which Word handles fine.
    const sourceHTML = header + "<pre style='font-family: Arial, sans-serif; white-space: pre-wrap;'>" + resumeText.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</pre>" + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'resume.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  // Function to highlight text in the markdown before rendering
  const getHighlightedMarkdown = () => {
    let highlighted = resumeText;
    
    // Sort annotations by length descending so we don't replace parts of longer strings
    // Keep track of original index for the tooltip lookup
    const sortedAnnotations = [...annotations]
      .map((ann, originalIndex) => ({ ...ann, originalIndex }))
      .sort((a, b) => b.textToHighlight.length - a.textToHighlight.length);
    
    sortedAnnotations.forEach((ann) => {
      if (!ann.textToHighlight) return;
      // Escape regex characters
      const safeText = ann.textToHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${safeText})`, 'g');
      
      // We use a custom tag that we will intercept in the Markdown renderer
      highlighted = highlighted.replace(regex, `<mark data-annotation-index="${ann.originalIndex}">$1</mark>`);
    });
    
    return highlighted;
  };

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-zinc-950">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0 print:hidden">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Resume Editor</h2>
          {saveStatus === "saving" && <span className="text-xs text-zinc-500 flex items-center"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving...</span>}
          {saveStatus === "saved" && <span className="text-xs text-green-600 flex items-center"><Save className="w-3 h-3 mr-1" /> Saved</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? <><Eye className="w-4 h-4 mr-2" /> Preview</> : <><Edit3 className="w-4 h-4 mr-2" /> Edit</>}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportDocx}>
            <Download className="w-4 h-4 mr-2" /> DOCX
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            Close
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row print:block print:overflow-visible">
        
        {/* Editor Pane (Hidden in print) */}
        {isEditing && (
          <div className="flex-1 h-full border-r border-zinc-200 dark:border-zinc-800 p-4 print:hidden">
            <Textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="w-full h-full min-h-[500px] font-mono text-sm resize-none border-0 focus-visible:ring-0 p-0 bg-transparent"
              placeholder="Start typing your resume here..."
            />
          </div>
        )}

        {/* Preview Pane */}
        <div className={`flex-1 h-full overflow-y-auto p-8 bg-zinc-50 dark:bg-zinc-900/50 print:bg-white print:p-0 custom-scrollbar ${!isEditing ? 'max-w-4xl mx-auto' : ''}`}>
          <div className="bg-white dark:bg-zinc-950 p-8 sm:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-black/[0.04] dark:border-white/[0.04] min-h-[1056px] print:shadow-none print:border-0 print:m-0 print:p-0">
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
                   const markClass = isStrength 
                     ? "bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-100 cursor-help rounded px-1 print:bg-transparent print:text-inherit" 
                     : "bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-100 cursor-help rounded px-1 print:bg-transparent print:text-inherit";

                   return (
                     <Tooltip>
                       <TooltipTrigger>
                         <mark className={markClass}>
                           {children}
                         </mark>
                       </TooltipTrigger>
                       <TooltipContent className="max-w-xs p-3 text-sm">
                         <p className="font-semibold mb-1">{isStrength ? "Strength" : "Suggestion"}</p>
                         <p>{annotation.suggestion}</p>
                       </TooltipContent>
                     </Tooltip>
                   );
                 }
               }}
             />
          </div>
        </div>
      </div>
    </div>
  );
}
