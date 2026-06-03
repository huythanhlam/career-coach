import { cn } from "@/lib/utils";
import {
  Briefcase,
  FileText,
  LineChart,
  Map,
  DollarSign,
  Building,
  Users,
  PenTool,
  Code,
  Compass,
  Grid,
  Plus,
  UserCog,
  Lock,
  Mail,
} from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";

export type ViewId =
  | "dashboard"
  | "unified"
  | "linkedin"
  | "resume"
  | "resume_generation"
  | "cover_letter"
  | "salary"
  | "interview"
  | "market"
  | "career"
  | "company_research"
  | "mock_behavioral"
  | "mock_case_study"
  | "mock_tech"
  | "profile_settings"
  | "security_settings";

export type WorkflowId = Exclude<ViewId, "unified" | "dashboard" | "profile_settings" | "security_settings">;

interface SidebarProps {
  activeView: ViewId;
  onSelectView: (id: ViewId) => void;
}

type NavItem = {
  id: ViewId;
  label: string;
  icon: React.ElementType;
  badge?: string;
};

type NavGroup = {
  name: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    name: "Plan",
    items: [
      { id: "dashboard",       label: "Overview",       icon: Grid },
      { id: "unified",         label: "Strategy Engine", icon: Compass, badge: "AI" },
      { id: "career",          label: "Career Roadmap", icon: Map },
    ],
  },
  {
    name: "Apply",
    items: [
      { id: "resume_generation", label: "Resume Builder", icon: FileText },
      { id: "cover_letter",      label: "Cover Letter",   icon: Mail },
      { id: "resume",            label: "Resume Analyzer",   icon: ShieldCheck },
      { id: "linkedin",          label: "Profile Lab",    icon: Briefcase },
    ],
  },
  {
    name: "Practice",
    items: [
      { id: "mock_behavioral", label: "Behavioral Sim",  icon: Users },
      { id: "mock_tech",       label: "Technical Sim",   icon: Code },
      { id: "mock_case_study", label: "Case Study",      icon: PenTool },
    ],
  },
  {
    name: "Research",
    items: [
      { id: "company_research", label: "Company Intel", icon: Building },
      { id: "market",           label: "Market Data",   icon: LineChart },
      { id: "salary",           label: "Negotiator",    icon: DollarSign },
    ],
  },
];

export function Sidebar({ activeView, onSelectView }: SidebarProps) {
  const { profile } = useUserProfile();

  const displayName = profile.preferredName || profile.fullName || "Your Profile";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "YP";
  const trackLabel = profile.targetRole || profile.currentRole || "Career track";

  return (
    <aside className="w-[280px] h-full bg-paper border-r border-border flex flex-col flex-shrink-0 z-30 overflow-hidden"
      style={{ background: "var(--paper)" }}>

      {/* Brand mark */}
      <div className="px-[22px] pt-5 pb-[18px] flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center text-white flex-shrink-0 shadow-[0_0_16px_rgba(217,119,87,0.25)]">
          <Compass className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-base font-semibold tracking-[-0.01em] text-foreground leading-[1.1] whitespace-nowrap">
            Career Coach <em className="not-italic text-primary">AI</em>
          </div>
          <div className="text-[9px] text-muted-foreground font-bold tracking-[0.16em] uppercase mt-0.5 whitespace-nowrap">
            Mentor mode
          </div>
        </div>
      </div>

      {/* New plan CTA */}
      <div className="px-3 pb-3">
        <button
          onClick={() => onSelectView("unified")}
          className="w-full h-10 bg-foreground text-background border-0 rounded-xl font-semibold text-[13px] cursor-pointer flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          New plan
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-auto px-3 pb-3 no-scrollbar">
        {navGroups.map((group) => (
          <div key={group.name} className="mb-3.5">
            <div className="text-[10px] font-bold text-muted-foreground tracking-[0.22em] uppercase px-[10px] pt-2 pb-1.5">
              {group.name}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = item.id === activeView;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectView(item.id)}
                    className={cn(
                      "relative flex items-center gap-3 px-3 py-[9px] rounded-[10px] text-[13px] text-left w-full border-0 cursor-pointer transition-all duration-200",
                      isActive
                        ? "bg-card text-foreground font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                        : "bg-transparent text-muted-foreground font-medium hover:bg-card/60 hover:text-foreground"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-[10px] bottom-[10px] w-[3px] rounded-full bg-primary" />
                    )}
                    <span className={cn("transition-colors", isActive ? "text-primary" : "text-muted-foreground")}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] font-black text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md tracking-[0.05em]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-border flex flex-col gap-1">
        {/* Profile */}
        <button
          onClick={() => onSelectView("profile_settings")}
          className={cn(
            "flex items-center gap-2.5 p-2 w-full rounded-[10px] text-left transition-all duration-200 group",
            activeView === "profile_settings"
              ? "bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              : "hover:bg-card/60"
          )}
        >
          <div className="w-8 h-8 rounded-[10px] bg-card border border-border flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground truncate">{displayName}</div>
            <div className="text-[10px] text-muted-foreground truncate">{trackLabel}</div>
          </div>
          <UserCog className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>

        {/* Security settings */}
        <button
          onClick={() => onSelectView("security_settings")}
          className={cn(
            "flex items-center gap-2.5 px-2 py-1.5 w-full rounded-[10px] text-left transition-all duration-200",
            activeView === "security_settings"
              ? "bg-card text-foreground font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
          )}
        >
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs font-medium">Security & Account</span>
        </button>
      </div>
    </aside>
  );
}
