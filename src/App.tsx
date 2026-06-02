import { useState, useEffect } from "react";
import { Sidebar, type ViewId } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { WorkflowView } from "@/components/WorkflowView";
import { UnifiedWorkspace } from "@/components/UnifiedWorkspace";
import { TooltipProvider } from "@/components/ui/tooltip";
import { workflowsConfig } from "@/config/workflows";
import { GlobalChatPanel } from "@/components/GlobalChatPanel";
import { MessageCircle } from "lucide-react";
import { UserProfileProvider, useUserProfile } from "@/context/UserProfileContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { ProfileSettings } from "@/components/ProfileSettings";
import { SecuritySettings } from "@/components/SecuritySettings";
import { LandingPage } from "@/components/LandingPage";
import { MFAChallengePage } from "@/components/MFAChallengePage";

function AppInner() {
  const { profile } = useUserProfile();
  const [isChatOpen, setIsChatOpen] = useState(false);

  const pendingTab = localStorage.getItem("pendingTab") as ViewId | null;
  const [activeView, setActiveView] = useState<ViewId>(
    pendingTab && (pendingTab in workflowsConfig || ["dashboard", "unified"].includes(pendingTab))
      ? pendingTab
      : "dashboard"
  );

  useEffect(() => {
    localStorage.removeItem("pendingTab");
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background font-sans text-foreground">
        <Sidebar activeView={activeView} onSelectView={setActiveView} />

        {/* Main Workspace Area */}
        <div className="flex-1 h-full overflow-hidden flex relative">
          <div className="flex-1 h-full overflow-hidden flex flex-col relative">
            {activeView === "dashboard" && <Dashboard />}
            {activeView === "unified" && <UnifiedWorkspace />}
            {activeView === "profile_settings" && <ProfileSettings />}
            {activeView === "security_settings" && <SecuritySettings />}

            {Object.keys(workflowsConfig).map((id) => (
              <div
                key={id}
                className={`flex-1 h-full overflow-hidden ${activeView === id ? 'flex' : 'hidden'}`}
              >
                {/* @ts-ignore */}
                <WorkflowView workflowId={id as any} />
              </div>
            ))}

            {/* Coach FAB */}
            {!isChatOpen && (
              <button
                onClick={() => setIsChatOpen(true)}
                className="absolute bottom-6 right-7 w-14 h-14 rounded-full flex items-center justify-center z-40 transition-transform hover:scale-105 animate-in zoom-in duration-300"
                style={{
                  background: "var(--primary)", color: "#FFF",
                  border: "none", cursor: "pointer",
                  boxShadow: "0 12px 30px rgba(217,119,87,0.35)",
                }}
              >
                <MessageCircle className="w-6 h-6" />
                <div
                  className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 animate-pulse"
                  style={{ background: "var(--forest)", borderColor: "var(--background)" }}
                />
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

      {/* Onboarding overlay — shown on first visit */}
      {!profile.onboardingComplete && <OnboardingWizard />}
    </TooltipProvider>
  );
}

function AuthGate() {
  const { session, loading, authStep, mfaFactorId, completeMfaChallenge } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid var(--border)",
            borderTopColor: "var(--primary)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!session) return <LandingPage />;

  if (authStep === "mfa_challenge" && mfaFactorId) {
    return (
      <MFAChallengePage
        factorId={mfaFactorId}
        onSuccess={() => completeMfaChallenge(mfaFactorId)}
      />
    );
  }

  return (
    <UserProfileProvider>
      <AppInner />
    </UserProfileProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
