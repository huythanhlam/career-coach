import React, { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, ChevronDown, ChevronUp, X } from "lucide-react";
import { ResumeFormState, ResumeFormAction } from "./resumeFormReducer";

interface Props {
  state: Pick<ResumeFormState, "showImport" | "importText" | "importType" | "isImporting" | "importError">;
  dispatch: React.Dispatch<ResumeFormAction>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, type: "linkedin" | "resume") => void;
  onImport: () => void;
}

export function ImportSection({ state, dispatch, onFileUpload, onImport }: Props) {
  const { showImport, importText, importType, isImporting, importError } = state;
  const linkedinFileRef = useRef<HTMLInputElement>(null);
  const resumeFileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-6" style={{ border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => { dispatch({ type: "SET_SHOW_IMPORT", payload: !showImport }); dispatch({ type: "SET_IMPORT_ERROR", payload: null }); }}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold"
        style={{ background: "var(--muted)", border: "none", cursor: "pointer", color: "var(--foreground)", fontFamily: "inherit" }}
      >
        <span className="flex items-center gap-2">
          <Upload className="w-4 h-4" style={{ color: "var(--primary)" }} />
          Import from LinkedIn or Resume
        </span>
        {showImport ? <ChevronUp className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />}
      </button>
      {showImport && (
        <div style={{ padding: 20, borderTop: "1px solid var(--border)", background: "var(--card)" }}>
          <div className="flex gap-2 mb-4">
            {(["linkedin", "resume"] as const).map((t) => (
              <button key={t} type="button" onClick={() => { dispatch({ type: "SET_IMPORT_TYPE", payload: t }); dispatch({ type: "SET_IMPORT_ERROR", payload: null }); }}
                style={{ padding: "5px 14px", borderRadius: 9999, fontSize: 12, fontWeight: 600, border: "1px solid", fontFamily: "inherit", cursor: "pointer", background: importType === t ? "var(--primary)" : "transparent", borderColor: importType === t ? "var(--primary)" : "var(--border)", color: importType === t ? "#fff" : "var(--muted-foreground)" }}>
                {t === "linkedin" ? "LinkedIn" : "Resume"}
              </button>
            ))}
          </div>

          {importType === "linkedin" ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                On LinkedIn, go to your profile → <strong>More → Save to PDF</strong>. Upload that file here and we'll extract your work history, education, and skills automatically.
              </p>
              <input ref={linkedinFileRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={(e) => onFileUpload(e, "linkedin")} />
              <button type="button" disabled={isImporting} onClick={() => linkedinFileRef.current?.click()}
                style={{ width: "100%", padding: "28px 0", border: "2px dashed var(--border)", borderRadius: 12, background: "var(--muted)", cursor: isImporting ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
                {isImporting ? (
                  <><Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} /><span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Extracting from PDF…</span></>
                ) : (
                  <><Upload className="w-6 h-6" style={{ color: "var(--primary)" }} /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Upload LinkedIn PDF</span><span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>LinkedIn profile exported as PDF</span></>
                )}
              </button>
              <details>
                <summary style={{ fontSize: 12, color: "var(--muted-foreground)", cursor: "pointer", userSelect: "none" }}>Paste profile text instead</summary>
                <div style={{ marginTop: 10 }}>
                  <Textarea value={importText} onChange={(e) => dispatch({ type: "SET_IMPORT_TEXT", payload: e.target.value })} placeholder="Paste your LinkedIn About + Experience text here…" className="min-h-[100px] resize-y mb-2" style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "var(--foreground)", width: "100%" }} />
                  <button type="button" disabled={!importText.trim() || isImporting} onClick={onImport} style={{ height: 38, padding: "0 18px", background: isImporting || !importText.trim() ? "var(--muted-foreground)" : "var(--primary)", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", cursor: isImporting || !importText.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    {isImporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting…</> : <><Upload className="w-3.5 h-3.5" /> Extract & Fill Form</>}
                  </button>
                </div>
              </details>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Upload your resume (PDF, DOCX, or TXT) and we'll extract your experience, education, and skills automatically.
              </p>
              <input ref={resumeFileRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" style={{ display: "none" }} onChange={(e) => onFileUpload(e, "resume")} />
              <button type="button" disabled={isImporting} onClick={() => resumeFileRef.current?.click()}
                style={{ width: "100%", padding: "28px 0", border: "2px dashed var(--border)", borderRadius: 12, background: "var(--muted)", cursor: isImporting ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
                {isImporting ? (
                  <><Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} /><span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Extracting…</span></>
                ) : (
                  <><Upload className="w-6 h-6" style={{ color: "var(--primary)" }} /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Click to upload resume</span><span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>PDF or TXT</span></>
                )}
              </button>
              <details>
                <summary style={{ fontSize: 12, color: "var(--muted-foreground)", cursor: "pointer", userSelect: "none" }}>Paste resume text instead</summary>
                <div style={{ marginTop: 10 }}>
                  <Textarea value={importText} onChange={(e) => dispatch({ type: "SET_IMPORT_TEXT", payload: e.target.value })} placeholder="Paste your plain-text resume here…" className="min-h-[100px] resize-y mb-2" style={{ background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "var(--foreground)", width: "100%" }} />
                  <button type="button" disabled={!importText.trim() || isImporting} onClick={onImport} style={{ height: 38, padding: "0 18px", background: isImporting || !importText.trim() ? "var(--muted-foreground)" : "var(--primary)", border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", cursor: isImporting || !importText.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    {isImporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting…</> : <><Upload className="w-3.5 h-3.5" /> Extract & Fill Form</>}
                  </button>
                </div>
              </details>
            </div>
          )}

          {importError && (
            <div className="flex items-start gap-2 mt-3" style={{ padding: "10px 14px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 10 }}>
              <X className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
              <span style={{ fontSize: 12, color: "#dc2626" }}>{importError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
