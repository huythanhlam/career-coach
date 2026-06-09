import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, Sparkles, RefreshCw, Copy, Check, RotateCcw } from "lucide-react";
import type { CompanyResearchResult, CompanyResearchSection } from "@/services/geminiService";
import { MentorCard, btnStyle, fadeUp } from "./shared";
import { RatingsPanel } from "./RatingsPanel";
import { ValueTags } from "./ValueTags";
import { BenefitsGrid } from "./BenefitsGrid";
import { NewsTimeline } from "./NewsTimeline";
import { FinancialsCard } from "./FinancialsCard";

interface CompanyResearchVizProps {
  data: CompanyResearchResult;
  companyName: string;
  /** A stale tier is being refreshed in the background (or an explicit refresh is running). */
  isRevalidating?: boolean;
  cachedAt?: string;
  /** Re-ground only the fast-moving news tier (cheap). */
  onRefreshNews: () => void;
  /** Re-ground every tier. */
  onRefreshAll: () => void;
  onReset: () => void;
}

function toMarkdown(data: CompanyResearchResult, company: string): string {
  const sec = (title: string, s: CompanyResearchSection) => {
    const lines = [`## ${title}`];
    if (s?.summary) lines.push(s.summary);
    (s?.bullets ?? []).forEach((b) => lines.push(`- ${b}`));
    if (s?.sources?.length) lines.push(`Sources: ${s.sources.map((x) => `[${x.label}](${x.url})`).join(", ")}`);
    return lines.join("\n");
  };
  const ratings = (data.ratings ?? []).length
    ? ["## Employee ratings", ...data.ratings.map((r) => `- ${r.source}: ${r.score}/${r.scale}${r.reviewCount != null ? ` (${r.reviewCount} reviews)` : ""} — ${r.url}`)].join("\n")
    : "";
  return [
    `# Research: ${company}`,
    data.overview,
    ratings,
    sec("What they value when hiring", data.hiringValues),
    sec("Key benefits & perks", data.benefits),
    sec("Recent news", data.news),
    sec("Financials", data.financials),
  ].filter(Boolean).join("\n\n");
}

export function CompanyResearchViz({ data, companyName, isRevalidating, cachedAt, onRefreshNews, onRefreshAll, onReset }: CompanyResearchVizProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(data, companyName));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const cachedLabel = cachedAt
    ? `Cached ${new Date(cachedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : null;

  // Each entry renders one section; index drives the staggered entrance.
  const sections = [
    <RatingsPanel key="ratings" ratings={data.ratings ?? []} summary={data.ratingsSummary} />,
    <ValueTags key="values" section={data.hiringValues} />,
    <BenefitsGrid key="benefits" section={data.benefits} />,
    <NewsTimeline key="news" section={data.news} />,
    <FinancialsCard key="financials" section={data.financials} />,
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Overview banner */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
        <MentorCard style={{ overflow: "hidden", background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 7%, var(--card)), var(--card))" }}>
          <div style={{ padding: "20px 22px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--primary) 16%, transparent)" }}>
              <Sparkles className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </span>
            <div style={{ flex: 1 }}>
              <div className="font-display" style={{ fontSize: 20, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>
                {companyName || "Company research"}
              </div>
              {data.overview && (
                <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.6 }}>{data.overview}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                {cachedLabel && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{cachedLabel}</span>}
                {isRevalidating && (
                  <span style={{ fontSize: 12, color: "var(--primary)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Loader2 className="w-3 h-3 animate-spin" /> Updating…
                  </span>
                )}
              </div>
            </div>
          </div>
        </MentorCard>
      </motion.div>

      {sections.map((node, i) => (
        <motion.div key={node.key} custom={i + 1} variants={fadeUp} initial="hidden" animate="show">
          {node}
        </motion.div>
      ))}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onRefreshNews} disabled={isRevalidating} style={btnStyle(!!isRevalidating)} title="Re-check the news only (cheapest)">
          {isRevalidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh news
        </button>
        <button onClick={onRefreshAll} disabled={isRevalidating} style={btnStyle(!!isRevalidating)} title="Re-research everything">
          <RefreshCw className="w-4 h-4" /> Refresh all
        </button>
        <button onClick={handleCopy} style={btnStyle(false)}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copied" : "Copy summary"}
        </button>
        <button onClick={onReset} style={btnStyle(false)}>
          <RotateCcw className="w-4 h-4" /> Start new analysis
        </button>
      </div>
    </div>
  );
}
