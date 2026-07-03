import type React from "react";

export const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  padding: 22,
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

export const textareaStyle: React.CSSProperties = {
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "12px 14px",
  fontFamily: "inherit",
  fontSize: 14,
  color: "var(--foreground)",
  outline: "none",
  width: "100%",
  resize: "vertical",
  lineHeight: 1.6,
};

export const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--foreground)",
  marginBottom: 8,
  display: "block",
};

/** Inline field-error text, matching the editors' destructive-red convention. */
export const errorTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--destructive, #ef4444)",
  marginTop: 6,
};

/** `inputStyle` with a destructive border when the field is invalid. */
export const fieldStyle = (invalid?: string): React.CSSProperties =>
  invalid ? { ...inputStyle, borderColor: "var(--destructive, #ef4444)" } : inputStyle;

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
  justifyContent: "center",
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
  justifyContent: "center",
  gap: 8,
};

export const pillBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 30,
  padding: "0 12px",
  borderRadius: 9999,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

export const featuredBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  height: 22,
  padding: "0 9px",
  borderRadius: 9999,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.02em",
  color: "#fff",
  background: "var(--primary)",
};
