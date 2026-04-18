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
  Code
} from "lucide-react";

export type WorkflowId =
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

interface SidebarProps {
  activeWorkflow: WorkflowId;
  onSelectWorkflow: (id: WorkflowId) => void;
}

type Category = {
  name: string;
  items: {
    id: WorkflowId;
    name: string;
    icon: React.ElementType;
  }[];
};

const workflowCategories: Category[] = [
  {
    name: "Market Yourself",
    items: [
      { id: "linkedin", name: "LinkedIn Optimization", icon: Briefcase },
    ],
  },
  {
    name: "Application Process",
    items: [
      { id: "resume_generation", name: "Resume Generator", icon: FileText },
      { id: "resume", name: "Resume Tailoring", icon: FileText },
      { id: "company_research", name: "Company Research", icon: Building },
    ],
  },
  {
    name: "Interview Process",
    items: [
      { id: "interview", name: "Interview Guide", icon: MessageSquare },
      { id: "mock_behavioral", name: "Mock Behavioral", icon: Users },
      { id: "mock_case_study", name: "Mock Case Study", icon: PenTool },
      { id: "mock_tech", name: "Mock Tech Interview", icon: Code },
    ],
  },
  {
    name: "Negotiation Process",
    items: [
      { id: "market", name: "Market Compensation", icon: LineChart },
      { id: "salary", name: "Salary Negotiation", icon: DollarSign },
    ],
  },
  {
    name: "Continual Development",
    items: [
      { id: "career", name: "Career Cartographer", icon: Map },
    ],
  },
];

export function Sidebar({ activeWorkflow, onSelectWorkflow }: SidebarProps) {
  return (
    <div className="w-64 bg-zinc-950 text-zinc-300 flex flex-col h-full border-r border-zinc-800 overflow-y-auto">
      <div className="p-6 shrink-0">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            TC
          </div>
          TechCoach AI
        </h1>
        <p className="text-xs text-zinc-500 mt-2">Your elite career strategist</p>
      </div>
      <nav className="flex-1 px-4 pb-4 space-y-6">
        {workflowCategories.map((category) => (
          <div key={category.name}>
            <h3 className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              {category.name}
            </h3>
            <div className="space-y-1">
              {category.items.map((workflow) => {
                const Icon = workflow.icon;
                const isActive = activeWorkflow === workflow.id;
                return (
                  <button
                    key={workflow.id}
                    onClick={() => onSelectWorkflow(workflow.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-indigo-600/10 text-indigo-400"
                        : "hover:bg-zinc-900 hover:text-zinc-100"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {workflow.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-zinc-800 text-xs text-zinc-600 shrink-0">
        &copy; 2026 TechCoach AI
      </div>
    </div>
  );
}
