import { motion, useReducedMotion } from "motion/react";
import { Heart } from "lucide-react";
import type { CompanyResearchSection } from "@/services/geminiService";
import { MentorCard, SectionHeader, SourceChips } from "./shared";

/**
 * Hiring values rendered as staggered pill chips. Falls back to a plain summary
 * when there are no bullets.
 */
export function ValueTags({ section }: { section: CompanyResearchSection }) {
  const reduce = useReducedMotion();
  const bullets = section?.bullets ?? [];
  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={Heart} color="var(--primary)" title="What they value when hiring" />
      <div style={{ padding: "18px 22px" }}>
        {section?.summary && (
          <p
            style={{
              fontSize: 14,
              color: "var(--foreground)",
              margin: "0 0 14px",
              lineHeight: 1.6,
            }}
          >
            {section.summary}
          </p>
        )}
        {bullets.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {bullets.map((b, i) => (
              <motion.span
                key={i}
                initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, duration: 0.3, ease: "easeOut" }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 500,
                  lineHeight: 1.35,
                  color: "var(--foreground)",
                  background: "color-mix(in srgb, var(--primary) 9%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--primary) 22%, transparent)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    background: "var(--primary)",
                    flexShrink: 0,
                  }}
                />
                {b}
              </motion.span>
            ))}
          </div>
        ) : (
          !section?.summary && (
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
              No details found — use the source link to verify.
            </p>
          )
        )}
        <SourceChips sources={section?.sources ?? []} />
      </div>
    </MentorCard>
  );
}
