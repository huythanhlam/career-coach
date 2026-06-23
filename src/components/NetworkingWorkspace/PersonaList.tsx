import { useState } from "react";
import { Copy, Check, ExternalLink, PenLine, UserSearch } from "lucide-react";
import type { OutreachTarget } from "@/types/outreach";
import { PERSONA_LABELS } from "@/types/outreach";

interface PersonaListProps {
  company: string;
  targets: OutreachTarget[];
  onDraft: (target: OutreachTarget) => void;
}

export function PersonaList({ company, targets, onDraft }: PersonaListProps) {
  const [copied, setCopied] = useState<number | null>(null);

  const copy = async (text: string, i: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (targets.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <UserSearch className="w-4 h-4" style={{ color: "var(--primary)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Who to reach out to at {company}
        </span>
      </div>
      <p className="text-xs px-1" style={{ color: "var(--muted-foreground)" }}>
        These are roles to look for — not real people. Use each search to find someone, then draft a personalized message.
      </p>
      {targets.map((t, i) => (
        <div key={i} className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide" style={{ background: "rgba(217,119,87,0.12)", color: "var(--primary)", border: "1px solid rgba(217,119,87,0.25)" }}>
              {PERSONA_LABELS[t.personaType]}
            </span>
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{t.title}</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{t.rationale}</p>

          {t.searchQuery && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
              <span className="flex-1 min-w-0 truncate text-xs font-mono" style={{ color: "var(--foreground)" }}>{t.searchQuery}</span>
              <button onClick={() => copy(t.searchQuery, i)} title="Copy search" className="flex-shrink-0 p-1 rounded" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>
                {copied === i ? <Check className="w-3.5 h-3.5" style={{ color: "var(--forest)" }} /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <a
                href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(t.searchQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Search on LinkedIn"
                className="flex-shrink-0 p-1 rounded"
                style={{ color: "var(--muted-foreground)" }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          <button
            onClick={() => onDraft(t)}
            className="self-start h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            style={{ background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer" }}
          >
            <PenLine className="w-3.5 h-3.5" /> Draft a message
          </button>
        </div>
      ))}
    </div>
  );
}
