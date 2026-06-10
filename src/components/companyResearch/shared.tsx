import { ExternalLink } from "lucide-react";
import type { SourceLink } from "@/services/geminiService";

/** Rounded card chrome shared across every research section. */
export function MentorCard({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 24,
        boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Section header: colored icon chip + title (+ optional trailing slot). */
export function SectionHeader({
  Icon,
  color,
  title,
  trailing,
}: {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 30, height: 30, borderRadius: 9, display: "inline-flex", alignItems: "center",
          justifyContent: "center", background: `color-mix(in srgb, ${color} 14%, transparent)`, flexShrink: 0,
        }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{title}</span>
      {trailing && <span style={{ marginLeft: "auto" }}>{trailing}</span>}
    </div>
  );
}

export function SourceChips({ sources }: { sources: SourceLink[] }) {
  if (!sources?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)", alignSelf: "center" }}>
        Sources
      </span>
      {sources.map((s, i) => (
        <a
          key={`${s.url}-${i}`}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, maxWidth: "100%",
            height: 28, padding: "0 10px", borderRadius: 8, background: "var(--muted)",
            border: "1px solid var(--border)", fontSize: 12, color: "var(--primary)",
            textDecoration: "none", overflow: "hidden",
          }}
        >
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
        </a>
      ))}
    </div>
  );
}

export function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: "1 1 160px", height: 48, background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", color: "var(--foreground)",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.7 : 1,
  };
}

/** Stagger helper for motion entrance on a list of cards/sections. */
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  }),
};
