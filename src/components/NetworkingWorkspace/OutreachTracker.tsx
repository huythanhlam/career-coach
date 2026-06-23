import { useState } from "react";
import { Copy, Check, Trash2, Building2, Inbox } from "lucide-react";
import type { OutreachContact, OutreachStatus } from "@/types/outreach";
import { STATUS_LABELS, STATUS_ORDER, PERSONA_LABELS, OUTREACH_LABELS } from "@/types/outreach";

interface OutreachTrackerProps {
  contacts: OutreachContact[];
  onUpdate: (id: string, patch: Partial<OutreachContact>) => void;
  onDelete: (id: string) => void;
}

const ALL_STATUSES: OutreachStatus[] = [...STATUS_ORDER, "closed"];

const statusColor: Record<OutreachStatus, string> = {
  to_reach_out: "var(--muted-foreground)",
  sent: "#3B82F6",
  replied: "#9A7B1F",
  intro: "var(--forest)",
  referred: "var(--forest)",
  closed: "var(--muted-foreground)",
};

export function OutreachTracker({ contacts, onUpdate, onDelete }: OutreachTrackerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = async (c: OutreachContact) => {
    if (!c.messageDraft) return;
    try {
      await navigator.clipboard.writeText(c.messageDraft);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId((id) => (id === c.id ? null : id)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleStatus = (c: OutreachContact, status: OutreachStatus) => {
    const patch: Partial<OutreachContact> = { status };
    if (status === "sent" && !c.lastContactedAt) patch.lastContactedAt = new Date().toISOString();
    onUpdate(c.id, patch);
  };

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <Inbox className="w-8 h-8" style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>No outreach saved yet</p>
        <p className="text-xs max-w-xs" style={{ color: "var(--muted-foreground)" }}>
          Find people at a company and draft a message — saved drafts show up here so you can track replies and referrals.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {contacts.map((c) => (
        <div key={c.id} className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }} />
                <span className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                  {c.contactName || c.contactTitle || c.company}
                </span>
              </div>
              <div className="text-xs mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>
                {c.company}
                {c.personaType ? ` · ${PERSONA_LABELS[c.personaType]}` : ""}
                {c.outreachType ? ` · ${OUTREACH_LABELS[c.outreachType]}` : ""}
              </div>
            </div>
            <button onClick={() => onDelete(c.id)} title="Delete" className="p-1 rounded flex-shrink-0" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {c.messageDraft && (
            <div className="rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap line-clamp-4" style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              {c.messageDraft}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={c.status}
              onChange={(e) => handleStatus(c, e.target.value as OutreachStatus)}
              className="h-8 px-2 rounded-lg text-xs font-medium"
              style={{ background: "var(--muted)", border: "1px solid var(--border)", color: statusColor[c.status], cursor: "pointer" }}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            {c.messageDraft && (
              <button onClick={() => copy(c)} className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5" style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--muted-foreground)", cursor: "pointer" }}>
                {copiedId === c.id ? <><Check className="w-3 h-3" style={{ color: "var(--forest)" }} /> Copied</> : <><Copy className="w-3 h-3" /> Copy message</>}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
