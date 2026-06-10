import React, { useRef } from "react";
import { Plus, Loader2, Upload, FileText, CheckCircle2, Info, Scissors, LayoutTemplate, X } from "lucide-react";
import { ResumeFormState, ResumeFormAction } from "./resumeFormReducer";

interface Props {
  state: Pick<ResumeFormState, "startMethod" | "step0Uploading" | "step0Error" | "step0ResumeUploaded" | "processingChoice">;
  dispatch: React.Dispatch<ResumeFormAction>;
  onStep0Upload: (e: React.ChangeEvent<HTMLInputElement>, type: "linkedin" | "resume") => void;
  onResumeChoice: (choice: "analyze" | "tailor" | "editor") => void;
  hasAnalyze: boolean;
  hasTailor: boolean;
  hasImportToEditor: boolean;
}

export function Step0StartMethod({ state, dispatch, onStep0Upload, onResumeChoice, hasAnalyze, hasTailor, hasImportToEditor }: Props) {
  const { startMethod, step0Uploading, step0Error, step0ResumeUploaded, processingChoice } = state;
  const step0LinkedinRef = useRef<HTMLInputElement>(null);
  const step0ResumeRef = useRef<HTMLInputElement>(null);

  const cardBase: React.CSSProperties = { borderRadius: 20, border: "2px solid var(--border)", background: "var(--card)", overflow: "hidden", display: "flex", flexDirection: "column", transition: "border-color 0.15s, box-shadow 0.15s", cursor: "pointer" };
  const cardActive: React.CSSProperties = { borderColor: "var(--primary)", boxShadow: "0 0 0 3px rgba(217,119,87,0.12)" };

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
      <div className="text-center mb-10">
        <h2 className="font-display text-3xl font-semibold" style={{ color: "var(--foreground)" }}>How would you like to start?</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>Choose a starting point — you can edit everything afterward.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Start fresh */}
        <div style={{ ...cardBase, ...(startMethod === "scratch" ? cardActive : {}) }} onClick={() => { dispatch({ type: "SET_START_METHOD", payload: "scratch" }); dispatch({ type: "SET_STEP", payload: 1 }); }}>
          <div style={{ padding: "32px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flex: 1 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(217,119,87,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus className="w-6 h-6" style={{ color: "var(--primary)" }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", textAlign: "center" }}>Start fresh</div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.5 }}>Build from scratch using your profile details.</div>
          </div>
          <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", background: "var(--muted)", textAlign: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>Choose template →</span>
          </div>
        </div>

        {/* Import LinkedIn PDF */}
        <div style={{ ...cardBase, ...(startMethod === "linkedin" ? cardActive : {}) }} onClick={() => step0LinkedinRef.current?.click()}>
          <div style={{ padding: "32px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flex: 1 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(10,102,194,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {step0Uploading === "linkedin" ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#0a66c2" }} /> : <Upload className="w-6 h-6" style={{ color: "#0a66c2" }} />}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", textAlign: "center" }}>Import LinkedIn PDF or DOCX</div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.5 }}>Go to LinkedIn → profile → <strong>More → Save to PDF</strong>, then upload here.</div>
          </div>
          <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", background: "var(--muted)", textAlign: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0a66c2" }}>{step0Uploading === "linkedin" ? "Importing…" : "Upload PDF / DOCX →"}</span>
          </div>
          <input ref={step0LinkedinRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: "none" }} onChange={(e) => onStep0Upload(e, "linkedin")} />
        </div>

        {/* Import existing resume */}
        <div style={{ ...cardBase, ...(startMethod === "resume" ? cardActive : {}) }} onClick={() => { dispatch({ type: "SET_STEP0_ERROR", payload: null }); step0ResumeRef.current?.click(); }}>
          <div style={{ padding: "32px 24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flex: 1 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(47,107,79,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {step0Uploading === "resume" ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--forest)" }} /> : <FileText className="w-6 h-6" style={{ color: "var(--forest)" }} />}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)", textAlign: "center" }}>Upload a resume</div>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)", textAlign: "center", lineHeight: 1.5 }}>Upload your current resume to analyze, improve, or tailor it to a job description.</div>
          </div>
          <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", background: "var(--muted)", textAlign: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--forest)" }}>{step0Uploading === "resume" ? "Extracting…" : "Upload PDF / DOCX →"}</span>
          </div>
          <input ref={step0ResumeRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" style={{ display: "none" }} onChange={(e) => onStep0Upload(e, "resume")} />
        </div>
      </div>

      {step0ResumeUploaded && (
        <div className="mt-6 animate-in fade-in duration-300" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--forest)" }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)" }}>{step0ResumeUploaded.fileName}</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 18 }}>What would you like to do with this resume?</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {hasAnalyze && (
              <button type="button" disabled={!!processingChoice} onClick={() => onResumeChoice("analyze")}
                style={{ borderRadius: 16, border: "2px solid var(--border)", background: "var(--card)", cursor: processingChoice ? "wait" : "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: "18px 20px", transition: "border-color 0.15s, box-shadow 0.15s", textAlign: "left", opacity: processingChoice && processingChoice !== "analyze" ? 0.5 : 1 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(217,119,87,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(217,119,87,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {processingChoice === "analyze" ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} /> : <Info className="w-5 h-5" style={{ color: "var(--primary)" }} />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>{processingChoice === "analyze" ? "Importing…" : "Analyze my resume"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>Get an AI score and improvement tips.</div>
                </div>
              </button>
            )}
            {hasTailor && (
              <button type="button" disabled={!!processingChoice} onClick={() => onResumeChoice("tailor")}
                style={{ borderRadius: 16, border: "2px solid var(--border)", background: "var(--card)", cursor: processingChoice ? "wait" : "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: "18px 20px", transition: "border-color 0.15s, box-shadow 0.15s", textAlign: "left", opacity: processingChoice && processingChoice !== "tailor" ? 0.5 : 1 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--highlight)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,185,72,0.18)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(232,185,72,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {processingChoice === "tailor" ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--highlight)" }} /> : <Scissors className="w-5 h-5" style={{ color: "var(--highlight)" }} />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>{processingChoice === "tailor" ? "Importing…" : "Tailor to a job"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>Match it to a specific job description.</div>
                </div>
              </button>
            )}
            {hasImportToEditor && (
              <button type="button" disabled={!!processingChoice} onClick={() => onResumeChoice("editor")}
                style={{ borderRadius: 16, border: "2px solid var(--border)", background: "var(--card)", cursor: processingChoice ? "wait" : "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, padding: "18px 20px", transition: "border-color 0.15s, box-shadow 0.15s", textAlign: "left", opacity: processingChoice && processingChoice !== "editor" ? 0.5 : 1 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(217,119,87,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(217,119,87,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {processingChoice === "editor" ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} /> : <LayoutTemplate className="w-5 h-5" style={{ color: "var(--primary)" }} />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>{processingChoice === "editor" ? "Importing…" : "Open in editor"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>Drop it into a clean template, ready to edit.</div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {step0Error && (
        <div className="flex items-center gap-2 mt-5" style={{ padding: "10px 16px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 10 }}>
          <X className="w-4 h-4 shrink-0" style={{ color: "#dc2626" }} />
          <span style={{ fontSize: 13, color: "#dc2626" }}>{step0Error}</span>
        </div>
      )}
    </div>
  );
}
