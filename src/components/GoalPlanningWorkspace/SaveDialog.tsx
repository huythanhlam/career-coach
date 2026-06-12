import React from "react";
import { Loader2, Bookmark } from "lucide-react";

export function SaveDialog({
  saveName, setSaveName, isSaving, onCancel, onSave, title = "Save plan", subtitle,
}: {
  saveName: string;
  setSaveName: (v: string) => void;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onCancel}>
      <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: "var(--card)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>{title}</div>
        <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>{subtitle ?? "Give this plan a name so you can reopen and keep coaching."}</p>
        <input
          autoFocus
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); }}
          placeholder="e.g. Path to Senior Engineer"
          className="w-full outline-none mb-4"
          style={{ height: 44, padding: "0 14px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, color: "var(--foreground)", fontFamily: "inherit" }}
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} style={{ height: 40, padding: "0 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "var(--muted-foreground)" }}>
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={isSaving} style={{ height: 40, padding: "0 20px", background: "var(--primary)", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: isSaving ? "not-allowed" : "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6, opacity: isSaving ? 0.7 : 1 }}>
            {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Bookmark className="w-3.5 h-3.5" /> Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}
