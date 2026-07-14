import { cn } from "@/lib/utils";
import {
  Briefcase,
  FileText,
  LineChart,
  Target,
  DollarSign,
  Building,
  Users,
  Handshake,
  Compass,
  Grid,
  Plus,
  UserCog,
  Lock,
  Mail,
  ShieldCheck,
  Search,
  Building2,
  BookOpen,
  Rocket,
  Mic,
  X,
} from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import { ModeSwitch } from "@/components/ModeSwitch";
import { MODE_META, defaultViewForAccount } from "@/lib/accountMode";

export type ViewId =
  | "dashboard"
  | "linkedin"
  | "resume_generation"
  | "cover_letter"
  | "job_postings"
  | "salary"
  | "interview"
  | "market"
  | "goal_planning"
  | "company_research"
  | "mock_behavioral"
  | "employer_studio"
  | "blog"
  | "blog_admin"
  | "networking"
  | "negotiation"
  | "autopilot"
  | "profile_settings"
  | "security_settings";

export type WorkflowId = Exclude<
  ViewId,
  | "dashboard"
  | "profile_settings"
  | "security_settings"
  | "job_postings"
  | "employer_studio"
  | "blog"
  | "blog_admin"
>;

interface SidebarProps {
  activeView: ViewId;
  onSelectView: (id: ViewId) => void;
  /** Mobile drawer open state. On md+ the sidebar is always visible. */
  isOpen?: boolean;
  onClose?: () => void;
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

const seekerNavGroups: NavGroup[] = [
  {
    name: "Plan",
    items: [
      { id: "dashboard", label: "Overview", icon: Grid },
      { id: "goal_planning", label: "Goal Planner", icon: Target },
    ],
  },
  {
    name: "Apply",
    items: [
      { id: "job_postings", label: "Job Postings", icon: Search, badge: "New" },
      { id: "autopilot", label: "Application Autopilot", icon: Rocket, badge: "New" },
      { id: "resume_generation", label: "Resume Builder", icon: FileText },
      { id: "cover_letter", label: "Cover Letter", icon: Mail },
      { id: "linkedin", label: "LinkedIn Optimization", icon: Briefcase },
      { id: "networking", label: "Networking", icon: Handshake, badge: "New" },
    ],
  },
  {
    name: "Practice",
    items: [
      { id: "mock_behavioral", label: "Mock Interview", icon: Users },
      { id: "negotiation", label: "Negotiation Practice", icon: Mic, badge: "New" },
    ],
  },
  {
    name: "Research",
    items: [
      { id: "company_research", label: "Research Company", icon: Building },
      { id: "market", label: "Market Data", icon: LineChart },
      { id: "salary", label: "Negotiator", icon: DollarSign },
    ],
  },
  {
    name: "Learn",
    items: [{ id: "blog", label: "Career Blog", icon: BookOpen }],
  },
];

const employerNavGroups: NavGroup[] = [
  {
    name: "Hire",
    items: [{ id: "employer_studio", label: "Employer Studio", icon: Building2, badge: "New" }],
  },
];

export function Sidebar({ activeView, onSelectView, isOpen = false, onClose }: SidebarProps) {
  const { profile } = useUserProfile();

  const isEmployer = profile.accountType === "employer";
  const baseGroups = isEmployer ? employerNavGroups : seekerNavGroups;
  // Admins get an extra "Admin" group with the Blog Admin view, in either mode.
  const visibleGroups: NavGroup[] = profile.isAdmin
    ? [
        ...baseGroups,
        { name: "Admin", items: [{ id: "blog_admin", label: "Blog Admin", icon: ShieldCheck }] },
      ]
    : baseGroups;

  const displayName = profile.preferredName || profile.fullName || "Your Profile";
  const initials =
    displayName
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "YP";
  const trackLabel = profile.targetRole || profile.currentRole || "Career track";

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "w-[280px] h-full bg-paper border-r border-border flex flex-col flex-shrink-0 overflow-hidden",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:relative md:z-30 md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ background: "var(--paper)" }}
      >
        {/* Brand mark */}
        <div className="px-[22px] pt-5 pb-[18px] flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0 shadow-[0_0_16px_rgba(240,182,58,0.25)]">
            <Compass className="w-[18px] h-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-semibold tracking-[-0.01em] text-foreground leading-[1.1] whitespace-nowrap">
              Career Coach <em className="not-italic text-primary">AI</em>
            </div>
            <div
              className="text-[9px] font-bold tracking-[0.16em] uppercase mt-0.5 whitespace-nowrap"
              style={{ color: "var(--primary)" }}
            >
              {MODE_META[isEmployer ? "employer" : "seeker"].modeLabel}
            </div>
          </div>
          {/* Close (mobile only) */}
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="md:hidden w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-card/60 hover:text-foreground transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary CTA — role-aware */}
        <div className="px-3 pb-3">
          <button
            onClick={() => onSelectView(isEmployer ? "employer_studio" : "goal_planning")}
            className="w-full h-10 bg-foreground text-background border-0 rounded-xl font-semibold text-[13px] cursor-pointer flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            {isEmployer ? "Employer Studio" : "New plan"}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-auto px-3 pb-3 no-scrollbar">
          {visibleGroups.map((group) => (
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
                          : "bg-transparent text-muted-foreground font-medium hover:bg-card/60 hover:text-foreground",
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-[10px] bottom-[10px] w-[3px] rounded-full bg-primary" />
                      )}
                      <span
                        className={cn(
                          "transition-colors",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )}
                      >
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
          {/* Mode switch — flip between job-seeker and employer experiences */}
          <div className="px-1 pb-2">
            <div className="text-[10px] font-bold text-muted-foreground tracking-[0.16em] uppercase px-1 pb-1.5">
              Mode
            </div>
            <ModeSwitch
              onSwitched={(type) => {
                onSelectView(defaultViewForAccount(type));
                onClose?.();
              }}
            />
          </div>

          {/* Profile */}
          <button
            onClick={() => onSelectView("profile_settings")}
            className={cn(
              "flex items-center gap-2.5 p-2 w-full rounded-[10px] text-left transition-all duration-200 group",
              activeView === "profile_settings"
                ? "bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                : "hover:bg-card/60",
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
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
          >
            <Lock className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs font-medium">Security & Account</span>
          </button>
        </div>
      </aside>
    </>
  );
}
