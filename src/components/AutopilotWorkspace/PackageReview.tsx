import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  ExternalLink,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  Mail,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import type { ApplicationPackage } from "@/types/applicationPackage";
import { PACKAGE_STATUS_LABELS } from "@/types/applicationPackage";
import type { JobPosting } from "@/types/jobPosting";

const fitColor = (s: number) =>
  s >= 75 ? "var(--forest)" : s >= 50 ? "#9A7B1F" : "var(--primary)";

interface PackageReviewProps {
  pkg: ApplicationPackage;
  posting?: JobPosting;
  busy: boolean;
  onEditResume: (text: string) => void;
  onEditCover: (text: string) => void;
  onApprove: () => void;
  onOpenApplication: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

export function PackageReview({
  pkg,
  posting,
  busy,
  onEditResume,
  onEditCover,
  onApprove,
  onOpenApplication,
  onRegenerate,
  onDelete,
}: PackageReviewProps) {
  const [openResume, setOpenResume] = useState(false);
  const [openCover, setOpenCover] = useState(true);
  const [copied, setCopied] = useState<"resume" | "cover" | null>(null);

  const copy = async (which: "resume" | "cover", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const isGenerating = pkg.packageStatus === "generating" || pkg.packageStatus === "queued";
  const approved = pkg.packageStatus === "approved" || pkg.packageStatus === "submitted";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
            {posting?.title ?? "Posting"}
          </div>
          <div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
            {posting?.company ?? ""}
          </div>
        </div>
        {pkg.fitScore != null && (
          <div className="text-right">
            <span
              className="font-display text-lg font-semibold"
              style={{ color: fitColor(pkg.fitScore) }}
            >
              {pkg.fitScore}
            </span>
            <span className="text-[10px] block" style={{ color: "var(--muted-foreground)" }}>
              fit
            </span>
          </div>
        )}
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide"
          style={{
            background: approved ? "rgba(47,107,79,0.12)" : "rgba(110,101,87,0.10)",
            color: approved ? "var(--forest)" : "var(--muted-foreground)",
          }}
        >
          {PACKAGE_STATUS_LABELS[pkg.packageStatus]}
        </span>
      </div>

      {isGenerating ? (
        <div
          className="flex items-center gap-2 px-4 py-6 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Loader2 className="w-4 h-4 animate-spin" /> Tailoring resume and drafting cover letter…
        </div>
      ) : pkg.packageStatus === "failed" ? (
        <div
          className="flex items-center gap-2 px-4 py-6 text-sm"
          style={{ color: "var(--primary)" }}
        >
          <AlertTriangle className="w-4 h-4" /> {pkg.error || "Generation failed."}
          <button
            onClick={onRegenerate}
            className="ml-auto h-8 px-3 rounded-lg text-xs font-medium"
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-3">
          {/* Tailored resume */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <button
              onClick={() => setOpenResume((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
              style={{ background: "var(--muted)", border: "none", cursor: "pointer" }}
            >
              {openResume ? (
                <ChevronDown className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
              ) : (
                <ChevronRight className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
              )}
              <FileText className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span className="text-xs font-semibold flex-1" style={{ color: "var(--foreground)" }}>
                Tailored resume
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  copy("resume", pkg.tailoredResumeText ?? "");
                }}
                className="text-[11px] flex items-center gap-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                {copied === "resume" ? (
                  <Check className="w-3 h-3" style={{ color: "var(--forest)" }} />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </span>
            </button>
            {openResume && (
              <textarea
                value={pkg.tailoredResumeText ?? ""}
                onChange={(e) => onEditResume(e.target.value)}
                rows={12}
                className="w-full p-3 text-xs font-mono resize-y"
                style={{
                  background: "var(--card)",
                  border: "none",
                  borderTop: "1px solid var(--border)",
                  color: "var(--foreground)",
                  outline: "none",
                }}
              />
            )}
          </div>

          {/* Cover letter */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <button
              onClick={() => setOpenCover((o) => !o)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
              style={{ background: "var(--muted)", border: "none", cursor: "pointer" }}
            >
              {openCover ? (
                <ChevronDown className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
              ) : (
                <ChevronRight className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
              )}
              <Mail className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span className="text-xs font-semibold flex-1" style={{ color: "var(--foreground)" }}>
                Cover letter
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  copy("cover", pkg.coverLetterText ?? "");
                }}
                className="text-[11px] flex items-center gap-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                {copied === "cover" ? (
                  <Check className="w-3 h-3" style={{ color: "var(--forest)" }} />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </span>
            </button>
            {openCover && (
              <textarea
                value={pkg.coverLetterText ?? ""}
                onChange={(e) => onEditCover(e.target.value)}
                rows={10}
                className="w-full p-3 text-xs resize-y"
                style={{
                  background: "var(--card)",
                  border: "none",
                  borderTop: "1px solid var(--border)",
                  color: "var(--foreground)",
                  outline: "none",
                }}
              />
            )}
          </div>

          <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            Review and edit before approving. Replace any [bracketed] placeholders. Approving saves
            the tailored resume to your library; nothing is submitted automatically.
          </p>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {!approved ? (
              <button
                onClick={onApprove}
                disabled={busy}
                className="h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                style={{
                  background: "var(--forest)",
                  color: "#fff",
                  border: "none",
                  opacity: busy ? 0.6 : 1,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}{" "}
                Approve & save
              </button>
            ) : (
              <span
                className="h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                style={{ background: "rgba(47,107,79,0.10)", color: "var(--forest)" }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approved
              </span>
            )}
            {posting?.url && (
              <button
                onClick={onOpenApplication}
                className="h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                style={{
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open application
              </button>
            )}
            <button
              onClick={onRegenerate}
              disabled={busy}
              title="Regenerate"
              className="h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5"
              style={{
                background: "var(--muted)",
                border: "1px solid var(--border)",
                color: "var(--muted-foreground)",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Regenerate
            </button>
            <button
              onClick={onDelete}
              title="Delete"
              className="h-9 w-9 rounded-lg flex items-center justify-center ml-auto"
              style={{
                background: "var(--muted)",
                border: "1px solid var(--border)",
                color: "var(--muted-foreground)",
                cursor: "pointer",
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
