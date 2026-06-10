import { useState, useEffect, lazy, Suspense, type ReactNode } from "react";
import { Sidebar, type ViewId } from "@/components/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { workflowsConfig } from "@/config/workflows";
import { MessageCircle, Menu, Compass } from "lucide-react";
import { UserProfileProvider, useUserProfile } from "@/context/UserProfileContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toast";

// Every view is lazy-loaded so first paint only ships the shell + the view the
// user lands on; heavy deps (recharts, pdf.js, markdown, docx) stay out of the
// entry chunk.
const Dashboard = lazy(() => import("@/components/Dashboard").then((m) => ({ default: m.Dashboard })));
const WorkflowView = lazy(() => import("@/components/WorkflowView").then((m) => ({ default: m.WorkflowView })));
const UnifiedWorkspace = lazy(() => import("@/components/UnifiedWorkspace").then((m) => ({ default: m.UnifiedWorkspace })));
const GlobalChatPanel = lazy(() => import("@/components/GlobalChatPanel").then((m) => ({ default: m.GlobalChatPanel })));
const OnboardingWizard = lazy(() => import("@/components/onboarding/OnboardingWizard").then((m) => ({ default: m.OnboardingWizard })));
const ConsentModal = lazy(() => import("@/components/ConsentModal").then((m) => ({ default: m.ConsentModal })));
const ProfileSettings = lazy(() => import("@/components/ProfileSettings").then((m) => ({ default: m.ProfileSettings })));
const JobPostingsWorkspace = lazy(() => import("@/components/JobPostingsWorkspace").then((m) => ({ default: m.JobPostingsWorkspace })));
const SecuritySettings = lazy(() => import("@/components/SecuritySettings").then((m) => ({ default: m.SecuritySettings })));
const LandingPage = lazy(() => import("@/components/LandingPage").then((m) => ({ default: m.LandingPage })));
const MFAChallengePage = lazy(() => import("@/components/MFAChallengePage").then((m) => ({ default: m.MFAChallengePage })));

/* ── URL hash <-> view sync ──────────────────────────────────────────
 * The hash (e.g. #/resume_generator) is the source of truth for navigation, so
 * refresh restores the view, links are shareable, and back/forward work. */
const STATIC_VIEWS = ["dashboard", "unified", "job_postings", "profile_settings", "security_settings"] as const;

function isValidView(v: string): v is ViewId {
  return v in workflowsConfig || (STATIC_VIEWS as readonly string[]).includes(v);
}

function viewFromHash(): ViewId | null {
  const h = decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
  return isValidView(h) ? h : null;
}

function Spinner() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center" style={{ background: "var(--background)" }}>
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

function AppInner() {
  const { profile } = useUserProfile();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMounted, setChatMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [activeView, setActiveView] = useState<ViewId>(() => {
    const fromHash = viewFromHash();
    if (fromHash) return fromHash;
    const pendingTab = localStorage.getItem("pendingTab");
    return pendingTab && isValidView(pendingTab) ? pendingTab : "dashboard";
  });

  // Workflows keep in-progress state by staying mounted, but only once visited —
  // mounting all of them up front made first load initialize every workspace.
  const [visitedWorkflows, setVisitedWorkflows] = useState<Set<string>>(
    () => new Set(activeView in workflowsConfig ? [activeView] : [])
  );

  // Navigation writes the hash; the hashchange listener below updates state.
  // Back/forward and manually edited URLs flow through the same path.
  const handleSelectView = (v: ViewId) => {
    if (v === activeView) return;
    window.location.hash = `/${v}`;
  };

  useEffect(() => {
    localStorage.removeItem("pendingTab");
    // Canonicalize the initial URL without adding a history entry.
    history.replaceState(null, "", `#/${activeView}`);

    const applyHash = () => {
      const v = viewFromHash() ?? "dashboard";
      if (v in workflowsConfig) {
        setVisitedWorkflows((prev) => (prev.has(v) ? prev : new Set(prev).add(v)));
      }
      setActiveView(v);
    };
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background font-sans text-foreground">
        <Sidebar
          activeView={activeView}
          onSelectView={(v) => { handleSelectView(v); setIsSidebarOpen(false); }}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Workspace Area */}
        <div className="flex-1 h-full overflow-hidden flex relative">
          <div className="flex-1 h-full overflow-hidden flex flex-col relative">

            {/* Mobile top bar — drawer trigger (hidden on md+ where the sidebar is always visible) */}
            <header
              className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border flex-shrink-0 z-20"
              style={{ background: "var(--paper)" }}
            >
              <button
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open navigation menu"
                className="w-9 h-9 -ml-1 rounded-[10px] flex items-center justify-center text-foreground hover:bg-card/60 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white flex-shrink-0">
                  <Compass className="w-4 h-4" />
                </div>
                <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-foreground truncate">
                  Career Coach <em className="not-italic text-primary">AI</em>
                </span>
              </div>
            </header>

            {/* Content area — flex-1 + min-h-0 so view `h-full` resolves to the space below the top bar */}
            <div className="flex-1 min-h-0 relative flex flex-col">
              <Suspense fallback={<Spinner />}>
                {activeView === "dashboard" && <Dashboard onNavigate={handleSelectView} />}
                {activeView === "unified" && <UnifiedWorkspace />}
                {activeView === "job_postings" && <JobPostingsWorkspace onNavigate={handleSelectView} />}
                {activeView === "profile_settings" && <ProfileSettings />}
                {activeView === "security_settings" && <SecuritySettings />}

                {[...visitedWorkflows].map((id) => (
                  <div
                    key={id}
                    className={`flex-1 min-h-0 overflow-hidden ${activeView === id ? 'flex' : 'hidden'}`}
                  >
                    {/* @ts-ignore */}
                    <WorkflowView workflowId={id as any} onNavigate={handleSelectView} />
                  </div>
                ))}
              </Suspense>

              {/* Coach FAB */}
              {!isChatOpen && (
                <button
                  onClick={() => { setChatMounted(true); setIsChatOpen(true); }}
                  aria-label="Open coach chat"
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
          </div>

          {/* Right Side Chat Panel — mounted on first open, then kept alive for chat history */}
          {chatMounted && (
            <Suspense fallback={null}>
              <GlobalChatPanel
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                activeView={activeView}
              />
            </Suspense>
          )}
        </div>
      </div>

      <Suspense fallback={null}>
        {/* Onboarding overlay — shown on first visit */}
        {!profile.onboardingComplete && <OnboardingWizard />}

        {/* Consent overlay — shown to existing users who predate the consent requirement */}
        {profile.onboardingComplete && !profile.aiConsentGivenAt && <ConsentModal />}
      </Suspense>
    </TooltipProvider>
  );
}

function FullscreenSpinner() {
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

function AuthGate() {
  const { session, loading, authStep, mfaFactorId, completeMfaChallenge } = useAuth();

  if (loading) return <FullscreenSpinner />;

  let content: ReactNode;
  if (!session) {
    content = <LandingPage />;
  } else if (authStep === "mfa_challenge" && mfaFactorId) {
    content = (
      <MFAChallengePage
        factorId={mfaFactorId}
        onSuccess={() => completeMfaChallenge(mfaFactorId)}
      />
    );
  } else {
    content = (
      <UserProfileProvider>
        <AppInner />
      </UserProfileProvider>
    );
  }

  return <Suspense fallback={<FullscreenSpinner />}>{content}</Suspense>;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
      <Toaster />
    </AuthProvider>
  );
}
