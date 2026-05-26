import React, { useState } from "react";
import {
  Plus,
  ArrowRight,
  FileText,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useJobApplications, type Application } from "@/hooks/useJobApplications";
import { useUserProfile } from "@/context/UserProfileContext";

const STATUS_MAP: Record<Application["status"], { bg: string; fg: string; border: string; label: string }> = {
  applied:      { bg: "rgba(59,130,246,0.10)",  fg: "#3B82F6", border: "rgba(59,130,246,0.25)",  label: "Applied" },
  interviewing: { bg: "rgba(245,158,11,0.10)",  fg: "#F59E0B", border: "rgba(245,158,11,0.25)",  label: "Interviewing" },
  offer:        { bg: "rgba(16,185,129,0.10)",  fg: "#10B981", border: "rgba(16,185,129,0.25)",  label: "Offer" },
  rejected:     { bg: "rgba(244,63,94,0.10)",   fg: "#F43F5E", border: "rgba(244,63,94,0.25)",   label: "Rejected" },
  pending:      { bg: "rgba(113,113,122,0.10)", fg: "#71717A", border: "rgba(113,113,122,0.25)", label: "Pending" },
};

export function Dashboard() {
  const { apps, addApplication } = useJobApplications();
  const { profile } = useUserProfile();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newApp, setNewApp] = useState<Partial<Application>>({
    company: "", role: "", status: "applied", location: "",
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  });

  const handleAddApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApp.company || !newApp.role) return;
    await addApplication({
      company: newApp.company!,
      role: newApp.role!,
      status: (newApp.status as Application["status"]) || "applied",
      date: newApp.date!,
      location: newApp.location || "Remote",
    });
    setIsModalOpen(false);
    setNewApp({ company: "", role: "", status: "applied", location: "",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
  };

  const interviewing = apps.filter(a => a.status === "interviewing").length;
  const applied = apps.filter(a => a.status === "applied").length;

  return (
    <div className="flex-1 h-full overflow-y-auto no-scrollbar" style={{ background: "var(--background)", padding: "32px 40px 80px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}
        className="animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* ── Hero grid ──────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>

          {/* Welcome card — dark ink */}
          <div style={{
            background: "var(--foreground)", color: "var(--background)",
            border: "1px solid var(--foreground)", borderRadius: 24,
            padding: 32, boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
          }}>
            <div className="eyebrow" style={{ color: "rgba(251,247,241,0.55)", marginBottom: 14 }}>
              This morning · Tue, May 6
            </div>
            <div className="font-display" style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.1, color: "var(--background)" }}>
              Hey {profile.name ? profile.name.split(" ")[0] : "there"} 👋 Welcome back to your career coach.
            </div>
            <p style={{ fontSize: 14, color: "rgba(251,247,241,0.65)", marginTop: 14, lineHeight: 1.6, maxWidth: 500 }}>
              We re-read your résumé and the JD over the weekend. Three things to tighten before Thursday — none of them big. Want to walk through them?
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button style={{
                height: 44, padding: "0 18px", background: "var(--primary)", color: "#FFF",
                border: "1px solid var(--primary)", borderRadius: 14, fontFamily: "inherit",
                fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex",
                alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(217,119,87,0.3)",
              }}>
                Start prep <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button style={{
                height: 44, padding: "0 18px", background: "transparent",
                border: "1px solid rgba(251,247,241,0.22)", color: "var(--background)",
                borderRadius: 14, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                Skim the notes
              </button>
            </div>
          </div>

          {/* Stats column */}
          <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 16 }}>
            {/* Your week */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, padding: 22, boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
              <div className="eyebrow">Your week</div>
              <div style={{ marginTop: 8 }}>
                <div className="font-display" style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--foreground)", lineHeight: 1 }}>
                  {interviewing + applied}
                </div>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>active conversations</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <StatusPill kind="interviewing">{interviewing} onsite</StatusPill>
                <StatusPill kind="applied">{applied} phone</StatusPill>
              </div>
            </div>

            {/* Reply rate */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, padding: 22, boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
              <div className="eyebrow">Reply rate</div>
              <div style={{ marginTop: 8 }}>
                <div className="font-display" style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--forest)", lineHeight: 1 }}>
                  15<span style={{ fontSize: 22 }}>%</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>last 30 days</div>
              </div>
              <div style={{ marginTop: 14, height: 6, background: "var(--muted)", borderRadius: 9999, overflow: "hidden" }}>
                <div style={{ width: "62%", height: "100%", background: "linear-gradient(90deg, var(--forest), var(--highlight))", borderRadius: 9999 }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 8 }}>
                Tracking just above the senior-PM benchmark (12%).
              </div>
            </div>
          </div>
        </div>

        {/* ── Pipeline ───────────────────────────────────────────── */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--foreground)", margin: 0 }}>
              Your pipeline
            </h3>
            <button
              onClick={() => setIsModalOpen(true)}
              style={{
                height: 36, padding: "0 14px", background: "var(--card)", color: "var(--foreground)",
                border: "1px solid var(--border)", borderRadius: 14, fontFamily: "inherit",
                fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex",
                alignItems: "center", gap: 6, boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add application
            </button>
          </div>

          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24, boxShadow: "0 8px 30px rgba(0,0,0,0.04)", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "44px 1.6fr 1fr 1fr 148px", gap: 16,
              padding: "12px 22px", borderBottom: "1px solid var(--border)",
            }}>
              {["", "Company · Role", "Location", "Applied", "Status"].map((h, i) => (
                <div key={i} className="eyebrow">{h}</div>
              ))}
            </div>

            {apps.map((app, i) => (
              <div
                key={app.id}
                style={{
                  display: "grid", gridTemplateColumns: "44px 1.6fr 1fr 1fr 148px", gap: 16,
                  padding: "16px 22px", alignItems: "center",
                  borderBottom: i < apps.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: 12, background: "var(--muted)",
                  border: "1px solid var(--border)", display: "flex", alignItems: "center",
                  justifyContent: "center", color: "var(--primary)", fontFamily: "'Fraunces',Georgia,serif",
                  fontSize: 13, fontWeight: 600,
                }}>
                  {app.company.slice(0, 2)}
                </div>

                {/* Company + role */}
                <div>
                  <div className="font-display" style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.01em" }}>
                    {app.company}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{app.role}</div>
                </div>

                <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{app.location}</div>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{app.date}</div>
                <div><StatusPill kind={app.status}>{STATUS_MAP[app.status].label}</StatusPill></div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick tools ────────────────────────────────────────── */}
        <div>
          <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--foreground)", margin: "0 0 14px" }}>
            Pick up where you left off
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { icon: FileText,    label: "Resume Builder", note: "v8 · 28 edits since Apr 1" },
              { icon: ShieldCheck, label: "Impact Audit",   note: "Stripe résumé · 3 suggestions left" },
              { icon: Users,       label: "Behavioral Sim", note: "Last topic: leadership" },
            ].map((tool, i) => {
              const Icon = tool.icon;
              return (
                <div
                  key={i}
                  style={{
                    background: "var(--card)", border: "1px solid var(--border)", borderRadius: 24,
                    padding: 22, boxShadow: "0 8px 30px rgba(0,0,0,0.04)", cursor: "pointer",
                  }}
                  className="group hover:border-primary/30 transition-colors duration-200"
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 14, background: "rgba(217,119,87,0.10)",
                    border: "1px solid rgba(217,119,87,0.25)", color: "var(--primary)",
                    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
                  }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.01em" }}>
                    {tool.label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 6 }}>{tool.note}</div>
                  <div style={{ marginTop: 14, color: "var(--primary)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    Continue <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Add application modal ──────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: "rgba(31,27,22,0.4)", backdropFilter: "blur(8px)" }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="animate-in zoom-in-95 duration-200"
            style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
              width: "100%", maxWidth: 480, overflow: "hidden",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="font-display" style={{ fontSize: 22, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                  Add application
                </div>
                <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 4 }}>
                  Track a new role in your pipeline
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 10, background: "var(--muted)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddApplication} style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { placeholder: "Company name", key: "company", required: true },
                { placeholder: "Role / title", key: "role", required: true },
                { placeholder: "Location (e.g. Remote, NYC)", key: "location" },
              ].map(({ placeholder, key, required }) => (
                <input
                  key={key}
                  required={required}
                  placeholder={placeholder}
                  value={(newApp as any)[key] || ""}
                  onChange={e => setNewApp({ ...newApp, [key]: e.target.value })}
                  style={{
                    height: 52, background: "var(--muted)", border: "1px solid var(--border)",
                    borderRadius: 14, padding: "0 16px", fontFamily: "inherit", fontSize: 14,
                    color: "var(--foreground)", outline: "none", width: "100%",
                  }}
                />
              ))}
              <select
                value={newApp.status || "applied"}
                onChange={e => setNewApp({ ...newApp, status: e.target.value as Application["status"] })}
                style={{
                  height: 52, background: "var(--muted)", border: "1px solid var(--border)",
                  borderRadius: 14, padding: "0 16px", fontFamily: "inherit", fontSize: 14,
                  color: "var(--foreground)", outline: "none",
                }}
              >
                <option value="applied">Applied</option>
                <option value="interviewing">Interviewing</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
                <option value="pending">Pending</option>
              </select>
              <button
                type="submit"
                style={{
                  height: 52, background: "var(--primary)", color: "#FFF",
                  border: "1px solid var(--primary)", borderRadius: 14,
                  fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  marginTop: 4, boxShadow: "0 4px 14px rgba(217,119,87,0.25)",
                }}
              >
                Add to pipeline
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ kind, children }: { kind: Application["status"]; children: React.ReactNode }) {
  const c = STATUS_MAP[kind] || STATUS_MAP.pending;
  return (
    <span style={{
      background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
      padding: "5px 12px", borderRadius: 9999,
      fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.18em",
      whiteSpace: "nowrap", display: "inline-block",
    }}>
      {children}
    </span>
  );
}
