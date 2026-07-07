interface DemoFrameProps {
  /** Faux address-bar label shown in the window chrome. */
  address?: string;
  /** Caption strip overlaid at the bottom of the window body. */
  caption?: string;
  children: React.ReactNode;
}

/**
 * Presentational "app window" chrome around whatever is playing inside it —
 * traffic-light dots, a faux address bar, and a reserved aspect-ratio body so
 * there is no layout shift while the demo mounts.
 *
 * SWAP POINT: to replace the scripted animation with a real screen recording,
 * drop a <video src="/demo.mp4" muted playsInline loop /> in as `children`
 * (from ProductDemo) — nothing else about this frame needs to change.
 */
export function DemoFrame({ address = "app.techcoach.ai", caption, children }: DemoFrameProps) {
  return (
    <div
      className="rounded-2xl overflow-hidden w-full"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        boxShadow: "0 24px 70px rgba(31,27,22,0.16)",
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-3 px-4"
        style={{ height: 40, background: "var(--paper)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="w-3 h-3 rounded-full" style={{ background: "#f43f5e" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#e8b948" }} />
          <span className="w-3 h-3 rounded-full" style={{ background: "#2f6b4f" }} />
        </div>
        <div
          className="flex-1 h-6 rounded-md flex items-center px-3 text-xs truncate"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            color: "var(--muted-foreground)",
          }}
        >
          {address}
        </div>
      </div>

      {/* Body — reserves its box so mounting the scene never shifts layout */}
      <div className="relative w-full" style={{ aspectRatio: "16 / 10", minHeight: 280 }}>
        <div className="absolute inset-0">{children}</div>

        {caption && (
          <div
            className="absolute inset-x-0 bottom-0 px-4 py-2.5 text-sm font-medium"
            style={{
              background: "linear-gradient(to top, rgba(31,27,22,0.72), rgba(31,27,22,0))",
              color: "#fff",
            }}
          >
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}
