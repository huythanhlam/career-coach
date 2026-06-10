import { motion, useReducedMotion } from "motion/react";
import { Newspaper } from "lucide-react";
import type { CompanyResearchSection } from "@/services/geminiService";
import { MentorCard, SectionHeader, SourceChips } from "./shared";

/**
 * News bullets shaped as "headline — date — why it matters". Rendered as a
 * vertical timeline; we split on the first em/en dash to surface a date marker.
 */
function splitHeadline(bullet: string): { lead: string; rest: string } {
  const m = bullet.match(/^(.*?)\s*[—–-]\s*(.+)$/);
  if (m) return { lead: m[1].trim(), rest: m[2].trim() };
  return { lead: bullet.trim(), rest: "" };
}

export function NewsTimeline({ section }: { section: CompanyResearchSection }) {
  const reduce = useReducedMotion();
  const bullets = section?.bullets ?? [];
  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={Newspaper} color="#E8B948" title="Recent news" />
      <div style={{ padding: "18px 22px" }}>
        {section?.summary && (
          <p style={{ fontSize: 14, color: "var(--foreground)", margin: "0 0 14px", lineHeight: 1.6 }}>{section.summary}</p>
        )}
        {bullets.length > 0 ? (
          <div style={{ position: "relative", paddingLeft: 22 }}>
            {/* timeline spine */}
            <span style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 2, background: "var(--border)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {bullets.map((b, i) => {
                const { lead, rest } = splitHeadline(b);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: reduce ? 1 : 0, x: reduce ? 0 : -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07, duration: 0.35, ease: "easeOut" }}
                    style={{ position: "relative" }}
                  >
                    <span style={{ position: "absolute", left: -21, top: 4, width: 12, height: 12, borderRadius: 99, background: "#E8B948", border: "2px solid var(--card)", boxShadow: "0 0 0 2px color-mix(in srgb, #E8B948 35%, transparent)" }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.4 }}>{lead}</div>
                    {rest && <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>{rest}</div>}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          !section?.summary && <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>No recent news found — use the source link to verify.</p>
        )}
        <SourceChips sources={section?.sources ?? []} />
      </div>
    </MentorCard>
  );
}
