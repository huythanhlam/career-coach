import { useMemo, useState } from "react";
import { Rocket, Loader2, FileText, CheckCircle2, Sparkles, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserProfile } from "@/context/UserProfileContext";
import { useAuth } from "@/context/AuthContext";
import { useJobPostings } from "@/hooks/useJobPostings";
import { useApplicationPackages } from "@/hooks/useApplicationPackages";
import { generatePackage } from "@/services/applicationAutopilot";
import { recordEvent } from "@/services/coachMemory";
import { uploadResume, downloadResume } from "@/services/resumeStorageService";
import type { JobPosting } from "@/types/jobPosting";
import { PackageReview } from "./PackageReview";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const MAX_BATCH = 5;

export function AutopilotWorkspace() {
  const { profile, updateProfile } = useUserProfile();
  const { session } = useAuth();
  const { postings, updatePosting } = useJobPostings();
  const { packages, upsertPackage, updatePackage, deletePackage } = useApplicationPackages();

  const savedResumes = profile.savedResumes ?? [];
  const [baseResumeId, setBaseResumeId] = useState<string>(savedResumes[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busyPkgId, setBusyPkgId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Postings worth applying to: saved + system-suggested, not yet applied/archived.
  const candidatePostings = useMemo(
    () => postings.filter((p) => p.status === "saved" || p.status === "suggested"),
    [postings],
  );
  const postingById = useMemo(() => {
    const m = new Map<string, JobPosting>();
    postings.forEach((p) => m.set(p.id, p));
    return m;
  }, [postings]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_BATCH) next.add(id);
      return next;
    });

  const loadBaseResume = async (): Promise<string | null> => {
    const r = savedResumes.find((x) => x.id === baseResumeId);
    if (!r) return null;
    if (r.text) return r.text;
    try {
      return await downloadResume(r.storagePath);
    } catch {
      return null;
    }
  };

  const generateFor = async (posting: JobPosting, baseResumeText: string) => {
    const queued = await upsertPackage({ jobPostingId: posting.id, packageStatus: "generating" });
    try {
      const result = await generatePackage(posting, profile, baseResumeText);
      await upsertPackage({
        jobPostingId: posting.id,
        fitScore: result.fitScore,
        tailoredResumeText: result.tailoredResumeText,
        coverLetterText: result.coverLetterText,
        packageStatus: "generated",
      });
      // Coach OS: remember that this application was tailored (fire-and-forget).
      void recordEvent(
        "autopilot",
        `Generated a tailored application package for "${posting.title}"${
          posting.company ? ` at ${posting.company}` : ""
        } (fit score ${result.fitScore}/100).`,
      );
    } catch (err) {
      console.error("Package generation failed:", err);
      await upsertPackage({
        jobPostingId: posting.id,
        packageStatus: "failed",
        error: "Couldn't generate this package — try again.",
        ...(queued?.fitScore != null ? { fitScore: queued.fitScore } : {}),
      });
    }
  };

  const handleGenerate = async () => {
    setError("");
    if (!baseResumeId) {
      setError("Pick a base resume first.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one posting.");
      return;
    }
    const baseText = await loadBaseResume();
    if (!baseText) {
      setError("Couldn't load that resume. Pick another.");
      return;
    }

    setIsRunning(true);
    const ids = [...selected];
    setProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      const posting = postingById.get(ids[i]);
      if (posting) await generateFor(posting, baseText);
      setProgress({ done: i + 1, total: ids.length });
    }
    setIsRunning(false);
    setProgress(null);
    setSelected(new Set());
  };

  const handleApprove = async (pkgId: string) => {
    const pkg = packages.find((p) => p.id === pkgId);
    const userId = session?.user?.id;
    if (!pkg || !userId || !pkg.tailoredResumeText) return;
    setBusyPkgId(pkgId);
    try {
      const posting = postingById.get(pkg.jobPostingId);
      const variantId = generateId();
      const baseName = posting?.company
        ? `${posting.company} – ${posting.title}`
        : (posting?.title ?? "Tailored");
      const storagePath = await uploadResume(userId, variantId, pkg.tailoredResumeText);
      const variant = {
        id: variantId,
        name: `${baseName} (Autopilot)`,
        storagePath,
        createdAt: new Date().toISOString(),
      };
      await updateProfile({ savedResumes: [...(profile.savedResumes ?? []), variant] });
      await updatePackage(pkgId, {
        packageStatus: "approved",
        tailoredResumeStoragePath: storagePath,
      });
      if (posting) await updatePosting(posting.id, { appliedResumeId: variantId });
    } catch (err) {
      console.error("Approve failed:", err);
    } finally {
      setBusyPkgId(null);
    }
  };

  const handleOpenApplication = async (pkgId: string) => {
    const pkg = packages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const posting = postingById.get(pkg.jobPostingId);
    if (posting?.url) window.open(posting.url, "_blank", "noopener,noreferrer");
    await updatePackage(pkgId, { packageStatus: "submitted" });
    if (posting && posting.status !== "applied") {
      await updatePosting(posting.id, { status: "applied", appliedAt: new Date().toISOString() });
    }
  };

  const handleRegenerate = async (pkgId: string) => {
    const pkg = packages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const posting = postingById.get(pkg.jobPostingId);
    if (!posting) return;
    const baseText = await loadBaseResume();
    if (!baseText) {
      setError("Couldn't load the base resume to regenerate.");
      return;
    }
    setBusyPkgId(pkgId);
    try {
      await generateFor(posting, baseText);
    } finally {
      setBusyPkgId(null);
    }
  };

  const reviewPackages = packages.filter((p) => postingById.has(p.jobPostingId));

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ background: "var(--muted)" }}
    >
      {/* Header */}
      <div className="px-4 sm:px-8 pt-6 pb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(217,119,87,0.12)", color: "var(--primary)" }}
          >
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <h1
              className="font-display text-xl font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Application Autopilot
            </h1>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Auto-generate tailored resume + cover-letter packages for your saved jobs — you review
              and approve every one.
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 sm:px-8 pb-10 max-w-2xl mx-auto w-full flex flex-col gap-5">
          {/* Setup */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            {savedResumes.length === 0 ? (
              <div
                className="flex items-center gap-2 text-sm rounded-xl px-4 py-3"
                style={{ background: "rgba(217,119,87,0.08)", color: "var(--primary)" }}
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                Save a resume in Resume Builder first — Autopilot tailors it for each job.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Base resume
                  </label>
                  <select
                    value={baseResumeId}
                    onChange={(e) => setBaseResumeId(e.target.value)}
                    className="h-11 rounded-xl px-3 text-sm"
                    style={{
                      background: "var(--muted)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                      cursor: "pointer",
                    }}
                  >
                    {savedResumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Pick postings to apply to ({selected.size}/{MAX_BATCH})
                  </label>
                  {candidatePostings.length === 0 ? (
                    <div
                      className="text-sm rounded-xl px-4 py-3"
                      style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
                    >
                      No saved or suggested postings yet. Save jobs in Job Postings, then come back.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {candidatePostings.map((p) => {
                        const isOn = selected.has(p.id);
                        const atCap = !isOn && selected.size >= MAX_BATCH;
                        return (
                          <button
                            key={p.id}
                            onClick={() => toggle(p.id)}
                            disabled={atCap}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                            style={{
                              background: isOn ? "rgba(217,119,87,0.10)" : "var(--muted)",
                              border: isOn
                                ? "1px solid rgba(217,119,87,0.40)"
                                : "1px solid var(--border)",
                              opacity: atCap ? 0.5 : 1,
                              cursor: atCap ? "not-allowed" : "pointer",
                            }}
                          >
                            <div
                              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                              style={{
                                border: isOn ? "none" : "1px solid var(--border)",
                                background: isOn ? "var(--primary)" : "transparent",
                              }}
                            >
                              {isOn && (
                                <CheckCircle2 className="w-4 h-4" style={{ color: "#fff" }} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div
                                className="text-sm font-medium truncate"
                                style={{ color: "var(--foreground)" }}
                              >
                                {p.title}
                              </div>
                              <div
                                className="text-xs truncate"
                                style={{ color: "var(--muted-foreground)" }}
                              >
                                {p.company ?? ""}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {error && (
                  <p className="text-xs" style={{ color: "var(--primary)" }}>
                    {error}
                  </p>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isRunning || selected.size === 0 || !baseResumeId}
                  className="h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                  style={{
                    background: "var(--primary)",
                    color: "#fff",
                    border: "none",
                    opacity: isRunning || selected.size === 0 || !baseResumeId ? 0.5 : 1,
                    cursor:
                      isRunning || selected.size === 0 || !baseResumeId ? "not-allowed" : "pointer",
                  }}
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generating{" "}
                      {progress ? `${progress.done}/${progress.total}` : ""}…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Generate{" "}
                      {selected.size > 0 ? selected.size : ""} package
                      {selected.size === 1 ? "" : "s"}
                    </>
                  )}
                </button>
                <p
                  className="text-[11px] flex items-center gap-1.5"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" /> Autopilot never submits
                  applications for you — it prepares packages you review, approve, and submit
                  yourself.
                </p>
              </>
            )}
          </div>

          {/* Review queue */}
          {reviewPackages.length > 0 && (
            <div className="flex flex-col gap-4">
              <span className="text-sm font-semibold px-1" style={{ color: "var(--foreground)" }}>
                Packages to review
              </span>
              {reviewPackages.map((pkg) => (
                <PackageReview
                  key={pkg.id}
                  pkg={pkg}
                  posting={postingById.get(pkg.jobPostingId)}
                  busy={busyPkgId === pkg.id}
                  onEditResume={(text) => updatePackage(pkg.id, { tailoredResumeText: text })}
                  onEditCover={(text) => updatePackage(pkg.id, { coverLetterText: text })}
                  onApprove={() => handleApprove(pkg.id)}
                  onOpenApplication={() => handleOpenApplication(pkg.id)}
                  onRegenerate={() => handleRegenerate(pkg.id)}
                  onDelete={() => deletePackage(pkg.id)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
