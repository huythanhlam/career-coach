import { useState } from "react";
import { motion } from "motion/react";
import {
  ShieldCheck, Building2, Calendar, MapPin, Users, Briefcase, User, Globe, TrendingUp,
  LineChart, Newspaper, Star, Copy, Check, RotateCcw, ExternalLink,
} from "lucide-react";
import type { CompanyProfile, FinancialMetric } from "@/types/companyProfile";
import { MentorCard, SectionHeader, btnStyle, fadeUp } from "./shared";

interface Props {
  profile: CompanyProfile;
  onReset: () => void;
}

/** Abbreviate a currency amount: 383285000000 → "$383.3B". */
function fmtCurrency(value: number, unit: string): string {
  const sign = value < 0 ? "-" : "";
  const n = Math.abs(value);
  const prefix = unit === "USD" ? "$" : "";
  if (n >= 1e12) return `${sign}${prefix}${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${sign}${prefix}${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${sign}${prefix}${(n / 1e6).toFixed(1)}M`;
  return `${sign}${prefix}${n.toLocaleString()}`;
}

function fmtDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function FactRow({ Icon, label, value, href }: { Icon: typeof Building2; label: string; value: string; href?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0" }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--muted)" }}>
        <Icon className="w-4 h-4" style={{ color: "var(--primary)" }} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>{label}</div>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: "var(--primary)", textDecoration: "none", wordBreak: "break-word", display: "inline-flex", alignItems: "center", gap: 4 }}>
            {value} <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <div style={{ fontSize: 14, color: "var(--foreground)", wordBreak: "break-word" }}>{value}</div>
        )}
      </div>
    </div>
  );
}

function KeyFactsCard({ profile }: { profile: CompanyProfile }) {
  const f = profile.keyFacts;
  const rows: React.ReactNode[] = [];
  if (f.founded) rows.push(<FactRow key="f" Icon={Calendar} label="Founded" value={f.founded} />);
  if (f.headquarters) rows.push(<FactRow key="hq" Icon={MapPin} label="Headquarters" value={f.country ? `${f.headquarters}, ${f.country}` : f.headquarters} />);
  if (f.industry) rows.push(<FactRow key="i" Icon={Briefcase} label="Industry" value={f.industry} />);
  if (f.employeeCount != null) rows.push(<FactRow key="e" Icon={Users} label="Employees" value={`${f.employeeCount.toLocaleString()}${f.employeeCountAsOf ? ` (${f.employeeCountAsOf})` : ""}`} />);
  if (f.ceo) rows.push(<FactRow key="c" Icon={User} label="CEO" value={f.ceo} />);
  if (f.ticker) rows.push(<FactRow key="t" Icon={TrendingUp} label="Ticker" value={f.ticker} />);
  if (f.website) rows.push(<FactRow key="w" Icon={Globe} label="Website" value={f.website.replace(/^https?:\/\//, "")} href={f.website} />);
  if (!rows.length) return null;

  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={Building2} color="var(--primary)" title="Key facts" />
      <div style={{ padding: "8px 22px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0 24px" }}>
        {rows}
      </div>
    </MentorCard>
  );
}

function FinancialsCard({ financials }: { financials: FinancialMetric[] }) {
  if (!financials.length) return null;
  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={LineChart} color="#3B82F6" title="Financials" trailing={<span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>SEC EDGAR</span>} />
      <div style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
        {financials.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
            style={{ padding: "14px 16px", borderRadius: 14, background: "var(--muted)", border: "1px solid var(--border)" }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>{m.label}</div>
            <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", marginTop: 4, lineHeight: 1.1 }}>{fmtCurrency(m.value, m.unit)}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3 }}>
              {m.fiscalYear ? `FY${m.fiscalYear}` : fmtDate(m.periodEnd)}{m.form ? ` · ${m.form}` : ""}
            </div>
          </motion.div>
        ))}
      </div>
    </MentorCard>
  );
}

function NewsCard({ profile }: { profile: CompanyProfile }) {
  if (!profile.news.length) return null;
  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={Newspaper} color="#E8B948" title="Recent news" trailing={<span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Google News</span>} />
      <div style={{ padding: "18px 22px" }}>
        <div style={{ position: "relative", paddingLeft: 22 }}>
          <span style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 2, background: "var(--border)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {profile.news.map((n, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35, ease: "easeOut" }}
                style={{ position: "relative" }}
              >
                <span style={{ position: "absolute", left: -21, top: 5, width: 12, height: 12, borderRadius: 99, background: "#E8B948", border: "2px solid var(--card)", boxShadow: "0 0 0 2px color-mix(in srgb, #E8B948 35%, transparent)" }} />
                <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", textDecoration: "none", lineHeight: 1.4, display: "inline-flex", gap: 4, alignItems: "baseline" }}>
                  {n.title} <ExternalLink className="w-3 h-3" style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                </a>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                  {[n.source, fmtDate(n.publishedAt)].filter(Boolean).join(" · ")}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </MentorCard>
  );
}

