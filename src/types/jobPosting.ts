// Targeted Job Postings — shared types.

export type AtsProvider = "greenhouse" | "lever" | "ashby" | "workable" | "smartrecruiters";

export type JobPostingSource = "ats" | "web" | "manual";

export type JobStatus =
  | "suggested"
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "accepted"
  | "rejected"
  | "archived";

/** Statuses a user can set manually (excludes the system-managed "suggested"). */
export const JOB_STATUSES: JobStatus[] = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "archived",
];

/** A role the user is targeting. Drives the scan keyword filter + web search. */
export interface TargetRole {
  id: string;
  title: string;
  keywords?: string[];
  /** career-ops "negative" title_filter — drop postings whose title contains any of these. */
  exclude?: string[];
  location?: string;
  seniority?: string;
  remote?: boolean;
}

/** A company whose public ATS feed we scan. */
export interface TargetCompany {
  id: string;
  name: string;
  ats: AtsProvider;
  boardToken: string;
}

/** A saved/tracked posting + its application lifecycle. */
export interface JobPosting {
  id: string;
  title: string;
  company?: string;
  location?: string;
  description?: string;
  url?: string;
  source: JobPostingSource;
  externalId?: string;
  employmentType?: string;
  remote?: boolean;
  targetRoleId?: string;
  targetCompanyId?: string;
  matchScore?: number;
  status: JobStatus;
  favorite: boolean;
  appliedResumeId?: string;
  appliedCoverLetterId?: string;
  notes?: string;
  appliedAt?: string;
  postingData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** A normalized result from the scan-jobs Edge Function (not yet saved). */
export interface ScannedJob {
  title: string;
  company: string | null;
  location: string | null;
  description: string;
  url: string | null;
  externalId: string | null;
  employmentType: string | null;
  remote: boolean | null;
  source: "ats";
  ats: AtsProvider;
}

/** A normalized posting from a keyless aggregator (Remotive/Arbeitnow/RemoteOK). */
export interface AggregatorJob {
  title: string;
  company: string | null;
  location: string | null;
  description: string;
  url: string | null;
  externalId: string | null;
  remote: boolean | null;
  source: "web";
  provider: string;
}
