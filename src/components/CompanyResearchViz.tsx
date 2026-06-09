import { useState } from "react";
import {
  Loader2, Sparkles, Heart, Gift, Newspaper, LineChart,
  RefreshCw, Copy, Check, RotateCcw, ExternalLink,
} from "lucide-react";
import type { CompanyResearchResult, CompanyResearchSection, SourceLink } from "@/services/geminiService";

interface CompanyResearchVizProps {
  data: CompanyResearchResult;
  companyName: string;
  isLoading?: boolean;
  cachedAt?: string;
  onRefresh: () => void;
  onReset: () => void;
}

const SECTIONS = [
  { key: "hiringValues", title: "What they value when hiring", Icon: Heart, color: "var(--primary)" },
  { key: "benefits", title: "Key benefits & perks", Icon: Gift, color: "#2F6B4F" },
  { key: "news", title: "News", Icon: Newspaper, color: "#E8B948" },
  { key: "financials", title: "Financials", Icon: LineChart, color: "#3B82F6" },
] as const;

function MentorCard({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, boxShadow: "0 8px 30px rgba(0,0,0,0.04)", ...style }}>
      {children}
    </div>
  );
}

function SourceChips({ sources }: { sources: SourceLink[] }) {
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

function SectionCard({ title, Icon, color, section }: { title: string; Icon: typeof Heart; color: string; section: CompanyResearchSection }) {
  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        <Icon className="w-4 h-4" style={{ color }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{title}</span>
      </div>
      <div style={{ padding: "18px 22px" }}>
        {section.summary && (
          <p style={{ fontSize: 14, color: "var(--foreground)", margin: "0 0 12px", lineHeight: 1.6 }}>{section.summary}</p>
        )}
        {section.bullets.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            {section.bullets.map((b, i) => (
              <li key={i} style={{ fontSize: 14, color: "var(--foreground)", lineHeight: 1.55 }}>{b}</li>
            ))}
          </ul>
        ) : (
          !section.summary && <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>No details found — use the source link to verify.</p>
        )}
        <SourceChips sources={section.sources} />
      </div>
    </MentorCard>
  );
}

function toMarkdown(data: CompanyResearchResult, company: string): string {
  const sec = (title: string, s: CompanyResearchSection) => {
    const lines = [`## ${title}`];
    if (s.summary) lines.push(s.summary);
    s.bullets.forEach((b) => lines.push(`- ${b}`));
    if (s.sources.length) lines.push(`Sources: ${s.sources.map((x) => `[${x.label}](${x.url})`).join(", ")}`);
    return lines.join("\n");
  };
  return [
    `# Research: ${company}`,
    data.overview,
    sec("What they value when hiring", data.hiringValues),
    sec("Key benefits & perks", data.benefits),
    sec("News", data.news),
    sec("Financials", data.financials),
  ].filter(Boolean).join("\n\n");
}

export function CompanyResearchViz({ data, companyName, isLoading, cachedAt, onRefresh, onReset }: CompanyResearchVizProps) {
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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Overview banner */}
      <MentorCard style={{ overflow: "hidden" }}>
        <div style={{ padding: "20px 22px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Sparkles className="w-5 h-5 shrink-0" style={{ color: "var(--primary)", marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>
              {companyName || "Company research"}
            </div>
            {data.overview && (
              <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.6 }}>{data.overview}</p>
            )}
            {cachedLabel && (
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 8 }}>{cachedLabel} · click Refresh for the latest</div>
            )}
          </div>
        </div>
      </MentorCard>

      {SECTIONS.map(({ key, title, Icon, color }) => (
        <SectionCard key={key} title={title} Icon={Icon} color={color} section={data[key]} />
      ))}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onRefresh} disabled={isLoading} style={btnStyle(isLoading)}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
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

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: "1 1 160px", height: 48, background: "var(--card)", border: "1px solid var(--border)",
    borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", color: "var(--foreground)",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.7 : 1,
  };
}
