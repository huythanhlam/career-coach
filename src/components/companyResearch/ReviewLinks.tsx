import { motion, useReducedMotion } from "motion/react";
import { Star, ExternalLink, Users, ShieldCheck } from "lucide-react";
import { buildReviewLinks } from "@/config/reviewSites";
import type { CompanyRating } from "@/types/companyProfile";
import { MentorCard, SectionHeader } from "./shared";

const SOURCE_COLORS: Record<string, string> = {
  blind: "#1A8E8E",
  glassdoor: "#0CAA41",
  indeed: "#2557A7",
  comparably: "#6C5CE7",
};
const colorFor = (s: string) => SOURCE_COLORS[s.trim().toLowerCase()] ?? "#3B82F6";

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

/** A real, scraped score with an animated bar. */
function ScoreRow({ rating, index }: { rating: CompanyRating; index: number }) {
  const reduce = useReducedMotion();
  const color = colorFor(rating.source);
  const frac = Math.max(0, Math.min(1, rating.score / rating.scale));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Star className="w-3.5 h-3.5" style={{ color, fill: color }} />
        <a href={rating.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
          {rating.source} <ExternalLink className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
        </a>
        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>
          {rating.score.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)" }}> / {rating.scale}</span>
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "var(--muted)", overflow: "hidden" }}>
        <motion.div
          style={{ height: "100%", borderRadius: 99, background: color }}
          initial={{ width: reduce ? `${frac * 100}%` : 0 }}
          animate={{ width: `${frac * 100}%` }}
          transition={{ duration: 0.8, delay: 0.1 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {rating.reviewCount != null && (
        <span style={{ fontSize: 11, color: "var(--muted-foreground)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Users className="w-3 h-3" /> {fmtCount(rating.reviewCount)} reviews · scraped from {rating.source}
        </span>
      )}
    </div>
  );
}

/**
 * Employee ratings. Shows REAL scraped scores (e.g. from Blind) where we can
 * read them directly, and links to every review site. We never show a guessed
 * score: the CAPTCHA-walled sites (Glassdoor/Indeed/Comparably) are links only.
 */
export function ReviewLinksCard({ company, ratings = [] }: { company: string; ratings?: CompanyRating[] }) {
  const links = buildReviewLinks(company);
  const scraped = ratings.filter((r) => Number.isFinite(r?.score) && r?.url);
  const scrapedSources = new Set(scraped.map((r) => r.source.toLowerCase()));
  // Links for the sites we couldn't scrape a score from.
  const otherLinks = links.filter((l) => !scrapedSources.has(l.label.split(" ")[0].toLowerCase()));
  if (!links.length && !scraped.length) return null;

  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={Star} color="#E8B948" title="Employee ratings" />
      <div style={{ padding: "16px 22px" }}>
        {scraped.length > 0 ? (
          <>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#2F6B4F", background: "color-mix(in srgb, #2F6B4F 12%, transparent)", padding: "3px 9px", borderRadius: 999, marginBottom: 14 }}>
              <ShieldCheck className="w-3.5 h-3.5" /> Real scores, read from the source
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
              {scraped.map((r, i) => <ScoreRow key={r.source} rating={r} index={i} />)}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 12px", lineHeight: 1.5 }}>
            See current ratings straight from the source — we don't show guessed scores.
          </p>
        )}

        {otherLinks.length > 0 && (
          <>
            {scraped.length > 0 && (
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", marginBottom: 8 }}>
                More reviews
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {otherLinks.map((l, i) => (
                <a
                  key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)", fontSize: 13, fontWeight: 500, color: "var(--foreground)", textDecoration: "none" }}
                >
                  <Star className="w-3.5 h-3.5" style={{ color: "#E8B948", fill: "#E8B948" }} /> {l.label}
                  <ExternalLink className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </MentorCard>
  );
}
