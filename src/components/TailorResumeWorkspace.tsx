import { useState, useCallback } from "react";
import { Scissors, Sparkles, CheckCircle2, X, Loader2, Save, FileText, ArrowLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocumentEditor } from "@/components/DocumentEditor";
import { useUserProfile } from "@/context/UserProfileContext";
import { useAuth } from "@/context/AuthContext";
import { tailorResume, type TailorSuggestion } from "@/services/geminiService";
import { uploadResume, downloadResume } from "@/services/resumeStorageService";
import { JobDetailsSection, type JobDetailsValue } from "@/components/JobDetailsSection";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const PRIORITY_ORDER: Record<'high' | 'medium' | 'low', number> = { high: 0, medium: 1, low: 2 };

const priorityStyles: Record<'high' | 'medium' | 'low', React.CSSProperties> = {
  high:   { background: 'rgba(217,119,87,0.15)', border: '1px solid rgba(217,119,87,0.40)', color: 'var(--primary)' },
  medium: { background: 'rgba(110,101,87,0.10)', border: '1px solid rgba(110,101,87,0.25)', color: 'var(--muted-foreground)' },
  low:    { background: 'rgba(110,101,87,0.05)', border: '1px solid rgba(110,101,87,0.15)', color: 'var(--muted-foreground)' },
};

const typeLabels: Record<TailorSuggestion['type'], string> = {
  rewrite: 'Rewrite',
  add_keyword: 'Keyword',
  strengthen: 'Strengthen',
};

// ─── Setup screen ──────────────────────────────────────────────────────────────

interface SetupScreenProps {
  onStart: (resumeText: string, resumeName: string, jobDetails: JobDetailsValue) => void;
  onBack?: () => void;
  initialResumeText?: string;
  initialResumeName?: string;
}

