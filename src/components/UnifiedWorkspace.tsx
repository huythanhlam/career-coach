import React, { useState } from "react";
import { 
  Building, 
  Map, 
  LineChart, 
  MessageSquare, 
  Briefcase, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Loader2,
  ChevronRight,
  Bot
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { generateWorkflowData, analyzeResume } from "@/services/geminiService";
import { workflowsConfig } from "@/config/workflows";
import { MarketCompensationViz } from "./MarketCompensationViz";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";

export function UnifiedWorkspace() {
  const [step, setStep] = useState<"intake" | "processing" | "results">("intake");
  const [jobInput, setJobInput] = useState("");
  const [yoe, setYoe] = useState("");
  const [level, setLevel] = useState("");
  const [resumeData, setResumeData] = useState<{data: string, mimeType: string, name: string} | null>(null);

  // Auto-Pilot Output States
  const [marketData, setMarketData] = useState<any>(null);
  const [companyIntel, setCompanyIntel] = useState<any>(null);
  const [resumeFit, setResumeFit] = useState<any>(null);
  const [interviewStrategy, setInterviewStrategy] = useState<any>(null);
  const [generationProgress, setGenerationProgress] = useState({
    market: "pending",
    company: "pending",
    resume: "pending",
    interview: "pending"
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(",")[1];
      setResumeData({
        data: base64,
        mimeType: file.type,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };
  const [savedAnalyses, setSavedAnalyses] = useState<any[]>([]);

  React.useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("tc_saved_analyses") || "[]");
    setSavedAnalyses(saved);
  }, [step]);

  const loadAnalysis = (data: any) => {
    setJobInput(data.jobInput || "");
    setYoe(data.yoe || "");
    setLevel(data.level || "");
    setMarketData(data.marketData);
    setCompanyIntel(data.companyIntel);
    setResumeFit(data.resumeFit);
    setInterviewStrategy(data.interviewStrategy);
    setResumeData(data.resumeData || null);
    setStep("results");
  };

  const deleteAnalysis = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedAnalyses.filter(a => a.id !== id);
    localStorage.setItem("tc_saved_analyses", JSON.stringify(updated));
    setSavedAnalyses(updated);
  };

  const handleStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("processing");
    setGenerationProgress({
      market: "generating",
      company: "generating",
      resume: "generating",
      interview: "generating"
    });

    const marketP = generateWorkflowData(
      workflowsConfig.market.systemInstruction,
      `What is the real, data-driven market compensation for a ${jobInput} at ${level} level with ${yoe} years of experience? Assume US national average / remote if location not specified.`
    ).then(res => {
      const match = res.match(/```json\s*([\s\S]*?)\s*(?:```|$)/);
      return JSON.parse(match ? match[1] : res);
    });

    const companyP = generateWorkflowData(
      workflowsConfig.company_research.systemInstruction,
      `Provide company intel for the company mentioned in this job description or title: ${jobInput}. Focus on culture, growth trajectory, and tech stack.`
    );

    const interviewP = generateWorkflowData(
      workflowsConfig.interview.systemInstruction,
      `Create an interview guide for a ${level} level role based on this context: ${jobInput} with ${yoe} YOE.`
    );

    // Run sequentially to grab JSON reliably or use Promise.allSettled
    Promise.allSettled([marketP, companyP, interviewP]).then((results) => {
      if (results[0].status === "fulfilled") {
        setMarketData(results[0].value);
        setGenerationProgress(p => ({ ...p, market: "done" }));
      }
      if (results[1].status === "fulfilled") {
        setCompanyIntel(results[1].value);
        setGenerationProgress(p => ({ ...p, company: "done" }));
      }
      if (results[2].status === "fulfilled") {
        setInterviewStrategy(results[2].value);
        setGenerationProgress(p => ({ ...p, interview: "done" }));
      }
    });

    if (resumeData) {
      analyzeResume("Please use the attached resume file.", resumeData, jobInput, "").then(res => {
        setResumeFit(res);
        setGenerationProgress(p => ({ ...p, resume: "done" }));
      }).catch(e => {
        setGenerationProgress(p => ({ ...p, resume: "error" }));
      });
    } else {
      setGenerationProgress(p => ({ ...p, resume: "done" }));
    }

    // Move to results when market is done (or after an arbitrary wait to ensure user sees progress)
    setTimeout(() => setStep("results"), 8000);
  };

  const saveAnalysis = () => {
    const id = Date.now().toString();
    const data = {
      id,
      jobInput,
      yoe,
      level,
      marketData,
      companyIntel,
      resumeFit,
      interviewStrategy,
      resumeData: resumeData ? { name: resumeData.name } : null // Only saving metadata
    };
    const saved = JSON.parse(localStorage.getItem("tc_saved_analyses") || "[]");
    localStorage.setItem("tc_saved_analyses", JSON.stringify([...saved, data]));
    alert("Analysis saved successfully!");
  };

  if (step === "results") {
    return (
      <div className="flex-1 overflow-auto bg-[#fafafa] dark:bg-zinc-950 p-6 md:p-12">
        <div className="max-w-6xl mx-auto space-y-8 mt-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Your Action Plan</h1>
              <p className="text-zinc-500 mt-2 font-light">Strategy for: <span className="font-medium text-zinc-900 dark:text-zinc-300">{jobInput}</span></p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={saveAnalysis} className="rounded-xl px-6 h-11 bg-white border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700">Save Plan</Button>
              <Button variant="default" onClick={() => {
                setStep("intake");
                setMarketData(null);
                setCompanyIntel(null);
                setResumeFit(null);
                setInterviewStrategy(null);
              }} className="rounded-xl px-6 h-11 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">Start New Analysis</Button>
            </div>
          </div>

          {/* Bento Grid Concept for Outputs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="col-span-1 lg:col-span-2 shadow-sm rounded-3xl border border-black/[0.04] dark:border-white/[0.04] overflow-hidden order-1">
              <CardHeader className="pb-4 bg-white/50 dark:bg-zinc-900/50">
                <CardTitle className="text-[17px] font-medium flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                    <LineChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  Market Compensation
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[450px] overflow-auto custom-scrollbar px-6 pb-6 pt-0 bg-white dark:bg-transparent">
                {marketData ? <MarketCompensationViz data={marketData} /> : <p className="text-zinc-500 p-8 text-center">Loading market data...</p>}
              </CardContent>
            </Card>

            <Card className="col-span-1 shadow-sm rounded-3xl border border-black/[0.04] dark:border-white/[0.04] overflow-hidden order-2">
              <CardHeader className="pb-4 bg-white/50 dark:bg-zinc-900/50">
                <CardTitle className="text-[17px] font-medium flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                     <Building className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Company Intel
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[450px] overflow-auto custom-scrollbar prose prose-sm dark:prose-invert px-6 pb-6 pt-2 bg-white dark:bg-transparent max-w-none text-zinc-600 dark:text-zinc-400 font-light leading-relaxed">
                {companyIntel ? <Markdown rehypePlugins={[rehypeRaw]}>{companyIntel}</Markdown> : <p className="text-zinc-500 p-8 text-center">Loading intel...</p>}
              </CardContent>
            </Card>

            <Card className="col-span-1 shadow-sm rounded-3xl border border-black/[0.04] dark:border-white/[0.04] overflow-hidden order-3">
              <CardHeader className="pb-4 bg-white/50 dark:bg-zinc-900/50">
                <CardTitle className="text-[17px] font-medium flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                     <FileText className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  Resume Fit
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[400px] overflow-auto custom-scrollbar prose prose-sm dark:prose-invert px-6 pb-6 pt-2 bg-white dark:bg-transparent text-zinc-600 dark:text-zinc-400 font-light">
                {resumeFit ? (
                  <>
                    <h3 className="font-medium text-base text-zinc-900 dark:text-zinc-200 mb-4 mt-2">Strengths & Enhancements</h3>
                    <ul className="space-y-4 list-none pl-0">
                      {resumeFit.annotations?.map((ann: any, i: number) => (
                        <li key={i} className="flex gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 shrink-0"></div>
                          <div>
                            <span className="font-medium text-zinc-800 dark:text-zinc-300">"{ann.textToHighlight}"</span><br/>
                            <span className="text-zinc-500 text-sm">{ann.suggestion}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-2">
                     <FileText className="w-8 h-8 opacity-20" />
                     <p>{resumeData ? "Analyzing resume..." : "No resume provided."}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-1 lg:col-span-2 shadow-sm rounded-3xl border border-black/[0.04] dark:border-white/[0.04] overflow-hidden order-4">
              <CardHeader className="pb-4 bg-white/50 dark:bg-zinc-900/50">
                <CardTitle className="text-[17px] font-medium flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  Interview Strategy
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[400px] overflow-auto custom-scrollbar prose prose-sm dark:prose-invert max-w-none px-6 pb-6 pt-2 bg-white dark:bg-transparent text-zinc-600 dark:text-zinc-400 font-light leading-relaxed">
                {interviewStrategy ? <Markdown rehypePlugins={[rehypeRaw]}>{interviewStrategy}</Markdown> : <p className="text-zinc-500 p-8 text-center">Drafting strategy...</p>}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Master AI Agent Chat */}
        <div className="fixed bottom-6 right-6 w-[400px] bg-white dark:bg-zinc-900 rounded-[28px] shadow-[0_20px_40px_rgba(0,0,0,0.08)] border border-black/[0.05] dark:border-zinc-800 overflow-hidden flex flex-col h-[500px] z-50">
          <div className="bg-zinc-900 text-white shrink-0 flex items-center justify-between p-4 px-5">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full flex items-center justify-center border border-white/20">
                  <Bot className="w-4 h-4" />
               </div>
               <div>
                  <h3 className="font-semibold text-[15px]">TechCoach Assistant</h3>
                  <p className="text-[11px] text-zinc-400 font-light">Online</p>
               </div>
             </div>
          </div>
          <div className="flex-1 p-5 overflow-y-auto bg-[#fafafa] dark:bg-zinc-950/50">
             <div className="bg-white dark:bg-zinc-800 rounded-2xl rounded-tl-sm p-4 text-[13px] shadow-sm border border-zinc-100 dark:border-zinc-700 w-[85%] text-zinc-700 dark:text-zinc-300 font-light leading-relaxed">
               I've analyzed all the dimensions of your application. Feel free to ask me to refine your resume fit, negotiate your compensation, or practice specific interview questions!
             </div>
          </div>
          <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
            <Input placeholder="Message TechCoach..." className="rounded-full bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 shadow-inner h-12 px-5 text-sm" />
          </div>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#fafafa] dark:bg-zinc-950 p-6">
        <div className="max-w-md w-full p-10 bg-white dark:bg-zinc-900 rounded-[32px] border border-black/[0.04] dark:border-white/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-8">
           <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-zinc-900 dark:text-zinc-100 mx-auto mb-5" />
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Building Strategy</h2>
              <p className="text-sm text-zinc-500 font-light mt-2">Engaging expert agents for a comprehensive look.</p>
           </div>
           
           <div className="space-y-5 mt-8 px-4">
              <div className="flex items-center gap-4">
                 {generationProgress.resume === "done" ? <CheckCircle2 className="w-5 h-5 text-zinc-900 dark:text-zinc-100" /> : <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}
                 <span className={`text-sm ${generationProgress.resume === "done" ? 'font-medium text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 font-light'}`}>Aligning resume...</span>
              </div>
              <div className="flex items-center gap-4">
                 {generationProgress.market === "done" ? <CheckCircle2 className="w-5 h-5 text-zinc-900 dark:text-zinc-100" /> : <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}
                 <span className={`text-sm ${generationProgress.market === "done" ? 'font-medium text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 font-light'}`}>Pricing market compensation...</span>
              </div>
              <div className="flex items-center gap-4">
                 {generationProgress.interview === "done" ? <CheckCircle2 className="w-5 h-5 text-zinc-900 dark:text-zinc-100" /> : <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}
                 <span className={`text-sm ${generationProgress.interview === "done" ? 'font-medium text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 font-light'}`}>Drafting interview guide...</span>
              </div>
              <div className="flex items-center gap-4">
                 {generationProgress.company === "done" ? <CheckCircle2 className="w-5 h-5 text-zinc-900 dark:text-zinc-100" /> : <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}
                 <span className={`text-sm ${generationProgress.company === "done" ? 'font-medium text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 font-light'}`}>Researching company intel...</span>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[#fafafa] dark:bg-zinc-950 p-6 md:p-12 flex justify-center w-full">
      <div className="max-w-2xl w-full mt-4">
         <div className="mb-10 text-center space-y-3">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
               Let's build your career strategy
            </h1>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed font-light">
               Tell us where you want to go. We'll instantly give you the compensation data, company intel, and interview prep you need.
            </p>
         </div>

         <form onSubmit={handleStartAnalysis} className="space-y-10 bg-white dark:bg-zinc-900 p-8 md:p-10 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/[0.04] dark:border-white/[0.04]">
            {/* Input fields */}
            <div className="space-y-8">
               <div className="space-y-3">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-medium text-zinc-500 text-sm">1</div>
                     <label className="text-base font-medium text-zinc-800 dark:text-zinc-200">What role are you targeting?</label>
                  </div>
                  <div className="pl-11">
                     <Input 
                       required
                       placeholder="e.g., Senior Software Engineer at Stripe, or paste a job link" 
                       value={jobInput}
                       onChange={(e) => setJobInput(e.target.value)}
                       className="h-14 bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 rounded-xl text-base px-4 transition-colors focus:bg-white"
                     />
                  </div>
               </div>

               <div className="space-y-3">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-medium text-zinc-500 text-sm">2</div>
                     <label className="text-base font-medium text-zinc-800 dark:text-zinc-200">What is your experience level?</label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-11">
                     <div>
                        <Input 
                          required
                          type="number"
                          placeholder="Years of experience (e.g., 5)" 
                          value={yoe}
                          onChange={(e) => setYoe(e.target.value)}
                          className="h-14 bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 rounded-xl px-4 focus:bg-white"
                        />
                     </div>
                     <div>
                        <select 
                          required
                          className="w-full h-14 bg-zinc-50/50 focus:bg-white dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 text-zinc-600 dark:text-zinc-300 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                          value={level}
                          onChange={(e) => setLevel(e.target.value)}
                        >
                           <option value="" disabled>Select Level...</option>
                           <option value="entry">Entry-Level / Junior</option>
                           <option value="mid">Mid-Level</option>
                           <option value="senior">Senior</option>
                           <option value="staff">Staff / Principal</option>
                           <option value="manager">Manager / Director</option>
                        </select>
                     </div>
                  </div>
               </div>

               <div className="space-y-3">
                  <div className="flex items-center gap-3 justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-medium text-zinc-500 text-sm">3</div>
                        <label className="text-base font-medium text-zinc-800 dark:text-zinc-200">Upload your current resume</label>
                     </div>
                     {resumeData && <span className="text-xs bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-1 rounded-full font-medium">{resumeData.name} attached</span>}
                  </div>
                  <div className="pl-11">
                     <label htmlFor="resume-upload" className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 text-center hover:bg-zinc-50 dark:hover:bg-zinc-950/50 transition-colors cursor-pointer group ${resumeData ? 'border-emerald-500/50 bg-emerald-50/10 dark:bg-emerald-900/10' : 'border-zinc-200 dark:border-zinc-800'}`}>
                        <Upload className={`w-8 h-8 transition-colors mx-auto mb-3 ${resumeData ? 'text-emerald-500' : 'text-zinc-300 group-hover:text-indigo-400'}`} />
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {resumeData ? "Click to replace file" : "Drag and drop your PDF or click to browse"}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1.5 font-light">PDF or DOCX</p>
                        <input id="resume-upload" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
                     </label>
                  </div>
               </div>
            </div>

            <div className="pl-11 pt-4">
               <Button type="submit" size="lg" className="w-full h-14 text-base font-medium bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl shadow-md transition-all">
                  Create My Strategy <ChevronRight className="w-5 h-5 ml-2 opacity-70 border border-white/20 rounded-full p-0.5" />
               </Button>
            </div>
         </form>

         {savedAnalyses.length > 0 && (
           <div className="mt-16 pl-4">
             <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">Previous Strategies</h3>
             <div className="grid gap-3">
               {savedAnalyses.map((item) => (
                 <div
                   key={item.id}
                   onClick={() => loadAnalysis(item)}
                   className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-md hover:border-zinc-200 dark:hover:border-zinc-700 transition-all cursor-pointer group"
                 >
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-indigo-500 transition-colors">
                       <Map className="w-5 h-5" />
                     </div>
                     <div>
                       <h4 className="font-medium text-zinc-900 dark:text-zinc-100">{item.jobInput || "Untitled Role"}</h4>
                       <p className="text-sm text-zinc-500 font-light mt-0.5">{item.level} • {item.yoe} YOE {item.resumeData ? `• ${item.resumeData.name}` : ""}</p>
                     </div>
                   </div>
                   <div className="flex items-center gap-3">
                     <span className="text-xs text-zinc-400 font-medium">
                       {new Date(parseInt(item.id)).toLocaleDateString()}
                     </span>
                     <Button variant="ghost" size="sm" onClick={(e) => deleteAnalysis(item.id, e)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                       Delete
                     </Button>
                   </div>
                 </div>
               ))}
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
