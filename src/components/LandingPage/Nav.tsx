import { useEffect, useState } from "react";
import { Compass, Building2, Menu, ArrowRight } from "lucide-react";
import type { OpenAuth } from "./types";

interface NavProps {
  openAuth: OpenAuth;
  /** Ref to the hero's primary CTA; the nav CTA surfaces once it scrolls away. */
  heroCtaRef: React.RefObject<HTMLElement | null>;
}

const NAV_LINKS = ["Features", "How It Works", "About"];

export function Nav({ openAuth, heroCtaRef }: NavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNavCta, setShowNavCta] = useState(false);

  useEffect(() => {
    const node = heroCtaRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShowNavCta(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setShowNavCta(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [heroCtaRef]);

  return (
    <nav
      className="sticky top-0 z-40 border-b"
      style={{
        background: "rgba(251,247,241,0.92)",
        backdropFilter: "blur(12px)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "var(--primary)" }}
          >
            <Compass className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-semibold text-lg">TechCoach AI</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase().replace(/ /g, "-")}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </a>
          ))}
          <a
            href="#for-employers"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Building2 className="w-3.5 h-3.5" /> For Employers
          </a>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="#/blog"
            className="text-sm font-medium px-4 py-2 rounded-xl transition-colors hover:bg-muted"
          >
            Blog
          </a>
          <button
            onClick={() => openAuth()}
            className="text-sm font-medium px-4 py-2 rounded-xl transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2"
            style={{ ["--tw-ring-color" as string]: "var(--ring)" }}
          >
            Sign In
          </button>
          {/* Surfaces only once the hero CTA has scrolled out of view. */}
          <button
            onClick={() => openAuth()}
            aria-hidden={!showNavCta}
            tabIndex={showNavCta ? 0 : -1}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-white focus-visible:outline-none focus-visible:ring-2"
            style={{
              background: "var(--primary)",
              opacity: showNavCta ? 1 : 0,
              transform: showNavCta ? "translateY(0)" : "translateY(-6px)",
              pointerEvents: showNavCta ? "auto" : "none",
              transition: "opacity 0.25s ease, transform 0.25s ease",
              ["--tw-ring-color" as string]: "var(--ring)",
            }}
          >
            Get Started Free <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          className="md:hidden p-2 rounded-lg hover:bg-muted"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          className="md:hidden border-t px-4 py-4 space-y-3"
          style={{ background: "var(--background)", borderColor: "var(--border)" }}
        >
          {[...NAV_LINKS, "Contact"].map((label) => (
            <a
              key={label}
              href={`#${label.toLowerCase().replace(/ /g, "-")}`}
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm text-muted-foreground hover:text-foreground py-1"
            >
              {label}
            </a>
          ))}
          <a
            href="#for-employers"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-muted-foreground hover:text-foreground py-1"
          >
            For Employers
          </a>
          <button
            onClick={() => {
              openAuth();
              setMobileMenuOpen(false);
            }}
            className="w-full text-sm font-semibold py-2.5 rounded-xl text-white"
            style={{ background: "var(--primary)" }}
          >
            Get Started Free
          </button>
          <button
            onClick={() => {
              openAuth(undefined, "employer");
              setMobileMenuOpen(false);
            }}
            className="w-full text-sm font-semibold py-2.5 rounded-xl"
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            Post a job
          </button>
        </div>
      )}
    </nav>
  );
}