function SetupScreen({ onStart, onBack, initialResumeText, initialResumeName }: SetupScreenProps) {
  const { profile } = useUserProfile();
  const { session } = useAuth();
  const [selectedId, setSelectedId] = useState<string>("");
  const [jobDetails, setJobDetails] = useState<JobDetailsValue>({ jobTitle: "", companyName: "", jobDescription: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // When a resume was pre-loaded via file upload, skip the picker
  const hasInitial = !!(initialResumeText && initialResumeName);
  const saved = profile.savedResumes ?? [];

  const handleSubmit = async () => {
    if (!jobDetails.jobDescription.trim()) { setError("Please paste the job description."); return; }

    if (hasInitial) {
      setError("");
      setIsLoading(true);
      try {
        await onStart(initialResumeText!, initialResumeName!, jobDetails);
      } catch (err) {
        setError("Failed to analyze resume. Please try again.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!selectedId) { setError("Please select a resume."); return; }
    const resume = saved.find(r => r.id === selectedId);
    if (!resume || !session?.user?.id) return;

    setError("");
    setIsLoading(true);
    try {
      const text = await downloadResume(resume.storagePath);
      await onStart(text, resume.name, jobDetails);
    } catch (err) {
      setError("Failed to load resume. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit = hasInitial ? true : saved.length > 0 && !!selectedId;

  return (
    <div className="flex flex-col h-full w-full items-center justify-center p-8" style={{ background: "var(--muted)" }}>
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="flex items-center gap-1 text-sm transition-opacity hover:opacity-70" style={{ color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(217,119,87,0.12)", color: "var(--primary)" }}>
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold" style={{ color: "var(--foreground)" }}>Tailor Resume</h1>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Get inline edit suggestions to match a job description — no fake experience, ever.</p>
          </div>
        </div>

        {/* Resume section: either show uploaded file or saved-resume picker */}
        {hasInitial ? (
          <div className="rounded-2xl p-5 flex items-center gap-3" style={{ background: "var(--card)", border: "1px solid rgba(47,107,79,0.35)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(47,107,79,0.10)", color: "var(--forest)" }}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{initialResumeName}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Resume uploaded — ready to tailor</div>
            </div>
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "var(--forest)" }} />
          </div>
        ) : (
          <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <label className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Pick a saved resume</label>

            {saved.length === 0 ? (
              <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3" style={{ background: "rgba(217,119,87,0.08)", color: "var(--primary)" }}>
                <FileText className="w-4 h-4 flex-shrink-0" />
                No saved resumes yet. Use Resume Builder to generate and save one first.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {saved
                  .slice()
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map(r => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150"
                      style={{
                        background: selectedId === r.id ? "rgba(217,119,87,0.10)" : "var(--muted)",
                        border: selectedId === r.id ? "1px solid rgba(217,119,87,0.40)" : "1px solid var(--border)",
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(217,119,87,0.08)", color: "var(--primary)" }}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{r.name}</div>
                        <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                          {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </div>
                      {selectedId === r.id && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "var(--primary)" }} />}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* JD input — shared with the cover-letter flow */}
        <JobDetailsSection value={jobDetails} onChange={setJobDetails} />

        {error && (
          <p className="text-sm px-1" style={{ color: "var(--primary)" }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={isLoading || !canSubmit}
          className="h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity"
          style={{
            background: "var(--primary)",
            color: "#fff",
            opacity: isLoading || !canSubmit ? 0.5 : 1,
            cursor: isLoading || !canSubmit ? "not-allowed" : "pointer",
            border: "none",
          }}
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Tailor Resume</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Suggestions screen ────────────────────────────────────────────────────────

interface SuggestionsScreenProps {
  resumeName: string;
  resumeText: string;
  suggestions: TailorSuggestion[];
  onReset: () => void;
}

function SuggestionsScreen({ resumeName, resumeText, suggestions, onReset }: SuggestionsScreenProps) {
  const { profile, updateProfile } = useUserProfile();
  const { session } = useAuth();
  const [workingText, setWorkingText] = useState(resumeText);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [savedVariant, setSavedVariant] = useState(false);

  const handleApply = useCallback((s: TailorSuggestion) => {
    if (appliedIds.has(s.id)) return;
    setWorkingText(prev => prev.replace(s.originalText, s.suggestedText));
    setAppliedIds(prev => new Set(prev).add(s.id));
  }, [appliedIds]);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
  }, []);

  const handleSaveVariant = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    setIsSaving(true);
    try {
      const id = generateId();
      const storagePath = await uploadResume(userId, id, workingText);
      const existing = profile.savedResumes ?? [];
      await updateProfile({
        savedResumes: [
          ...existing,
          { id, name: `${resumeName} (Tailored)`, storagePath, createdAt: new Date().toISOString() },
        ],
      });
      setSavedVariant(true);
    } catch (err) {
      console.error("Failed to save tailored variant:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const sorted = [...suggestions]
    .filter(s => !dismissedIds.has(s.id))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const pendingCount = sorted.filter(s => !appliedIds.has(s.id)).length;
  const appliedCount = appliedIds.size;

  const suggestionsSidebar = (
    <div className="flex flex-col h-full">
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 46, borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
        <div className="flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Suggestions</span>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            {pendingCount} left · {appliedCount} applied
          </span>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1">
        <div className="p-3 flex flex-col gap-3">
          {sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <CheckCircle2 className="w-8 h-8" style={{ color: "var(--forest)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>All done!</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Save your tailored resume as a new variant.</p>
            </div>
          )}
          {sorted.map(s => {
            const applied = appliedIds.has(s.id);
            return (
              <div
                key={s.id}
                className="rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200"
                style={{
                  background: applied ? "rgba(47,107,79,0.06)" : "var(--card)",
                  border: applied ? "1px solid rgba(47,107,79,0.25)" : "1px solid var(--border)",
                  opacity: applied ? 0.7 : 1,
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide" style={priorityStyles[s.priority]}>
                    {s.priority}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide"
                    style={{ background: "rgba(110,101,87,0.08)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                    {typeLabels[s.type]}
                  </span>
                  <span className="text-[10px] ml-auto truncate max-w-[140px]" style={{ color: "var(--muted-foreground)" }}>{s.section}</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>BEFORE</div>
                  <div className="text-xs px-3 py-2 rounded-lg leading-relaxed"
                    style={{ background: "rgba(217,119,87,0.07)", color: "var(--foreground)", border: "1px solid rgba(217,119,87,0.18)" }}>
                    {s.originalText}
                  </div>
                  <div className="text-[11px] font-semibold mt-1" style={{ color: "var(--muted-foreground)" }}>AFTER</div>
                  <div className="text-xs px-3 py-2 rounded-lg leading-relaxed"
                    style={{ background: "rgba(47,107,79,0.07)", color: "var(--foreground)", border: "1px solid rgba(47,107,79,0.18)" }}>
                    {s.suggestedText}
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{s.rationale}</p>

                {applied ? (
                  <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--forest)" }}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Applied
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => handleApply(s)} className="flex-1 h-8 rounded-lg text-xs font-semibold"
                      style={{ background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer" }}>
                      Apply
                    </button>
                    <button onClick={() => handleDismiss(s.id)} className="h-8 px-3 rounded-lg text-xs font-medium"
                      style={{ background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)", cursor: "pointer" }}>
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Save footer */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", background: "var(--muted)" }}>
        {savedVariant ? (
          <div className="flex items-center justify-center gap-1.5 text-xs font-medium py-1" style={{ color: "var(--forest)" }}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved as new variant
          </div>
        ) : (
          <button
            onClick={handleSaveVariant}
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg transition-opacity"
            style={{ height: 36, background: "var(--primary)", color: "#fff", border: "none", opacity: isSaving ? 0.6 : 1, cursor: isSaving ? "not-allowed" : "pointer" }}
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save as new variant
          </button>
        )}
      </div>
    </div>
  );

  return (
    <DocumentEditor
      content={workingText}
      onChange={setWorkingText}
      title={`${resumeName} — Tailored`}
      exportFileName={resumeName.toLowerCase().replace(/\s+/g, "-") + "-tailored"}
      onClose={onReset}
      customSidebar={suggestionsSidebar}
      aiEnabled={false}
    />
  );
}

// ─── Root export ───────────────────────────────────────────────────────────────

interface TailorResumeWorkspaceProps {
  onBack?: () => void;
  initialResumeText?: string;
  initialResumeName?: string;
}

export function TailorResumeWorkspace({ onBack, initialResumeText, initialResumeName }: TailorResumeWorkspaceProps) {
  const [state, setState] = useState<
    | { phase: 'setup' }
    | { phase: 'results'; resumeName: string; resumeText: string; suggestions: TailorSuggestion[] }
  >({ phase: 'setup' });

  const handleStart = useCallback(async (resumeText: string, resumeName: string, jobDetails: JobDetailsValue) => {
    const suggestions = await tailorResume(resumeText, jobDetails.jobDescription, {
      jobTitle: jobDetails.jobTitle,
      companyName: jobDetails.companyName,
    });
    setState({ phase: 'results', resumeName, resumeText, suggestions });
  }, []);

  if (state.phase === 'setup') {
    return (
      <SetupScreen
        onStart={handleStart}
        onBack={onBack}
        initialResumeText={initialResumeText}
        initialResumeName={initialResumeName}
      />
    );
  }

  return (
    <SuggestionsScreen
      resumeName={state.resumeName}
      resumeText={state.resumeText}
      suggestions={state.suggestions}
      onReset={() => setState({ phase: 'setup' })}
    />
  );
}
