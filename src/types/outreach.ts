// Networking & Referral Agent — shared types.

export type PersonaType = "recruiter" | "hiring_manager" | "team_member" | "alumni";

export const PERSONA_LABELS: Record<PersonaType, string> = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring Manager",
  team_member: "Team Member",
  alumni: "Alumni / Shared Background",
};

export type OutreachType = "linkedin_note" | "referral" | "cold_email" | "coffee_chat";

export const OUTREACH_LABELS: Record<OutreachType, string> = {
  linkedin_note: "LinkedIn connection note",
  referral: "Referral request",
  cold_email: "Cold email",
  coffee_chat: "Coffee-chat ask",
};

export type OutreachTone = "warm" | "professional" | "direct";

export const TONE_LABELS: Record<OutreachTone, string> = {
  warm: "Warm",
  professional: "Professional",
  direct: "Direct",
};

export type OutreachStatus = "to_reach_out" | "sent" | "replied" | "intro" | "referred" | "closed";

export const STATUS_LABELS: Record<OutreachStatus, string> = {
  to_reach_out: "To reach out",
  sent: "Sent",
  replied: "Replied",
  intro: "Intro made",
  referred: "Referred",
  closed: "Closed",
};

/** The ordered pipeline shown in the tracker. */
export const STATUS_ORDER: OutreachStatus[] = [
  "to_reach_out",
  "sent",
  "replied",
  "intro",
  "referred",
];

/** An AI-suggested outreach target — a role/title to find, NOT a scraped person. */
export interface OutreachTarget {
  personaType: PersonaType;
  /** The title/role to search for, e.g. "Engineering Manager, Payments". */
  title: string;
  /** Why this person is worth reaching out to for this user. */
  rationale: string;
  /** A ready-to-paste LinkedIn/Google search query to find this person. */
  searchQuery: string;
}

/** A tracked outreach contact (one row in outreach_contacts). */
export interface OutreachContact {
  id: string;
  company: string;
  targetCompanyId?: string;
  contactName?: string;
  contactTitle?: string;
  contactLinkedin?: string;
  personaType?: PersonaType;
  outreachType?: OutreachType;
  tone?: OutreachTone;
  messageDraft?: string;
  status: OutreachStatus;
  jobPostingId?: string;
  notes?: string;
  lastContactedAt?: string;
  createdAt: string;
}

export type NewOutreachContact = Omit<OutreachContact, "id" | "createdAt" | "status"> & {
  status?: OutreachStatus;
};
