import { Compass } from "lucide-react";
import type { OpenAuth } from "./types";

interface FooterProps {
  openAuth: OpenAuth;
}

export function Footer({ openAuth }: FooterProps) {
  return (
    <footer className="border-t py-12" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "var(--primary)" }}
            >
              <Compass className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-semibold">TechCoach AI</span>
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