function RatingLinksCard({ profile }: { profile: CompanyProfile }) {
  if (!profile.ratingLinks.length) return null;
  return (
    <MentorCard style={{ overflow: "hidden" }}>
      <SectionHeader Icon={Star} color="#E8B948" title="Employee reviews" />
      <div style={{ padding: "16px 22px" }}>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 12px", lineHeight: 1.5 }}>
          Verified links to review sites (scores aren't pulled — no free, reliable rating API exists).
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {profile.ratingLinks.map((l, i) => (
            <a
              key={i} href={l.url} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 10, background: "var(--muted)", border: "1px solid var(--border)", fontSize: 13, fontWeight: 500, color: "var(--foreground)", textDecoration: "none" }}
            >
              <Star className="w-3.5 h-3.5" style={{ color: "#E8B948", fill: "#E8B948" }} /> {l.label} <ExternalLink className="w-3 h-3" style={{ color: "var(--muted-foreground)" }} />
            </a>
          ))}
        </div>
      </div>
    </MentorCard>
  );
}

function toMarkdown(p: CompanyProfile): string {
  const lines = [`# ${p.name}`];
  if (p.overview) lines.push(p.overview);
  const f = p.keyFacts;
  const facts = [
    f.founded && `Founded: ${f.founded}`, f.headquarters && `HQ: ${f.headquarters}`,
    f.industry && `Industry: ${f.industry}`, f.employeeCount != null && `Employees: ${f.employeeCount.toLocaleString()}`,
    f.ceo && `CEO: ${f.ceo}`, f.ticker && `Ticker: ${f.ticker}`, f.website && `Website: ${f.website}`,
  ].filter(Boolean);
  if (facts.length) lines.push("## Key facts", ...facts.map((x) => `- ${x}`));
  if (p.financials.length) lines.push("## Financials", ...p.financials.map((m) => `- ${m.label}: ${fmtCurrency(m.value, m.unit)} (${m.fiscalYear ? `FY${m.fiscalYear}` : m.periodEnd})`));
  if (p.news.length) lines.push("## Recent news", ...p.news.map((n) => `- ${n.title} — ${n.url}`));
  return lines.join("\n");
}

export function CompanyProfileViz({ profile, onReset }: Props) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(toMarkdown(profile)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { console.error(e); }
  };

  // Only include cards that have content (each component also self-guards to null).
  const hasFacts = Object.keys(profile.keyFacts ?? {}).some((k) => (profile.keyFacts as Record<string, unknown>)[k] != null);
  const sections = [
    hasFacts ? <KeyFactsCard key="facts" profile={profile} /> : null,
    profile.financials.length ? <FinancialsCard key="fin" financials={profile.financials} /> : null,
    profile.news.length ? <NewsCard key="news" profile={profile} /> : null,
    profile.ratingLinks.length ? <RatingLinksCard key="ratings" profile={profile} /> : null,
  ].filter((n): n is React.ReactElement => n !== null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Hero */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
        <MentorCard style={{ overflow: "hidden", background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 7%, var(--card)), var(--card))" }}>
          <div style={{ padding: "20px 22px", display: "flex", gap: 14, alignItems: "flex-start" }}>
            {profile.logoUrl ? (
              <img src={profile.logoUrl} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "contain", background: "#fff", border: "1px solid var(--border)", flexShrink: 0 }} />
            ) : (
              <span style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--primary) 16%, transparent)" }}>
                <Building2 className="w-6 h-6" style={{ color: "var(--primary)" }} />
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="font-display" style={{ fontSize: 22, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>{profile.name}</div>
              {profile.overview && <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.6 }}>{profile.overview}</p>}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#2F6B4F", background: "color-mix(in srgb, #2F6B4F 12%, transparent)", padding: "4px 10px", borderRadius: 999 }}>
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified sources · no AI
                </span>
                {profile.fetchedAt && <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Updated {fmtDate(profile.fetchedAt)}</span>}
              </div>
            </div>
          </div>
        </MentorCard>
      </motion.div>

      {sections.map((node, i) => (
        <motion.div key={node.key} custom={i + 1} variants={fadeUp} initial="hidden" animate="show">{node}</motion.div>
      ))}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={handleCopy} style={btnStyle(false)}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copied" : "Copy summary"}
        </button>
        <button onClick={onReset} style={btnStyle(false)}>
          <RotateCcw className="w-4 h-4" /> Look up another
        </button>
      </div>
    </div>
  );
}
