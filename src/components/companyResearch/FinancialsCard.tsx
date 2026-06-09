import { motion, useReducedMotion } from "motion/react";
import { LineChart } from "lucide-react";
import type { CompanyResearchSection } from "@/services/geminiService";
import { MentorCard, SectionHeader, SourceChips } from "./shared";

const ACCENT = "#3B82F6";

/**
 * Parse a "metric — value — period" bullet into stat parts. The model is asked
 * to emit financials in this shape; we degrade gracefully when it doesn't.
 */
function parseStat(bullet: string): { metric: string; value: string; period?: string } | null {
  const parts = bullet.split(/\s*[—–]\s*|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { metric: parts[0], value: parts[1], period: parts[2] };
  return null;
}

export function FinancialsCard({ section }: { section: CompanyResearchSection }) {
  const reduce = useReducedMotion();
  const bullets = section?.bullets ?? [];
  const stats = bullets.map(parseStat);
  const allParsed = bullets.length > 0 && stats.every(Boolean);

  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={LineChart} color={ACCENT} title="Financials" />
      <div style={{ padding: "18px 22px" }}>
        {section?.summary && (
          <p style={{ fontSize: 14, color: "var(--foreground)", margin: "0 0 14px", lineHeight: 1.6 }}>{section.summary}</p>
        )}
        {allParsed ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {stats.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
                style={{ padding: "14px 16px", borderRadius: 14, background: "var(--muted)", border: "1px solid var(--border)" }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>{s!.metric}</div>
                <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", marginTop: 4, lineHeight: 1.1 }}>{s!.value}</div>
                {s!.period && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3 }}>{s!.period}</div>}
              </motion.div>
            ))}
          </div>
        ) : bullets.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            {bullets.map((b, i) => (
              <li key={i} style={{ fontSize: 14, color: "var(--foreground)", lineHeight: 1.55 }}>{b}</li>
            ))}
          </ul>
        ) : (
          !section?.summary && <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>No financial details found — use the source link to verify.</p>
        )}
        <SourceChips sources={section?.sources ?? []} />
      </div>
    </MentorCard>
  );
}
