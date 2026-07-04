import { useEffect, useRef, useState } from "react";

/**
 * Whether the visitor has asked the OS to reduce motion. Read once on mount and
 * kept live via a media-query listener. During SSR / before mount it defaults to
 * `true` (reduced) so no animation can flash before we know the preference.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Reveal-on-scroll. Returns a ref to attach to a section and an `isVisible` flag
 * that flips true once the element scrolls ~12% into view (then stops observing).
 * Under reduced motion — or without IntersectionObserver — it reports visible
 * immediately and never constructs an observer, so content is always shown.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(): {
  ref: React.RefObject<T | null>;
  isVisible: boolean;
} {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (reduced || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  return { ref, isVisible };
}
