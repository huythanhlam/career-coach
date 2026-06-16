import React from "react";
import {
  Loader2, Trash2, Target,
  ChevronDown, ChevronRight,
} from "lucide-react";
import type { SavedCareerPlan } from "@/types/userProfile";

interface MilestoneListProps {
  groupedPlans: [string, SavedCareerPlan[]][];
  filteredPlans: SavedCareerPlan[];
  collapsedGroups: Set<string>;
  loadingPlanId: string | null;
  editingPlanId: string | null;
  groupByType: boolean;
  planSearch: string;
  onToggleGroup: (key: string) => void;
  onOpenPlan: (plan: SavedCareerPlan) => void;
  onDeletePlan: (plan: SavedCareerPlan) => void;
}

function PlanCard({
  p,
  loadingPlanId,
  editingPlanId,
  onOpenPlan,
  onDeletePlan,
}: {
  p: SavedCareerPlan;
  loadingPlanId: string | null;
  editingPlanId: string | null;
  onOpenPlan: (plan: SavedCareerPlan) => void;
  onDeletePlan: (plan: SavedCareerPlan) => void;
}) {
  return (
    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--card)", border: `1px solid ${editingPlanId === p.id ? "var(--primary)" : "var(--border)"}`, borderRadius: 14 }}>
      <Target className="w-5 h-5 shrink-0" style={{ color: "var(--primary)" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
          {p.goalType} · {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </div>
        {(p.milestones?.length ?? 0) > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <div style={{ flex: 1, maxWidth: 160, height: 5, background: "var(--muted)", borderRadius: 9999, overflow: "hidden" }}>
              <div style={{ width: `${Math.round((p.milestones!.filter((m) => m.done).length / p.milestones!.length) * 100)}%`, height: "100%", background: "var(--forest)", borderRadius: 9999 }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
              {p.milestones!.filter((m) => m.done).length}/{p.milestones!.length} milestones
            </span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onOpenPlan(p)}
        disabled={loadingPlanId === p.id}
        style={{ height: 36, padding: "0 16px", background: "var(--primary)", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", cursor: loadingPlanId === p.id ? "not-allowed" : "pointer", opacity: loadingPlanId === p.id ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}
      >
        {loadingPlanId === p.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening…</> : "Open"}
      </button>
      <button
        type="button"
        onClick={() => onDeletePlan(p)}
        style={{ height: 36, width: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", color: "var(--muted-foreground)" }}
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export const MilestoneList = React.memo(function MilestoneList({
  groupedPlans,
  filteredPlans,
  collapsedGroups,
  loadingPlanId,
  editingPlanId,
  groupByType,
  planSearch,
  onToggleGroup,
  onOpenPlan,
  onDeletePlan,
}: MilestoneListProps) {
  const cardProps = { loadingPlanId, editingPlanId, onOpenPlan, onDeletePlan };

  if (filteredPlans.length === 0) {
    return (
      <div style={{ padding: "18px 20px", borderRadius: 14, background: "var(--card)", border: "1px solid var(--border)", fontSize: 13, color: "var(--muted-foreground)" }}>
        No plans match "{planSearch.trim()}".
      </div>
    );
  }

  if (groupByType) {
    return (
      <div className="flex flex-col gap-4">
        {groupedPlans.map(([type, plans]) => {
          const collapsed = collapsedGroups.has(type);
          return (
            <div key={type}>
              <button
                type="button"
                onClick={() => onToggleGroup(type)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 8, fontFamily: "inherit" }}
              >
                {collapsed ? <ChevronRight className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />}
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{type}</span>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>({plans.length})</span>
              </button>
              {!collapsed && (
                <div className="flex flex-col gap-3">
                  {plans.map((p) => <PlanCard key={p.id} p={p} {...cardProps} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {filteredPlans.map((p) => <PlanCard key={p.id} p={p} {...cardProps} />)}
    </div>
  );
});
