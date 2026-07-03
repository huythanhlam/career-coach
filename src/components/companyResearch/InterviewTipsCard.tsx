import { motion, useReducedMotion } from "motion/react";
import { Lightbulb } from "lucide-react";
import type { CompanyResearchSection } from "@/services/geminiService";
import { MentorCard, SectionHeader, SourceChips } from "./shared";

/**
 * Interview tips scraped/researched from the company's own hiring-process pages,
 * rendered as numbered, actionable steps. Falls back to a summary line.
 */
export function InterviewTipsCard({ section }: { section: CompanyResearchSection }) {
  const reduce = useReducedMotion();
  const bullets = section?.bullets ?? [];
  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={Lightbulb} color="#B5651D" title="Interview tips" />
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
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {bullets.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
                style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 99,
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#B5651D",
                    background: "color-mix(in srgb, #B5651D 14%, transparent)",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 14, color: "var(--foreground)", lineHeight: 1.5 }}>
                  {b}
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          !section?.summary && (
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
              No interview details found — use the source link to verify.
            </p>
          )
        )}
        <SourceChips sources={section?.sources ?? []} />
      </div>
    </MentorCard>
  );
}
