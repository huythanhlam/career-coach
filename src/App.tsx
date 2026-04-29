/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Sidebar, ViewId } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { WorkflowView } from "@/components/WorkflowView";
import { UnifiedWorkspace } from "@/components/UnifiedWorkspace";
import { TooltipProvider } from "@/components/ui/tooltip";
import { workflowsConfig } from "@/config/workflows";

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("dashboard");

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
        <Sidebar activeView={activeView} onSelectView={setActiveView} />
        
        {/* Main Workspace Area */}
        <div className="flex-1 h-full overflow-hidden flex relative">
          {activeView === "dashboard" && <Dashboard />}
          {activeView === "unified" && <UnifiedWorkspace />}
          
          {Object.keys(workflowsConfig).map((id) => (
            <div
              key={id}
              className={`flex-1 h-full overflow-hidden ${activeView === id ? 'flex' : 'hidden'}`}
            >
              {/* @ts-ignore - Ensure id fits WorkflowId but dynamically string is mapped here */}
              <WorkflowView workflowId={id as any} />
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

