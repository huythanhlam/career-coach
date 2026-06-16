import React, { useState } from "react";
import { Loader2, Check } from "lucide-react";
import type { IdentitySyncField, IdentityKey } from "@/lib/careerBaseline";

export function ProfileSyncDialog({
  conflicts, syncing, onApply, onDismiss,
}: {
  conflicts: IdentitySyncField[];
  syncing: boolean;
  onApply: (keys: IdentityKey[]) => void;
  onDismiss: () => void;
}) {
  // Default OFF — overwriting existing profile data is opt-in.
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setChecked((p) => ({ ...p, [key]: !p[key] }));
  const selectedKeys = conflicts.filter((c) => checked[c.key]).map((c) => c.key);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onDismiss}>
      <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--card)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>Update your profile?</div>
        <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          Your survey answers differ from what's already in your profile. Choose which to overwrite — unchecked fields stay as they are.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {conflicts.map((c) => {
            const on = Boolean(checked[c.key]);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                aria-pressed={on}
                style={{ textAlign: "left", display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, border: `2px solid ${on ? "var(--primary)" : "var(--border)"}`, background: on ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}
              >
                <span aria-hidden style={{ marginTop: 1, width: 18, height: 18, borderRadius: 6, flexShrink: 0, border: `2px solid ${on ? "var(--primary)" : "var(--border)"}`, background: on ? "var(--primary)" : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {on && <Check className="w-3 h-3" strokeWidth={3} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>{c.label}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    <span style={{ textDecoration: "line-through" }}>{c.profileValue}</span>
                    {"  →  "}
                    <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{c.surveyValue}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onDismiss} disabled={syncing} style={{ height: 40, padding: "0 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: syncing ? "not-allowed" : "pointer", color: "var(--muted-foreground)" }}>
            Not now
          </button>
          <button type="button" onClick={() => onApply(selectedKeys)} disabled={syncing || selectedKeys.length === 0} style={{ height: 40, padding: "0 20px", background: "var(--primary)", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: syncing || selectedKeys.length === 0 ? "not-allowed" : "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6, opacity: syncing || selectedKeys.length === 0 ? 0.6 : 1 }}>
            {syncing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…</> : "Update profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
