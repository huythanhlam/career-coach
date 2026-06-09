import { Star, ExternalLink } from "lucide-react";
import { buildReviewLinks } from "@/config/reviewSites";
import { MentorCard, SectionHeader } from "./shared";

/**
 * Employee-review links — NO scores. Rating numbers from Glassdoor/Indeed/Blind/
 * Comparably can't be fetched reliably for free, so rather than show a guessed
 * (often wrong) score, we link straight to the live source for the real rating.
 */
export function ReviewLinksCard({ company }: { company: string }) {
  const links = buildReviewLinks(company);
  if (!links.length) return null;
  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={Star} color="#E8B948" title="Employee reviews" />
      <div style={{ padding: "16px 22px" }}>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 12px", lineHeight: 1.5 }}>
          See current, verified ratings straight from the source — we don't show guessed scores.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {links.map((l, i) => (
            <a
              key={i}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px",
                borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)",
                fontSize: 13, fontWeight: 500, color: "var(--foreground)", textDecoration: "none",
              }}
            >
              <Star className="w-3.5 h-3.5" style={{ color: "#E8B948", fill: "#E8B948" }} /> {l.label}
              <ExternalLink className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
            </a>
          ))}
        </div>
      </div>
    </MentorCard>
  );
}
