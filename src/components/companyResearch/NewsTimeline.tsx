import { motion, useReducedMotion } from "motion/react";
import { Newspaper } from "lucide-react";
import type { CompanyNewsItem, CompanyResearchSection } from "@/services/geminiService";
import { MentorCard, SectionHeader, SourceChips } from "./shared";

/**
 * Legacy news bullets are shaped "headline — date — why it matters"; split on
 * the first em/en dash so older cached entries still render with a lead line.
 */
function splitHeadline(bullet: string): { lead: string; rest: string } {
  const m = bullet.match(/^(.*?)\s*[—–-]\s*(.+)$/);
  if (m) return { lead: m[1].trim(), rest: m[2].trim() };
  return { lead: bullet.trim(), rest: "" };
}

/** "2026-06-12" → "Jun 12, 2026"; returns "" for an unknown/empty date. */
function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const MONTHS = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)";
const ISO_RE = /\b(\d{4}-\d{2}-\d{2})\b/i;
const LONG_RE = new RegExp(`\\b${MONTHS}[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4}\\b`, "i");

/**
 * Best-effort timestamp pulled from a legacy bullet ("… — Mar 19, 2026" or an
 * ISO date) so pre-`items` cached/seeded news can still be sorted newest-first.
 * Returns -Infinity when no date is found, sinking undated bullets to the bottom.
 */
export function bulletTimestamp(bullet: string): number {
  const iso = bullet.match(ISO_RE);
  if (iso) {
    const t = Date.parse(`${iso[1]}T00:00:00Z`);
    if (!Number.isNaN(t)) return t;
  }
  const long = bullet.match(LONG_RE);
  if (long) {
    const t = Date.parse(long[0]);
    if (!Number.isNaN(t)) return t;
  }
  return -Infinity;
}

/** Build the list to render: prefer structured, date-sorted items; fall back to bullets. */
function toRows(section: CompanyResearchSection): { lead: string; rest: string; date: string; url?: string }[] {
  const items: CompanyNewsItem[] = section?.items ?? [];
  if (items.length > 0) {
    // Sort newest → oldest here too: fresh fetches arrive pre-sorted, but
    // cached/seeded entries may not, so the UI guarantees the ordering.
    return [...items]
      .sort((a, b) => (b.date || "0").localeCompare(a.date || "0"))
      .map((it) => ({ lead: it.headline, rest: it.whyItMatters, date: formatDate(it.date), url: it.url }));
  }
  // Legacy bullets ("headline — … — date"): parse a date out of each and sort.
  return (section?.bullets ?? [])
    .map((b) => ({ b, t: bulletTimestamp(b) }))
    .sort((a, z) => z.t - a.t)
    .map(({ b }) => {
      const { lead, rest } = splitHeadline(b);
      return { lead, rest, date: "" };
    });
}

export function NewsTimeline({ section }: { section: CompanyResearchSection }) {
  const reduce = useReducedMotion();
  const rows = toRows(section);
  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={Newspaper} color="#E8B948" title="Recent news" />
      <div style={{ padding: "18px 22px" }}>
        {section?.summary && (
          <p style={{ fontSize: 14, color: "var(--foreground)", margin: "0 0 14px", lineHeight: 1.6 }}>{section.summary}</p>
        )}
        {rows.length > 0 ? (
          <div style={{ position: "relative", paddingLeft: 22 }}>
            {/* timeline spine */}
            <span style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 2, background: "var(--border)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {rows.map((row, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: reduce ? 1 : 0, x: reduce ? 0 : -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.35, ease: "easeOut" }}
                  style={{ position: "relative" }}
                >
                  <span style={{ position: "absolute", left: -21, top: 4, width: 12, height: 12, borderRadius: 99, background: "#E8B948", border: "2px solid var(--card)", boxShadow: "0 0 0 2px color-mix(in srgb, #E8B948 35%, transparent)" }} />
                  {row.date && (
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-foreground)", marginBottom: 2 }}>{row.date}</div>
                  )}
                  {row.url ? (
                    <a href={row.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.4, textDecoration: "none" }}>
                      {row.lead}
                    </a>
                  ) : (
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.4 }}>{row.lead}</div>
                  )}
                  {row.rest && <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2, lineHeight: 1.5 }}>{row.rest}</div>}
                </motion.div>
              ))}
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
