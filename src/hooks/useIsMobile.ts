import { useEffect, useState } from "react";

/**
 * Reactive viewport check for components that style with inline `style={{}}`
 * (where Tailwind `sm:`/`md:` breakpoints don't apply). Matches the Tailwind
 * `md` breakpoint: true below 768px.
 */
export function useIsMobile(): boolean {
  const query = "(max-width: 767px)";
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
