import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COMMON_ROLES } from "@/config/workflows";
import { Plus, Trash2, Loader2, Sparkles, ArrowLeft, ChevronRight, LayoutTemplate, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function MiniTemplatePreview({ type }: { type: string }) {
  if (type === "Modern & Clean") {
    return (
      <div className="w-full h-full bg-white shadow-sm border border-zinc-200 p-2.5 flex flex-col gap-2 rounded-sm overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-zinc-100 pb-1.5">
          <div className="flex flex-col gap-1 w-2/3">
            <div className="h-2.5 w-3/4 bg-zinc-800 rounded-sm"></div>
            <div className="h-1.5 w-1/2 bg-zinc-400 rounded-sm"></div>
          </div>
          <div className="flex gap-1.5 flex-col items-end">
             <div className="h-1 w-12 bg-zinc-300 rounded-px"></div>
             <div className="h-1 w-16 bg-zinc-300 rounded-px"></div>
          </div>
        </div>
        
        {/* Body 2 columns */}
        <div className="flex gap-2.5 h-full pt-1">
          {/* Left Column (Skills/Contact) */}
          <div className="w-1/3 flex flex-col gap-2 border-r border-zinc-100 pr-2">
            <div className="h-1.5 w-full bg-indigo-100 rounded-sm"></div>
            <div className="space-y-1">
              <div className="h-1 w-full bg-zinc-200 rounded-px"></div>
              <div className="h-1 w-5/6 bg-zinc-200 rounded-px"></div>
              <div className="h-1 w-4/5 bg-zinc-200 rounded-px"></div>
            </div>
            <div className="h-1.5 w-full bg-indigo-100 rounded-sm mt-1"></div>
            <div className="space-y-1">
              <div className="h-1 w-full bg-zinc-200 rounded-px"></div>
              <div className="h-1 w-full bg-zinc-200 rounded-px"></div>
            </div>
          </div>
          {/* Right Column (Experience) */}
          <div className="w-2/3 flex flex-col gap-2">
            <div className="h-1.5 w-1/3 bg-zinc-200 rounded-sm"></div>
            <div className="space-y-1 pb-1">
              <div className="flex justify-between"><div className="h-1.5 w-1/2 bg-zinc-700 rounded-px"></div><div className="h-1 w-1/5 bg-zinc-300 rounded-px"></div></div>
              <div className="h-1 w-full bg-zinc-200 rounded-px"></div>
              <div className="h-1 w-full bg-zinc-200 rounded-px"></div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between"><div className="h-1.5 w-2/5 bg-zinc-700 rounded-px"></div><div className="h-1 w-1/5 bg-zinc-300 rounded-px"></div></div>
              <div className="h-1 w-full bg-zinc-200 rounded-px"></div>
              <div className="h-1 w-11/12 bg-zinc-200 rounded-px"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (type === "Tech Focused") {
    return (
      <div className="w-full h-full bg-[#0d1117] border border-zinc-800 p-2.5 flex flex-col gap-1.5 rounded-sm overflow-hidden font-mono">
        <div className="flex gap-1 mb-1 border-b border-zinc-800 pb-2 items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          <div className="ml-2 h-1 w-16 bg-zinc-700 rounded-px"></div>
        </div>
        
        <div className="h-2.5 w-1/2 bg-blue-400/80 rounded-sm mt-1"></div>
        <div className="h-1 w-1/3 bg-emerald-400/80 rounded-sm mb-1"></div>
        
        <div className="flex gap-1 flex-wrap mb-1">
          <div className="h-1.5 w-8 bg-zinc-800 rounded-sm"></div>
          <div className="h-1.5 w-12 bg-zinc-800 rounded-sm"></div>
          <div className="h-1.5 w-10 bg-zinc-800 rounded-sm"></div>
          <div className="h-1.5 w-6 bg-zinc-800 rounded-sm"></div>
        </div>
        
        <div className="space-y-1 mt-1">
          <div className="flex gap-2 items-center"><div className="w-0.5 h-3 bg-blue-500 text-xs rounded-full"></div><div className="h-1.5 w-1/3 bg-zinc-300 rounded-sm"></div></div>
          <div className="h-1 w-full bg-zinc-600 rounded-px ml-2.5"></div>
          <div className="h-1 w-5/6 bg-zinc-600 rounded-px ml-2.5"></div>
        </div>
        
        <div className="space-y-1 mt-1">
          <div className="flex gap-2 items-center"><div className="w-0.5 h-3 bg-purple-500 text-xs rounded-full"></div><div className="h-1.5 w-2/5 bg-zinc-300 rounded-sm"></div></div>
          <div className="h-1 w-11/12 bg-zinc-600 rounded-px ml-2.5"></div>
          <div className="h-1 w-3/4 bg-zinc-600 rounded-px ml-2.5"></div>
        </div>
      </div>
    );
  }
  if (type === "Executive") {
    return (
      <div className="w-full h-full bg-white border border-zinc-300 p-3 flex flex-col items-center gap-1.5 rounded-sm overflow-hidden">
        <div className="h-3 w-1/2 bg-slate-900 rounded-sm mb-0.5"></div>
        <div className="flex gap-3 mb-0.5">
          <div className="h-1 w-8 bg-slate-400 rounded-px"></div>
          <div className="h-1 w-8 bg-slate-400 rounded-px"></div>
          <div className="h-1 w-8 bg-slate-400 rounded-px"></div>
        </div>
        <div className="w-full h-[2px] bg-slate-900 mt-1 mb-1"></div>
        
        <div className="w-full text-left flex flex-col gap-2">
          <div>
            <div className="h-1.5 w-1/4 bg-slate-800 rounded-sm mb-1"></div>
            <div className="flex justify-between w-full mb-0.5">
              <div className="h-1 w-1/3 bg-slate-700 rounded-px"></div>
              <div className="h-1 w-1/5 bg-slate-400 rounded-px"></div>
            </div>
            <div className="space-y-1 w-full">
              <div className="h-1 w-full bg-slate-200 rounded-px"></div>
              <div className="h-1 w-full bg-slate-200 rounded-px"></div>
              <div className="h-1 w-3/4 bg-slate-200 rounded-px"></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between w-full mb-0.5">
              <div className="h-1 w-2/5 bg-slate-700 rounded-px"></div>
              <div className="h-1 w-1/6 bg-slate-400 rounded-px"></div>
            </div>
            <div className="space-y-1 w-full">
              <div className="h-1 w-full bg-slate-200 rounded-px"></div>
              <div className="h-1 w-5/6 bg-slate-200 rounded-px"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (type === "Creative / Portfolio") {
    return (
      <div className="w-full h-full bg-[#fdfbf7] p-2 flex flex-col gap-2 rounded-sm overflow-hidden border border-orange-200/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-400 to-orange-400 shrink-0 shadow-sm border border-white"></div>
          <div className="flex flex-col gap-1 w-full">
            <div className="h-2 w-2/3 bg-zinc-800 rounded-sm"></div>
            <div className="h-1.5 w-1/3 bg-orange-400/80 rounded-sm"></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="h-10 bg-zinc-100 rounded-sm border border-zinc-200/60 p-1 flex items-end">
            <div className="h-1 w-1/2 bg-zinc-300 rounded-px"></div>
          </div>
          <div className="h-10 bg-zinc-100 rounded-sm border border-zinc-200/60 p-1 flex items-end">
            <div className="h-1 w-2/3 bg-zinc-300 rounded-px"></div>
          </div>
        </div>
        <div className="h-1.5 w-1/3 bg-zinc-800 rounded-sm mt-1"></div>
        <div className="space-y-1">
          <div className="h-1 w-full bg-zinc-300 rounded-px"></div>
          <div className="h-1 w-full bg-zinc-300 rounded-px"></div>
          <div className="h-1 w-4/5 bg-zinc-300 rounded-px"></div>
        </div>
      </div>
    );
  }
  if (type === "Photography / Visual") {
    return (
      <div className="w-full h-full bg-zinc-950 p-2 flex flex-col gap-2 rounded-sm overflow-hidden border border-zinc-800">
        <div className="flex justify-center w-full mb-1">
           <div className="h-2 w-1/3 bg-zinc-100 tracking-[0.2em] rounded-sm"></div>
        </div>
        <div className="columns-2 gap-1.5 space-y-1.5">
           <div className="w-full h-8 bg-zinc-800 rounded-sm opacity-80 border border-zinc-700"></div>
           <div className="w-full h-12 bg-zinc-800 rounded-sm opacity-80 border border-zinc-700"></div>
           <div className="w-full h-10 bg-zinc-800 rounded-sm opacity-80 border border-zinc-700"></div>
           <div className="w-full h-6 bg-zinc-800 rounded-sm opacity-80 border border-zinc-700"></div>
        </div>
        <div className="flex-1"></div>
        <div className="flex justify-center flex-wrap gap-1 mt-auto pb-1">
          <div className="h-0.5 w-6 bg-zinc-500 rounded-px"></div>
          <div className="h-0.5 w-6 bg-zinc-500 rounded-px"></div>
          <div className="h-0.5 w-6 bg-zinc-500 rounded-px"></div>
        </div>
      </div>
    );
  }
  // Academic / Research
  return (
    <div className="w-full h-full bg-white border border-zinc-200 p-2.5 flex flex-col gap-1.5 rounded-sm overflow-hidden">
      <div className="h-2.5 w-2/5 bg-zinc-900 mb-1.5 rounded-sm"></div>
      
      <div className="flex gap-2.5 mb-1.5">
        <div className="w-0.5 h-full bg-zinc-300 ml-1 rounded-full"></div>
        <div className="flex flex-col gap-1.5 w-full -ml-1">
          <div className="h-1.5 w-3/4 bg-zinc-400 rounded-px"></div>
          <div className="h-1 w-full bg-zinc-200 rounded-px"></div>
          <div className="h-1 w-5/6 bg-zinc-200 rounded-px"></div>
        </div>
      </div>
      
       <div className="flex gap-2.5 mb-1.5">
        <div className="w-0.5 h-full bg-zinc-300 ml-1 rounded-full"></div>
        <div className="flex flex-col gap-1.5 w-full -ml-1">
          <div className="h-1.5 w-2/3 bg-zinc-400 rounded-px"></div>
          <div className="h-1 w-full bg-zinc-200 rounded-px"></div>
        </div>
      </div>
      
      <div className="flex gap-2.5">
        <div className="w-0.5 h-full bg-zinc-300 ml-1 rounded-full"></div>
        <div className="flex flex-col gap-1.5 w-full -ml-1">
          <div className="h-1.5 w-4/5 bg-zinc-400 rounded-px"></div>
          <div className="h-1 w-11/12 bg-zinc-200 rounded-px"></div>
        </div>
      </div>
    </div>
  );
}

const TEMPLATES = [
  { id: "Modern & Clean", name: "Modern & Clean", description: "Minimalist and professional layout." },
  { id: "Tech Focused", name: "Tech Focused", description: "Highlight skills and projects for IT roles." },
  { id: "Executive", name: "Executive", description: "Traditional, authoritative structure." },
  { id: "Creative / Portfolio", name: "Creative / Portfolio", description: "Vibrant visual identity for design roles." },
  { id: "Photography / Visual", name: "Photography / Visual", description: "Grid layout for prioritizing image portfolios." },
  { id: "Academic / Research", name: "Academic / Research", description: "Detailed format for publications and studies." }
];

export function ResumeGenerationForm({ onSubmit, isGenerating }: { onSubmit: (data: any) => void; isGenerating: boolean }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [template, setTemplate] = useState("Modern & Clean");
  const [targetRoleSelect, setTargetRoleSelect] = useState("");
  const [targetRole, setTargetRole] = useState("");
  
  const [personalInfo, setPersonalInfo] = useState({
    name: "",
    email: "",
    phone: "",
    linkedin: "",
    github: "",
    portfolio: ""
  });

  const [workHistory, setWorkHistory] = useState([
    { company: "", role: "", startDate: "", endDate: "", responsibilities: "" }
  ]);

  const [education, setEducation] = useState([
    { university: "", degree: "", year: "" }
  ]);

  const [skills, setSkills] = useState("");

  const handleWorkChange = (index: number, field: string, value: string) => {
    const newWork = [...workHistory];
    newWork[index] = { ...newWork[index], [field]: value };
    setWorkHistory(newWork);
  };

  const addWork = () => setWorkHistory([...workHistory, { company: "", role: "", startDate: "", endDate: "", responsibilities: "" }]);
  const removeWork = (index: number) => setWorkHistory(workHistory.filter((_, i) => i !== index));

  const handleEduChange = (index: number, field: string, value: string) => {
    const newEdu = [...education];
    newEdu[index] = { ...newEdu[index], [field]: value };
    setEducation(newEdu);
  };

  const addEdu = () => setEducation([...education, { university: "", degree: "", year: "" }]);
  const removeEdu = (index: number) => setEducation(education.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      template,
      targetRole: targetRoleSelect === "Other" ? targetRole : targetRoleSelect,
      personalInfo,
      workHistory,
      education,
      skills
    });
  };

  if (step === 1) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Choose a template</h2>
          <p className="text-zinc-500 mt-2">Start with a design, then easily customize it with your details.</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEMPLATES.map(t => (
            <Card 
              key={t.id} 
              className={`cursor-pointer overflow-hidden border-2 transition-all hover:border-indigo-400 group ${template === t.id ? 'border-indigo-600 ring-4 ring-indigo-500/10 dark:ring-indigo-500/20' : 'border-zinc-200 dark:border-zinc-800'}`} 
              onClick={() => setTemplate(t.id)}
            >
              <div className="aspect-[1/1.2] bg-zinc-100/50 dark:bg-zinc-900/50 p-6 flex flex-col justify-center transition-transform group-hover:scale-[1.02]">
                 <MiniTemplatePreview type={t.id} />
              </div>
              <div className="p-4 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-900">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{t.name}</h3>
                <p className="text-xs text-zinc-500 mt-1">{t.description}</p>
              </div>
            </Card>
          ))}
        </div>
        
        <div className="flex justify-end pt-6 border-t border-zinc-200 dark:border-zinc-800 mt-8">
          <Button onClick={() => setStep(2)} disabled={!template} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-11 px-8 rounded-full text-base">
            Customize this template <ChevronRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm w-full mx-auto max-w-4xl relative animate-in slide-in-from-right-4 duration-300">
      <CardHeader className="text-center relative pb-8 border-b border-zinc-100 dark:border-zinc-800">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setStep(1)} 
          className="absolute left-6 top-6 h-9 w-9 rounded-full bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <CardTitle className="text-2xl mt-2">Fill in your details</CardTitle>
        <CardDescription>We'll use this information to draft your resume</CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <form onSubmit={handleSubmit} className="space-y-10">
          
          {/* Target Role & Selected Template status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selected Template</label>
              <div className="flex items-center h-10 px-3 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                <LayoutTemplate className="w-4 h-4 mr-2 text-indigo-500" />
                {template}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Role <span className="text-red-500">*</span></label>
              <select
                required
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
                value={targetRoleSelect}
                onChange={(e) => {
                  const val = e.target.value;
                  setTargetRoleSelect(val);
                  if (val !== "Other") setTargetRole(val);
                  else setTargetRole("");
                }}
              >
                <option value="" disabled>Select an option...</option>
                {COMMON_ROLES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {targetRoleSelect === "Other" && (
                <Input
                  required
                  placeholder="Please specify your target role..."
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="bg-white dark:bg-zinc-900 mt-2"
                />
              )}
            </div>
          </div>

          {/* Personal Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2"><User className="w-5 h-5 text-zinc-400" /> Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name <span className="text-red-500">*</span></label>
                <Input required value={personalInfo.name} onChange={e => setPersonalInfo({...personalInfo, name: e.target.value})} className="bg-white dark:bg-zinc-900" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email <span className="text-red-500">*</span></label>
                <Input type="email" required value={personalInfo.email} onChange={e => setPersonalInfo({...personalInfo, email: e.target.value})} className="bg-white dark:bg-zinc-900" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input value={personalInfo.phone} onChange={e => setPersonalInfo({...personalInfo, phone: e.target.value})} className="bg-white dark:bg-zinc-900" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">LinkedIn URL</label>
                <Input value={personalInfo.linkedin} onChange={e => setPersonalInfo({...personalInfo, linkedin: e.target.value})} className="bg-white dark:bg-zinc-900" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">GitHub URL</label>
                <Input value={personalInfo.github} onChange={e => setPersonalInfo({...personalInfo, github: e.target.value})} className="bg-white dark:bg-zinc-900" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Portfolio / Website URL</label>
                <Input value={personalInfo.portfolio} onChange={e => setPersonalInfo({...personalInfo, portfolio: e.target.value})} className="bg-white dark:bg-zinc-900" />
              </div>
            </div>
          </div>

          {/* Work History */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-semibold">Work History</h3>
              <Button type="button" variant="outline" size="sm" onClick={addWork} className="rounded-full">
                <Plus className="w-4 h-4 mr-2" /> Add Job
              </Button>
            </div>
            {workHistory.map((work, idx) => (
              <div key={idx} className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4 bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm text-zinc-600 dark:text-zinc-400">Position #{idx + 1}</h4>
                  {workHistory.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeWork(idx)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 h-8 px-2">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Job Title / Role <span className="text-red-500">*</span></label>
                    <Input required={idx === 0} value={work.role} onChange={e => handleWorkChange(idx, "role", e.target.value)} className="bg-white dark:bg-zinc-950" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Company Name</label>
                    <Input value={work.company} onChange={e => handleWorkChange(idx, "company", e.target.value)} className="bg-white dark:bg-zinc-950" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <Input placeholder="e.g., Jan 2020" value={work.startDate} onChange={e => handleWorkChange(idx, "startDate", e.target.value)} className="bg-white dark:bg-zinc-950" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Date</label>
                    <Input placeholder="e.g., Present or Dec 2023" value={work.endDate} onChange={e => handleWorkChange(idx, "endDate", e.target.value)} className="bg-white dark:bg-zinc-950" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Responsibilities & Achievements</label>
                    <Textarea 
                      placeholder="Describe your impact, scale, and technical stack used..." 
                      className="min-h-[100px] bg-white dark:bg-zinc-950" 
                      value={work.responsibilities} 
                      onChange={e => handleWorkChange(idx, "responsibilities", e.target.value)} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Education */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-lg font-semibold">Education</h3>
              <Button type="button" variant="outline" size="sm" onClick={addEdu} className="rounded-full">
                <Plus className="w-4 h-4 mr-2" /> Add Education
              </Button>
            </div>
            {education.map((edu, idx) => (
              <div key={idx} className="p-5 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4 bg-zinc-50 dark:bg-zinc-900/50">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm text-zinc-600 dark:text-zinc-400">Education #{idx + 1}</h4>
                  {education.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeEdu(idx)} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 h-8 px-2">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Institution / University <span className="text-red-500">*</span></label>
                    <Input required={idx === 0} value={edu.university} onChange={e => handleEduChange(idx, "university", e.target.value)} className="bg-white dark:bg-zinc-950" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Degree / Field of Study</label>
                    <Input placeholder="e.g., B.S. Computer Science" value={edu.degree} onChange={e => handleEduChange(idx, "degree", e.target.value)} className="bg-white dark:bg-zinc-950" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Graduation Year</label>
                    <Input placeholder="e.g., 2022" value={edu.year} onChange={e => handleEduChange(idx, "year", e.target.value)} className="bg-white dark:bg-zinc-950" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Skills */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">Skills & Additional Info</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">Core Skills (comma separated)</label>
              <Textarea 
                placeholder="React, Node.js, Python, Leadership, Agile, AWS..." 
                className="min-h-[80px] bg-white dark:bg-zinc-900"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
              />
            </div>
          </div>
          
          <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <Button
              type="submit"
              disabled={isGenerating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md h-12 text-base rounded-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing and Drafting Template...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate Resume Workspace
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
