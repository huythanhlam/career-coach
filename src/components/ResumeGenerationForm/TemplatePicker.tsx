import React from "react";
import { FileText } from "lucide-react";
import { ResumeFormState, ResumeFormAction } from "./resumeFormReducer";

function MiniTemplatePreview({ type }: { type: string }) {
  if (type === "Modern & Clean") {
    return (
      <div className="w-full h-full bg-white shadow-sm p-2.5 flex flex-col gap-2 rounded-sm overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="flex justify-between items-center pb-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex flex-col gap-1 w-2/3">
            <div className="h-2.5 w-3/4 rounded-sm" style={{ background: "var(--foreground)" }}></div>
            <div className="h-1.5 w-1/2 rounded-sm" style={{ background: "var(--muted-foreground)", opacity: 0.5 }}></div>
          </div>
          <div className="flex gap-1.5 flex-col items-end">
            <div className="h-1 w-12 rounded-px" style={{ background: "var(--border)" }}></div>
            <div className="h-1 w-16 rounded-px" style={{ background: "var(--border)" }}></div>
          </div>
        </div>
        <div className="flex gap-2.5 h-full pt-1">
          <div className="w-1/3 flex flex-col gap-2 pr-2" style={{ borderRight: "1px solid var(--border)" }}>
            <div className="h-1.5 w-full rounded-sm" style={{ background: "rgba(217,119,87,0.18)" }}></div>
            <div className="space-y-1">
              <div className="h-1 w-full rounded-px" style={{ background: "var(--border)" }}></div>
              <div className="h-1 w-5/6 rounded-px" style={{ background: "var(--border)" }}></div>
            </div>
            <div className="h-1.5 w-full rounded-sm mt-1" style={{ background: "rgba(217,119,87,0.18)" }}></div>
            <div className="space-y-1">
              <div className="h-1 w-full rounded-px" style={{ background: "var(--border)" }}></div>
              <div className="h-1 w-full rounded-px" style={{ background: "var(--border)" }}></div>
            </div>
          </div>
          <div className="w-2/3 flex flex-col gap-2">
            <div className="h-1.5 w-1/3 rounded-sm" style={{ background: "var(--border)" }}></div>
            <div className="space-y-1 pb-1">
              <div className="flex justify-between">
                <div className="h-1.5 w-1/2 rounded-px" style={{ background: "var(--foreground)", opacity: 0.7 }}></div>
                <div className="h-1 w-1/5 rounded-px" style={{ background: "var(--border)" }}></div>
              </div>
              <div className="h-1 w-full rounded-px" style={{ background: "var(--border)" }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (type === "Tech Focused") {
    return (
      <div className="w-full h-full bg-[#0d1117] border border-zinc-800 p-2.5 flex flex-col gap-1.5 rounded-sm overflow-hidden font-mono">
        <div className="flex gap-1 mb-1 border-b border-zinc-800 pb-2 items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          <div className="ml-2 h-1 w-16 bg-zinc-700 rounded-px"></div>
        </div>
        <div className="h-2.5 w-1/2 bg-blue-400/80 rounded-sm mt-1"></div>
        <div className="h-1 w-1/3 bg-emerald-400/80 rounded-sm mb-1"></div>
        <div className="flex gap-1 flex-wrap mb-1">
          <div className="h-1.5 w-8 bg-zinc-800 rounded-sm"></div>
          <div className="h-1.5 w-12 bg-zinc-800 rounded-sm"></div>
          <div className="h-1.5 w-10 bg-zinc-800 rounded-sm"></div>
        </div>
        <div className="space-y-1 mt-1">
          <div className="flex gap-2 items-center"><div className="w-0.5 h-3 bg-blue-500 rounded-full"></div><div className="h-1.5 w-1/3 bg-zinc-300 rounded-sm"></div></div>
          <div className="h-1 w-full bg-zinc-600 rounded-px ml-2.5"></div>
          <div className="h-1 w-5/6 bg-zinc-600 rounded-px ml-2.5"></div>
        </div>
      </div>
    );
  }
  if (type === "Executive") {
    return (
      <div className="w-full h-full bg-white border border-zinc-300 p-3 flex flex-col items-center gap-1.5 rounded-sm overflow-hidden">
        <div className="h-3 w-1/2 bg-slate-900 rounded-sm mb-0.5"></div>
        <div className="flex gap-3 mb-0.5">
          <div className="h-1 w-8 bg-slate-400 rounded-px"></div>
          <div className="h-1 w-8 bg-slate-400 rounded-px"></div>
        </div>
        <div className="w-full h-[2px] bg-slate-900 mt-1 mb-1"></div>
        <div className="w-full text-left flex flex-col gap-2">
          <div>
            <div className="h-1.5 w-1/4 bg-slate-800 rounded-sm mb-1"></div>
            <div className="flex justify-between w-full mb-0.5">
              <div className="h-1 w-1/3 bg-slate-700 rounded-px"></div>
              <div className="h-1 w-1/5 bg-slate-400 rounded-px"></div>
            </div>
            <div className="space-y-1 w-full">
              <div className="h-1 w-full bg-slate-200 rounded-px"></div>
              <div className="h-1 w-3/4 bg-slate-200 rounded-px"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (type === "Creative / Portfolio") {
    return (
      <div className="w-full h-full bg-[#fdfbf7] p-2 flex flex-col gap-2 rounded-sm overflow-hidden" style={{ border: "1px solid rgba(217,119,87,0.25)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full shrink-0 shadow-sm" style={{ background: "linear-gradient(135deg, #E8B948, #D97757)" }}></div>
          <div className="flex flex-col gap-1 w-full">
            <div className="h-2 w-2/3 rounded-sm" style={{ background: "var(--foreground)" }}></div>
            <div className="h-1.5 w-1/3 rounded-sm" style={{ background: "rgba(217,119,87,0.6)" }}></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="h-10 rounded-sm p-1 flex items-end" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
            <div className="h-1 w-1/2 rounded-px" style={{ background: "var(--border)" }}></div>
          </div>
          <div className="h-10 rounded-sm p-1 flex items-end" style={{ background: "var(--muted)", border: "1px solid var(--border)" }}>
            <div className="h-1 w-2/3 rounded-px" style={{ background: "var(--border)" }}></div>
          </div>
        </div>
      </div>
    );
  }
  if (type === "Photography / Visual") {
    return (
      <div className="w-full h-full bg-zinc-950 p-2 flex flex-col gap-2 rounded-sm overflow-hidden border border-zinc-800">
        <div className="flex justify-center w-full mb-1">
          <div className="h-2 w-1/3 bg-zinc-100 rounded-sm"></div>
        </div>
        <div className="columns-2 gap-1.5 space-y-1.5">
          <div className="w-full h-8 bg-zinc-800 rounded-sm opacity-80 border border-zinc-700"></div>
          <div className="w-full h-12 bg-zinc-800 rounded-sm opacity-80 border border-zinc-700"></div>
          <div className="w-full h-10 bg-zinc-800 rounded-sm opacity-80 border border-zinc-700"></div>
          <div className="w-full h-6 bg-zinc-800 rounded-sm opacity-80 border border-zinc-700"></div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full h-full bg-white p-2.5 flex flex-col gap-1.5 rounded-sm overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="h-2.5 w-2/5 mb-1.5 rounded-sm" style={{ background: "var(--foreground)" }}></div>
      {[["3/4", "full", "5/6"], ["2/3", "full"], ["4/5", "11/12"]].map((lines, i) => (
        <div key={i} className="flex gap-2.5 mb-1.5">
          <div className="w-0.5 h-full ml-1 rounded-full" style={{ background: "var(--border)" }}></div>
          <div className="flex flex-col gap-1.5 w-full -ml-1">
            <div className={`h-1.5 w-${lines[0]} rounded-px`} style={{ background: "var(--muted-foreground)", opacity: 0.5 }}></div>
            {lines.slice(1).map((w, j) => (
              <div key={j} className={`h-1 w-${w} rounded-px`} style={{ background: "var(--border)" }}></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const TEMPLATES = [
  { id: "Modern & Clean", name: "Modern & Clean", description: "Minimalist and professional layout." },
  { id: "Tech Focused", name: "Tech Focused", description: "Highlight skills and projects for IT roles." },
  { id: "Executive", name: "Executive", description: "Traditional, authoritative structure." },
  { id: "Creative / Portfolio", name: "Creative / Portfolio", description: "Vibrant visual identity for design roles." },
  { id: "Photography / Visual", name: "Photography / Visual", description: "Grid layout for prioritizing image portfolios." },
  { id: "Academic / Research", name: "Academic / Research", description: "Detailed format for publications and studies." }
];

interface Props {
  state: Pick<ResumeFormState, "template" | "uploadedResumeText" | "uploadedFileName">;
  dispatch: React.Dispatch<ResumeFormAction>;
  onSelect: (templateId: string) => void;
}

export const TemplatePicker = React.memo(function TemplatePicker({ state, dispatch, onSelect }: Props) {
  const { template, uploadedResumeText, uploadedFileName } = state;
  const matchCard = uploadedResumeText ? [{
    id: "Match uploaded style",
    name: "Match my resume",
    description: `Mirror the layout and style of "${uploadedFileName || "your uploaded PDF"}".`,
  }] : [];
  const allTemplates = [...matchCard, ...TEMPLATES];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {allTemplates.map(t => (
        <div
          key={t.id}
          onClick={() => onSelect(t.id)}
          style={{
            cursor: "pointer",
            borderRadius: 16,
            overflow: "hidden",
            border: template === t.id ? "2px solid var(--primary)" : "2px solid var(--border)",
            boxShadow: template === t.id ? "0 0 0 3px rgba(217,119,87,0.12)" : "none",
            transition: "border-color 0.15s, box-shadow 0.15s",
            background: "var(--card)",
          }}
        >
          <div style={{ aspectRatio: "1/1.2", background: "var(--muted)", padding: 20, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {t.id === "Match uploaded style" ? (
              <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <FileText className="w-10 h-10" style={{ color: "var(--primary)", opacity: 0.7 }} />
                <span style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>Mirror uploaded PDF layout</span>
              </div>
            ) : (
              <MiniTemplatePreview type={t.id} />
            )}
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--card)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>{t.name}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{t.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
});
