import type { ReactNode } from "react";
import { Compass } from "lucide-react";

/**
 * Minimal public chrome around the blog for logged-out visitors. The app itself
 * sits behind an auth gate, but the blog is public — this gives anonymous
 * readers a header with a path back to sign up / sign in. "Home" / "Get started"
 * navigate to a non-blog hash so AuthGate falls through to the LandingPage.
 */
function leaveBlog() {
  window.location.hash = "/";
}

export function PublicBlogShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <nav
        className="sticky top-0 z-40 border-b"
        style={{ background: "rgba(251,247,241,0.92)", backdropFilter: "blur(12px)", borderColor: "var(--border)" }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={leaveBlog} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <Compass className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-semibold text-lg">TechCoach AI</span>
          </button>
          <button
            onClick={leaveBlog}
            className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--primary)" }}
          >
            Get Started Free
          </button>
        </div>
      </nav>

      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
