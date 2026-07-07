import { useRef, useState } from "react";
import type { AccountType } from "@/types/userProfile";
import { AuthModal } from "./AuthModal";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Features } from "./Features";
import { Employers } from "./Employers";
import { About } from "./About";
import { Pricing } from "./Pricing";
import { Contact } from "./Contact";
import { Footer } from "./Footer";

interface LandingPageProps {
  onSignIn?: () => void;
}

export function LandingPage(_props: LandingPageProps) {
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | undefined>(undefined);
  const [authIntent, setAuthIntent] = useState<AccountType>("seeker");
  const heroCtaRef = useRef<HTMLButtonElement>(null);

  function openAuth(tab?: string, intent: AccountType = "seeker") {
    setPendingTab(tab);
    setAuthIntent(intent);
    setAuthOpen(true);
  }

  return (
    <div
      id="top"
      className="min-h-screen"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <Nav openAuth={openAuth} heroCtaRef={heroCtaRef} />

      <main>
        <Hero openAuth={openAuth} heroCtaRef={heroCtaRef} />
        <HowItWorks openAuth={openAuth} />
        <Features openAuth={openAuth} />
        <Employers openAuth={openAuth} />
        <About />
        <Pricing openAuth={openAuth} />
        <Contact />
      </main>

      <Footer openAuth={openAuth} />

      {authOpen && (
        <AuthModal onClose={() => setAuthOpen(false)} pendingTab={pendingTab} intent={authIntent} />
      )}
    </div>
  );
}
