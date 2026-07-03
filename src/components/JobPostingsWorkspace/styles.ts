import type { JobStatus } from "@/types/jobPosting";
import type React from "react";

/* ── Status presentation ─────────────────────────────────────────────────── */
export const STATUS_META: Record<
  JobStatus,
  { label: string; fg: string; bg: string; border: string }
> = {
  suggested: {
    label: "Suggested",
    fg: "#D97757",
    bg: "rgba(217,119,87,0.10)",
    border: "rgba(217,119,87,0.25)",
  },
  saved: {
    label: "Saved",
    fg: "#71717A",
    bg: "rgba(113,113,122,0.10)",
    border: "rgba(113,113,122,0.25)",
  },
  applied: {
    label: "Applied",
    fg: "#3B82F6",
    bg: "rgba(59,130,246,0.10)",
    border: "rgba(59,130,246,0.25)",
  },
  interviewing: {
    label: "Interviewing",
    fg: "#F59E0B",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.25)",
  },
  offer: {
    label: "Offer",
    fg: "#10B981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.25)",
  },
  accepted: {
    label: "Accepted",
    fg: "#2F6B4F",
    bg: "rgba(47,107,79,0.12)",
    border: "rgba(47,107,79,0.30)",
  },
  rejected: {
    label: "Rejected",
    fg: "#F43F5E",
    bg: "rgba(244,63,94,0.10)",
    border: "rgba(244,63,94,0.25)",
  },
  archived: {
    label: "Archived",
    fg: "#A1A1AA",
    bg: "rgba(161,161,170,0.10)",
    border: "rgba(161,161,170,0.22)",
  },
};

/* ── Shared inline styles ────────────────────────────────────────────────── */
export const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
};
export const inputStyle: React.CSSProperties = {
  height: 44,
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "0 14px",
  fontFamily: "inherit",
  fontSize: 14,
  color: "var(--foreground)",
  outline: "none",
  width: "100%",
};
export const primaryBtn: React.CSSProperties = {
  height: 44,
  padding: "0 18px",
  background: "var(--primary)",
  color: "#FFF",
  border: "1px solid var(--primary)",
  borderRadius: 12,
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  boxShadow: "0 4px 14px rgba(217,119,87,0.25)",
};
export const ghostBtn: React.CSSProperties = {
  height: 44,
  padding: "0 16px",
  background: "var(--muted)",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};
export const filterSelectStyle: React.CSSProperties = {
  height: 38,
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "0 12px",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--foreground)",
  cursor: "pointer",
  outline: "none",
};
