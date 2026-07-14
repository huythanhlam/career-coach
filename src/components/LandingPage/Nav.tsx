import { useEffect, useState } from "react";
import { Building2, Menu, ArrowRight } from "lucide-react";
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
  const [scrolled, setScrolled] = useState(false);

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

  // Nav starts transparent and floating over the hero; a hairline + blur only
  // appear once the page has actually scrolled, the quieter header treatment
  // seen on workflow.design rather than an always-on opaque bar.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="sticky top-0 z-40"
      style={{
        background: scrolled ? "color-mix(in srgb, var(--background) 94%, transparent)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
        transition: "background 0.3s ease, border-color 0.3s ease",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--primary)" }}
            aria-hidden="true"
          />
          <span className="font-display font-medium text-base tracking-tight">TechCoach AI</span>
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
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Building2 className="w-3.5 h-3.5" /> For Employers
          </a>
        </div>

        <div className="hidden md:flex items-center gap-1">
          <a
            href="#/blog"
            className="text-sm px-4 py-2 rounded-md transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            Blog
          </a>
          <button
            onClick={() => openAuth()}
            className="text-sm px-4 py-2 rounded-md transition-colors hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2"
            style={{ ["--tw-ring-color" as string]: "var(--ring)" }}
          >
            Sign In
          </button>
          {/* Surfaces only once the hero CTA has scrolled out of view. */}
          <button
            onClick={() => openAuth()}
            aria-hidden={!showNavCta}
            tabIndex={showNavCta ? 0 : -1}
            className="ml-2 inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md focus-visible:outline-none focus-visible:ring-2"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              opacity: showNavCta ? 1 : 0,
              transform: showNavCta ? "translateY(0)" : "translateY(-6px)",
              pointerEvents: showNavCta ? "auto" : "none",
              transition: "opacity 0.25s ease, transform 0.25s ease",
              ["--tw-ring-color" as string]: "var(--ring)",
            }}
          >
            Get started <ArrowRight className="w-3.5 h-3.5" />
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
            className="w-full text-sm font-semibold py-2.5 rounded-md"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            Get Started Free
          </button>
          <button
            onClick={() => {
              openAuth(undefined, "employer");
              setMobileMenuOpen(false);
            }}
            className="w-full text-sm font-semibold py-2.5 rounded-md"
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
