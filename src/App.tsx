/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Sidebar, WorkflowId } from "@/components/Sidebar";
import { WorkflowView } from "@/components/WorkflowView";
import { TooltipProvider } from "@/components/ui/tooltip";
import { workflowsConfig } from "@/config/workflows";

export default function App() {
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowId>("linkedin");

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
        <Sidebar activeWorkflow={activeWorkflow} onSelectWorkflow={setActiveWorkflow} />
        {Object.keys(workflowsConfig).map((id) => (
          <div
            key={id}
            className={`flex-1 h-full overflow-hidden ${activeWorkflow === id ? 'flex' : 'hidden'}`}
          >
            <WorkflowView workflowId={id as WorkflowId} />
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

