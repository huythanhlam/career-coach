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
import { GlobalChatPanel } from "@/components/GlobalChatPanel";
import { MessageCircle } from "lucide-react";

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background font-sans text-foreground">
        <Sidebar activeView={activeView} onSelectView={setActiveView} />
        
        {/* Main Workspace Area */}
        <div className="flex-1 h-full overflow-hidden flex relative">
          <div className="flex-1 h-full overflow-hidden flex flex-col relative">
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

            {/* Chat Toggle Button (Visible when chat is closed) */}
            {!isChatOpen && (
              <button
                onClick={() => setIsChatOpen(true)}
                className="absolute bottom-8 right-8 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-40 border-4 border-background animate-in zoom-in duration-500"
              >
                <MessageCircle className="w-6 h-6" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
              </button>
            )}
          </div>

          {/* Right Side Chat Panel */}
          <GlobalChatPanel 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)} 
            activeView={activeView}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

