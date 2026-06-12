import React from "react";
import { Bookmark, Layers, Plus, Search } from "lucide-react";
import { MilestoneList } from "./MilestoneList";
import type { SavedCareerPlan } from "@/types/userProfile";

interface SavedPlansSectionProps {
  savedPlans: SavedCareerPlan[];
  filteredPlans: SavedCareerPlan[];
  groupedPlans: [string, SavedCareerPlan[]][];
  collapsedGroups: Set<string>;
  loadingPlanId: string | null;
  editingPlanId: string | null;
  planSearch: string;
  planSort: "newest" | "oldest" | "az";
  groupByType: boolean;
  onPlanSearch: (v: string) => void;
  onPlanSort: (v: "newest" | "oldest" | "az") => void;
  onGroupByType: () => void;
  onToggleGroup: (key: string) => void;
  onOpenPlan: (plan: SavedCareerPlan) => void;
  onDeletePlan: (plan: SavedCareerPlan) => void;
}

export function SavedPlansSection({
  savedPlans,
  filteredPlans,
  groupedPlans,
  collapsedGroups,
  loadingPlanId,
  editingPlanId,
  planSearch,
  planSort,
  groupByType,
  onPlanSearch,
  onPlanSort,
  onGroupByType,
  onToggleGroup,
  onOpenPlan,
  onDeletePlan,
}: SavedPlansSectionProps) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
        <Bookmark className="w-3.5 h-3.5" /> Saved Plans
        <span style={{ fontWeight: 600, letterSpacing: 0, textTransform: "none", color: "var(--muted-foreground)" }}>({savedPlans.length})</span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search className="w-4 h-4" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }} />
          <input
            type="text"
            value={planSearch}
            onChange={(e) => onPlanSearch(e.target.value)}
            placeholder="Search plans by name or goal…"
            style={{ width: "100%", height: 40, padding: "0 12px 0 36px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--foreground)", fontFamily: "inherit", outline: "none" }}
          />
        </div>
        <select
          value={planSort}
          onChange={(e) => onPlanSort(e.target.value as "newest" | "oldest" | "az")}
          aria-label="Sort plans"
          style={{ height: 40, padding: "0 12px", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "var(--foreground)", fontFamily: "inherit", cursor: "pointer" }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="az">Name (A–Z)</option>
        </select>
        <button
          type="button"
          onClick={onGroupByType}
          aria-pressed={groupByType}
          title="Group by goal type"
          style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 14px", background: groupByType ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--muted)", border: `1px solid ${groupByType ? "var(--primary)" : "var(--border)"}`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: groupByType ? "var(--primary)" : "var(--foreground)", fontFamily: "inherit", cursor: "pointer" }}
        >
          <Layers className="w-4 h-4" /> Group
        </button>
      </div>

      <MilestoneList
        groupedPlans={groupedPlans}
        filteredPlans={filteredPlans}
        collapsedGroups={collapsedGroups}
        loadingPlanId={loadingPlanId}
        editingPlanId={editingPlanId}
        groupByType={groupByType}
        planSearch={planSearch}
        onToggleGroup={onToggleGroup}
        onOpenPlan={onOpenPlan}
        onDeletePlan={onDeletePlan}
      />

      <div style={{ margin: "28px 0 4px", borderTop: "1px solid var(--border)" }} />
      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)", margin: "20px 0 14px", display: "flex", alignItems: "center", gap: 6 }}>
        <Plus className="w-3.5 h-3.5" /> Plan a new goal
      </div>
    </div>
  );
}
