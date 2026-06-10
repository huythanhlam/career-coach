import { useEffect } from "react";

/**
 * Warn before the tab closes/navigates away while `isDirty` is true (e.g. a
 * debounced autosave hasn't flushed yet). Browsers show their own generic
 * "unsaved changes" prompt.
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
