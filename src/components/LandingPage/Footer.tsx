import type { OpenAuth } from "./types";

interface FooterProps {
  openAuth: OpenAuth;
}

export function Footer({ openAuth }: FooterProps) {
  return (
    <footer className="border-t py-14" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--primary)" }}
              aria-hidden="true"
            />
            <span className="font-display font-medium tracking-tight">TechCoach AI</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#/blog" className="hover:text-foreground transition-colors">
              Blog
            </a>
            <a href="#about" className="hover:text-foreground transition-colors">
              About
            </a>
            <a href="#contact" className="hover:text-foreground transition-colors">
              Contact
            </a>
            <button onClick={() => openAuth()} className="hover:text-foreground transition-colors">
              Sign In
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} TechCoach AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
