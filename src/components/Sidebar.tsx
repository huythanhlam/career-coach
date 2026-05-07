import { cn } from "@/lib/utils";
import {
  Briefcase,
  FileText,
  LineChart,
  Map,
  MessageSquare,
  DollarSign,
  Building,
  Users,
  PenTool,
  Code,
  Rocket,
  ShieldCheck,
  Zap
} from "lucide-react";

export type ViewId =
  | "dashboard"
  | "unified"
  | "linkedin"
  | "resume"
  | "resume_generation"
  | "salary"
  | "interview"
  | "market"
  | "career"
  | "company_research"
  | "mock_behavioral"
  | "mock_case_study"
  | "mock_tech";

export type WorkflowId = Exclude<ViewId, "unified" | "dashboard">;

interface SidebarProps {
  activeView: ViewId;
  onSelectView: (id: ViewId) => void;
}

type Category = {
  name: string;
  items: {
    id: ViewId;
    name: string;
    icon: React.ElementType;
    isHighlight?: boolean;
    badge?: string;
  }[];
};

const viewCategories: Category[] = [
  {
    name: "Command Center",
    items: [
      { id: "dashboard", name: "Overview", icon: Zap, isHighlight: true },
      { id: "unified", name: "Strategy Engine", icon: Rocket, badge: "AI" },
    ],
  },
  {
    name: "Artifacts",
    items: [
      { id: "resume_generation", name: "Resume Builder", icon: FileText },
      { id: "resume", name: "Impact Audit", icon: ShieldCheck },
      { id: "linkedin", name: "Profile Lab", icon: Briefcase },
    ],
  },
  {
    name: "Simulations",
    items: [
      { id: "mock_behavioral", name: "Behavioral", icon: Users },
      { id: "mock_tech", name: "Technical", icon: Code },
      { id: "mock_case_study", name: "Case Study", icon: PenTool },
    ],
  },
  {
    name: "Intelligence",
    items: [
      { id: "company_research", name: "Company Intel", icon: Building },
      { id: "market", name: "Market Data", icon: LineChart },
      { id: "salary", name: "Negotiator", icon: DollarSign },
      { id: "career", name: "Roadmap", icon: Map },
    ],
  },
];

export function Sidebar({ activeView, onSelectView }: SidebarProps) {
  return (
    <div className="w-64 bg-background backdrop-blur-xl text-foreground flex flex-col h-full border-r border-border flex-shrink-0 z-30 overflow-hidden">
      {/* Premium Logo Header */}
      <div className="p-8 shrink-0 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-[0_0_20px_rgba(99,102,241,0.3)] animate-pulse">
            <Rocket className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-foreground leading-none uppercase italic">
              TechCoach<span className="text-primary not-italic">AI</span>
            </h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1">Elite Strategist</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-4 pb-8 space-y-8 overflow-y-auto custom-scrollbar">
        {viewCategories.map((category) => (
          <div key={category.name} className="space-y-4">
            <h3 className="px-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
              {category.name}
            </h3>
            <div className="space-y-1">
              {category.items.map((view) => {
                const Icon = view.icon;
                const isActive = activeView === view.id;
                return (
                   <button
                     key={view.id}
                     onClick={() => onSelectView(view.id)}
                     className={cn(
                       "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 group relative",
                       isActive
                         ? "bg-secondary text-foreground shadow-sm"
                         : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                     )}
                   >
                     <div className="flex items-center gap-3">
                        <Icon className={cn(
                          "w-4 h-4 transition-all duration-500",
                          isActive ? "text-primary scale-110 rotate-3" : "text-muted-foreground group-hover:text-primary/70"
                        )} />
                        <span className="tracking-tight">{view.name}</span>
                     </div>
                     
                     {view.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-black border border-primary/20">
                          {view.badge}
                        </span>
                     )}

                     {isActive && (
                        <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-full shadow-[0_0_15px_#6366f1] animate-in slide-in-from-left-2 duration-500" />
                     )}
                   </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Session / Privacy Footer */}
      <div className="p-6 border-t border-border bg-secondary/20">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-sm">
           <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary border border-primary/20">
              HL
           </div>
           <div className="flex-1 overflow-hidden">
              <p className="text-[11px] font-bold text-foreground truncate">Huy Lam</p>
              <p className="text-[9px] text-muted-foreground font-medium truncate uppercase tracking-wider">Premium Access</p>
           </div>
        </div>
      </div>
    </div>
  );
}
