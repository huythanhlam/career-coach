// Application Autopilot — shared types.

export type PackageStatus =
  | "queued"
  | "generating"
  | "generated"
  | "approved"
  | "submitted"
  | "failed";

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  queued: "Queued",
  generating: "Generating…",
  generated: "Ready to review",
  approved: "Approved",
  submitted: "Submitted",
  failed: "Failed",
};

/** A prepared, review-and-approve application package for one posting. */
export interface ApplicationPackage {
  id: string;
  jobPostingId: string;
  fitScore?: number;
  tailoredResumeText?: string;
  tailoredResumeStoragePath?: string;
  coverLetterText?: string;
  packageStatus: PackageStatus;
  error?: string;
  createdAt: string;
}

export type NewApplicationPackage = Omit<ApplicationPackage, "id" | "createdAt">;
