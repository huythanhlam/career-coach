import React, { useState } from "react";
import {
  Building,
  Map,
  LineChart,
  MessageSquare,
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
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
      analyzeResume("Please use the attached resume file.", jobInput, "").then(res => {
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
      <div className="flex-1 overflow-auto no-scrollbar" style={{ background: "var(--background)", padding: "32px 40px 80px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}
          className="animate-in fade-in slide-in-from-bottom-4 duration-700">

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 22, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Your action plan</div>
              <h1 className="font-display" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--foreground)", margin: 0 }}>
                Strategy for <em style={{ color: "var(--primary)", fontStyle: "normal" }}>{jobInput}</em>
              </h1>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveAnalysis} style={{ height: 44, padding: "0 18px", background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Save plan
              </button>
              <button onClick={() => { setStep("intake"); setMarketData(null); setCompanyIntel(null); setResumeFit(null); setInterviewStrategy(null); }} style={{ height: 44, padding: "0 18px", background: "var(--foreground)", color: "var(--background)", border: "1px solid var(--foreground)", borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Start new
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
            {/* Market comp */}
            <ResultCard
              icon={<LineChart className="w-4 h-4" />}
              iconBg="rgba(217,119,87,0.10)" iconBorder="rgba(217,119,87,0.25)" iconColor="var(--primary)"
              title="Market compensation"
              badge="Live data"
              style={{ gridColumn: "1 / 2", gridRow: "1 / 2" }}
              height={480}
            >
              {marketData ? <MarketCompensationViz data={marketData} /> : <EmptySlot>Loading market data…</EmptySlot>}
            </ResultCard>

            {/* Company intel */}
            <ResultCard
              icon={<Building className="w-4 h-4" />}
              iconBg="rgba(47,107,79,0.10)" iconBorder="rgba(47,107,79,0.25)" iconColor="var(--forest)"
              title="Company intel"
              height={480}
            >
              {companyIntel
                ? <div className="prose prose-sm max-w-none" style={{ color: "var(--muted-foreground)" }}><Markdown rehypePlugins={[rehypeRaw]}>{companyIntel}</Markdown></div>
                : <EmptySlot>Loading intel…</EmptySlot>}
            </ResultCard>

            {/* Resume fit */}
            <ResultCard
              icon={<FileText className="w-4 h-4" />}
              iconBg="rgba(232,185,72,0.12)" iconBorder="rgba(232,185,72,0.30)" iconColor="#B8860B"
              title="Resume fit"
              height={400}
            >
              {resumeFit ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                  {resumeFit.annotations?.map((ann: any, i: number) => (
                    <li key={i} style={{ display: "flex", gap: 10, fontSize: 13 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", marginTop: 6, flexShrink: 0 }} />
                      <div>
                        <span style={{ fontWeight: 600, color: "var(--foreground)" }}>"{ann.textToHighlight}"</span><br />
                        <span style={{ color: "var(--muted-foreground)" }}>{ann.suggestion}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptySlot>{resumeData ? "Analyzing résumé…" : "No résumé provided."}</EmptySlot>
              )}
            </ResultCard>

            {/* Interview strategy */}
            <ResultCard
              icon={<MessageSquare className="w-4 h-4" />}
              iconBg="rgba(59,130,246,0.10)" iconBorder="rgba(59,130,246,0.25)" iconColor="#3B82F6"
              title="Interview strategy"
              style={{ gridColumn: "1 / 3" }}
              height={400}
            >
              {interviewStrategy
                ? <div className="prose prose-sm max-w-none" style={{ color: "var(--muted-foreground)" }}><Markdown rehypePlugins={[rehypeRaw]}>{interviewStrategy}</Markdown></div>
                : <EmptySlot>Drafting strategy…</EmptySlot>}
            </ResultCard>
          </div>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    const steps = [
      { key: "resume",    label: "Aligning résumé…" },
      { key: "market",    label: "Pricing market compensation…" },
      { key: "interview", label: "Drafting interview guide…" },
      { key: "company",   label: "Researching company intel…" },
    ] as const;
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--background)", padding: 24 }}>
        <div style={{ maxWidth: 440, width: "100%", padding: "40px 40px 36px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 32, boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-5" style={{ color: "var(--primary)" }} />
            <h2 className="font-display" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--foreground)", margin: "0 0 8px" }}>
              Building your plan
            </h2>
            <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: 0 }}>
              Pulling together comp data, company intel, and a prep guide.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {steps.map(({ key, label }) => {
              const done = generationProgress[key] === "done";
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {done
                    ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "var(--forest)" }} />
                    : <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: "var(--muted-foreground)" }} />}
                  <span style={{ fontSize: 14, fontWeight: done ? 600 : 400, color: done ? "var(--foreground)" : "var(--muted-foreground)" }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto no-scrollbar" style={{ background: "var(--background)", padding: "32px 40px 80px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 760, width: "100%" }}
        className="animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Hero copy */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Strategy Engine · Auto-pilot</div>
          <h1 className="font-display" style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)", lineHeight: 1.05, margin: 0 }}>
            Let's build your{" "}
            <em style={{ color: "var(--primary)", fontStyle: "normal" }}>next chapter.</em>
          </h1>
          <p style={{ fontSize: 16, color: "var(--muted-foreground)", marginTop: 14, maxWidth: 540, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
            Tell us where you want to go. We'll bring back the comp data, the company intel, and a prep plan — together, in one read.
          </p>
        </div>

        {/* Form card */}
        <form onSubmit={handleStartAnalysis} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 28, boxShadow: "0 8px 30px rgba(0,0,0,0.04)", padding: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Step 1 */}
            <FormStep n={1} label="What role are you targeting?">
              <input
                required
                placeholder="e.g., Senior Software Engineer at Stripe"
                value={jobInput}
                onChange={e => setJobInput(e.target.value)}
                style={inputStyle}
              />
            </FormStep>

            {/* Step 2 */}
            <FormStep n={2} label="What's your experience level?">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input
                  required
                  type="number"
                  placeholder="Years of experience"
                  value={yoe}
                  onChange={e => setYoe(e.target.value)}
                  style={inputStyle}
                />
                <select
                  required
                  value={level}
                  onChange={e => setLevel(e.target.value)}
                  style={inputStyle}
                >
                  <option value="" disabled>Select level…</option>
                  <option value="entry">Entry-Level / Junior</option>
                  <option value="mid">Mid-Level</option>
                  <option value="senior">Senior</option>
                  <option value="staff">Staff / Principal</option>
                  <option value="manager">Manager / Director</option>
                </select>
              </div>
            </FormStep>

            {/* Step 3 */}
            <FormStep n={3} label="Drop in your current résumé">
              <label htmlFor="resume-upload" style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "28px 20px",
                border: `1.5px dashed ${resumeData ? "var(--forest)" : "var(--border)"}`,
                borderRadius: 18,
                background: resumeData ? "rgba(47,107,79,0.04)" : "var(--muted)",
                cursor: "pointer", textAlign: "center",
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center",
                  justifyContent: "center", border: "1px solid var(--border)",
                  background: resumeData ? "rgba(47,107,79,0.10)" : "var(--card)",
                  color: resumeData ? "var(--forest)" : "var(--muted-foreground)",
                }}>
                  {resumeData ? <CheckCircle2 className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                  {resumeData ? resumeData.name : "Drag a PDF or click to browse"}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  {resumeData ? "Tap to replace" : "PDF or DOCX, up to 5 MB"}
                </div>
                <input id="resume-upload" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
              </label>
            </FormStep>
          </div>

          <div style={{ paddingLeft: 40, paddingTop: 24 }}>
            <button type="submit" style={{
              width: "100%", height: 52, background: "var(--primary)", color: "#FFF",
              border: "1px solid var(--primary)", borderRadius: 14, fontFamily: "inherit",
              fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(217,119,87,0.25)",
            }}>
              <Sparkles className="w-4 h-4" /> Build my plan
            </button>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center", marginTop: 10 }}>
              Takes about 30 seconds. We'll never share your résumé.
            </div>
          </div>
        </form>

        {/* Previous strategies */}
        {savedAnalyses.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Previous strategies</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {savedAnalyses.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadAnalysis(item)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: 16, background: "var(--card)", border: "1px solid var(--border)",
                    borderRadius: 18, cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                  className="group hover:border-primary/30 transition-colors"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}>
                      <Map className="w-5 h-5" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{item.jobInput || "Untitled Role"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                        {item.level} · {item.yoe} YOE{item.resumeData ? ` · ${item.resumeData.name}` : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      {new Date(parseInt(item.id)).toLocaleDateString()}
                    </span>
                    <Button variant="ghost" size="sm" onClick={(e) => deleteAnalysis(item.id, e)} className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
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

/* ── Shared helpers ──────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: "100%", height: 52, background: "var(--muted)", border: "1px solid var(--border)",
  borderRadius: 14, padding: "0 16px", fontFamily: "inherit", fontSize: 15,
  color: "var(--foreground)", outline: "none",
};

function FormStep({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%", background: "var(--muted)",
          border: "1px solid var(--border)", color: "var(--primary)", display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>{n}</div>
        <label style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>{label}</label>
      </div>
      <div style={{ paddingLeft: 40 }}>{children}</div>
    </div>
  );
}

function ResultCard({
  icon, iconBg, iconBorder, iconColor, title, badge, children, style = {}, height = 400,
}: {
  icon: React.ReactNode; iconBg: string; iconBorder: string; iconColor: string;
  title: string; badge?: string; children: React.ReactNode;
  style?: React.CSSProperties; height?: number;
}) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.04)", ...style }}>
      <div style={{ padding: "18px 22px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: iconBg, border: `1px solid ${iconBorder}`, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>{title}</div>
        {badge && (
          <span style={{ marginLeft: "auto", background: "rgba(217,119,87,0.10)", color: "var(--primary)", border: "1px solid rgba(217,119,87,0.25)", padding: "4px 10px", borderRadius: 9999, fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase" }}>{badge}</span>
        )}
      </div>
      <div style={{ padding: "20px 22px", height, overflowY: "auto" }} className="no-scrollbar">
        {children}
      </div>
    </div>
  );
}

function EmptySlot({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted-foreground)", fontSize: 14 }}>
      {children}
    </div>
  );
}
