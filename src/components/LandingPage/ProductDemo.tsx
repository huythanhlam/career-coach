import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { DemoFrame } from "./DemoFrame";
import { ResumeScene, InterviewScene, MarketScene, SalaryScene } from "./scenes";
import { timelineAt, jumpOffsetMs } from "./demoTimeline";
import { usePrefersReducedMotion } from "./useMotion";

// The hero product demo: a scripted, auto-playing "screen recording" of the app.
// A single requestAnimationFrame clock drives an elapsed-ms value; demoTimeline
// (pure, unit-tested) turns that into the active scene + progress, and each scene
// renders itself from that progress.
//
// SWAP POINT: to show a real recording instead, replace <DemoFrame>'s children
// with <video src="/demo.mp4" autoPlay muted loop playsInline /> and drop the
// scene/RAF machinery below — the frame, caption, and layout stay as-is.

interface Scene {
  id: string;
  label: string;
  caption: string;
  durationMs: number;
  render: (progress: number) => React.ReactNode;
}

const SCENES: Scene[] = [
  {
    id: "resume",
    label: "Resume Analyzer",
    caption: "Analyze your resume against any job in seconds",
    durationMs: 4200,
    render: (p) => <ResumeScene progress={p} />,
  },
  {
    id: "interview",
    label: "Mock Interview",
    caption: "Practice real interviews and get STAR-rated feedback",
    durationMs: 5200,
    render: (p) => <InterviewScene progress={p} />,
  },
  {
    id: "market",
    label: "Market Compensation",
    caption: "See what the role actually pays before you name a number",
    durationMs: 4200,
    render: (p) => <MarketScene progress={p} />,
  },
  {
    id: "salary",
    label: "Salary Negotiator",
    caption: "Get a counter-offer script backed by real market data",
    durationMs: 5000,
    render: (p) => <SalaryScene progress={p} />,
  },
];

export function ProductDemo() {
  const reduced = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const offsetRef = useRef(0); // elapsed accumulated before the current play segment
  const startRef = useRef(0); // performance.now() when the current segment began
  const rafRef = useRef(0);

  // Auto-play once we know the motion preference; respect reduced motion.
  useEffect(() => {
    if (!reduced) setPlaying(true);
  }, [reduced]);

  useEffect(() => {
    if (!playing) return;
    startRef.current = performance.now();
    const loop = () => {
      setElapsed(offsetRef.current + (performance.now() - startRef.current));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      // Bank the time played so far so a resume continues seamlessly.
      offsetRef.current += performance.now() - startRef.current;
      cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const base = timelineAt(SCENES, elapsed);
  const reducedStatic = reduced && !playing;
  const activeIndex = base.sceneIndex;
  const activeProgress = reducedStatic ? 1 : base.sceneProgress;
  const scene = SCENES[activeIndex];

  function jumpTo(i: number) {
    const off = jumpOffsetMs(SCENES, i);
    offsetRef.current = off;
    startRef.current = performance.now();
    setElapsed(off);
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <DemoFrame caption={scene.caption}>
        {/* Decorative product recreation — narrated by the caption + controls. */}
        <div aria-hidden="true" className="h-full w-full">
          {scene.render(activeProgress)}
        </div>

        {reducedStatic && (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label="Play product demo"
            className="absolute inset-0 flex items-center justify-center group focus-visible:outline-none"
          >
            <span
              className="w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 group-focus-visible:ring-4"
              style={{
                background: "var(--primary)",
                boxShadow: "0 12px 40px rgba(217,119,87,0.45)",
                ["--tw-ring-color" as string]: "rgba(217,119,87,0.4)",
              }}
            >
              <Play className="w-7 h-7 text-white ml-1" />
            </span>
          </button>
        )}
      </DemoFrame>

      {/* Controls: play/pause · chapter dots · progress */}
      <div className="flex items-center gap-3 mt-4 px-1">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause product demo" : "Play product demo"}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2"
          style={{
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            ["--tw-ring-color" as string]: "var(--ring)",
          }}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="flex items-center gap-1.5" role="tablist" aria-label="Demo chapters">
          {SCENES.map((s, i) => {
            const active = i === activeIndex;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={s.label}
                onClick={() => jumpTo(i)}
                className="h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2"
                style={{
                  width: active ? 28 : 8,
                  background: active ? "var(--primary)" : "var(--border)",
                  ["--tw-ring-color" as string]: "var(--ring)",
                }}
              />
            );
          })}
        </div>

        <span
          className="ml-auto text-xs font-medium truncate"
          style={{ color: "var(--muted-foreground)" }}
        >
          {scene.label}
        </span>
      </div>

      {/* Intra-scene progress bar */}
      <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: "var(--muted)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${activeProgress * 100}%`, background: "var(--primary)", opacity: 0.7 }}
        />
      </div>
    </div>
  );
}
