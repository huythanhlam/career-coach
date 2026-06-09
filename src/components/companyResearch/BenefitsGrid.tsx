import { motion, useReducedMotion } from "motion/react";
import {
  Gift, HeartPulse, TrendingUp, Home, GraduationCap, Baby, PiggyBank, Plane, Dumbbell, Coins,
} from "lucide-react";
import type { CompanyResearchSection } from "@/services/geminiService";
import { MentorCard, SectionHeader, SourceChips } from "./shared";

type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

/** Map a benefit phrase to a representative icon by keyword. */
function iconFor(text: string): IconType {
  const t = text.toLowerCase();
  if (/(health|medical|dental|vision|insurance|wellbeing)/.test(t)) return HeartPulse;
  if (/(equity|stock|rsu|options|espp)/.test(t)) return TrendingUp;
  if (/(remote|hybrid|flexib|work from home|wfh|anywhere)/.test(t)) return Home;
  if (/(learn|tuition|education|develop|growth|training|conference)/.test(t)) return GraduationCap;
  if (/(parent|family|child|maternity|paternity|fertility|adoption)/.test(t)) return Baby;
  if (/(401|retirement|pension|match)/.test(t)) return PiggyBank;
  if (/(pto|vacation|leave|time off|holiday|sabbatical)/.test(t)) return Plane;
  if (/(gym|fitness|wellness|mental|mindful)/.test(t)) return Dumbbell;
  if (/(bonus|comp|salary|pay|signing|relocation)/.test(t)) return Coins;
  return Gift;
}

/** Benefits rendered as an icon grid; falls back to a summary line. */
export function BenefitsGrid({ section }: { section: CompanyResearchSection }) {
  const reduce = useReducedMotion();
  const bullets = section?.bullets ?? [];
  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={Gift} color="#2F6B4F" title="Key benefits & perks" />
      <div style={{ padding: "18px 22px" }}>
        {section?.summary && (
          <p style={{ fontSize: 14, color: "var(--foreground)", margin: "0 0 14px", lineHeight: 1.6 }}>{section.summary}</p>
        )}
        {bullets.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {bullets.map((b, i) => {
              const Icon = iconFor(b);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px",
                    borderRadius: 14, background: "var(--muted)", border: "1px solid var(--border)",
                  }}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, #2F6B4F 14%, transparent)" }}>
                    <Icon className="w-4 h-4" style={{ color: "#2F6B4F" }} />
                  </span>
                  <span style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.45 }}>{b}</span>
                </motion.div>
              );
            })}
          </div>
        ) : (
          !section?.summary && <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>No details found — use the source link to verify.</p>
        )}
        <SourceChips sources={section?.sources ?? []} />
      </div>
    </MentorCard>
  );
}
