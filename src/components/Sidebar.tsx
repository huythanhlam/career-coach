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
  Rocket
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
  }[];
};

const viewCategories: Category[] = [
  {
    name: "Overview",
    items: [
      { id: "dashboard", name: "Dashboard", icon: Rocket, isHighlight: true },
    ],
  },
  {
    name: "Complete Auto-Pilot",
    items: [
      { id: "unified", name: "Career War Room", icon: Briefcase },
    ],
  },
  {
    name: "The Toolkit (Individual)",
    items: [
      { id: "linkedin", name: "LinkedIn Optimization", icon: Briefcase },
      { id: "resume_generation", name: "Resume Generator", icon: FileText },
      { id: "resume", name: "Resume Analysis", icon: FileText },
      { id: "company_research", name: "Company Research", icon: Building },
      { id: "interview", name: "Interview Guide", icon: MessageSquare },
      { id: "mock_behavioral", name: "Mock Behavioral", icon: Users },
      { id: "mock_case_study", name: "Mock Case Study", icon: PenTool },
      { id: "mock_tech", name: "Mock Tech Interview", icon: Code },
      { id: "market", name: "Market Compensation", icon: LineChart },
      { id: "salary", name: "Salary Negotiation", icon: DollarSign },
      { id: "career", name: "Career Cartographer", icon: Map },
    ],
  },
];

export function Sidebar({ activeView, onSelectView }: SidebarProps) {
  return (
    <div className="w-64 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 flex flex-col h-full border-r border-zinc-200 dark:border-zinc-800 flex-shrink-0">
      <div className="p-6 shrink-0 z-10 sticky top-0 bg-zinc-50 dark:bg-zinc-950">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <Rocket className="w-5 h-5" />
          </div>
          TechCoach AI
        </h1>
        <p className="text-xs text-zinc-500 mt-2 font-medium">Your elite career strategist</p>
      </div>
      
      <nav className="flex-1 px-4 pb-4 space-y-8 overflow-y-auto w-[240px] hover:w-[248px] custom-scrollbar transition-all">
        {viewCategories.map((category) => (
          <div key={category.name}>
            <h3 className="px-3 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
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
                       "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                       isActive
                         ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                         : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100",
                       view.isHighlight && !isActive && "border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40"
                     )}
                   >
                     <Icon className={cn("w-4 h-4", isActive || view.isHighlight ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors")} />
                     {view.name}
                   </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 shrink-0 text-center font-light">
        &copy; 2026 TechCoach AI
      </div>
    </div>
  );
}
