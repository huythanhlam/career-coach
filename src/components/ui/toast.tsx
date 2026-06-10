/**
 * Minimal toast system (no external dependency). Call `toast("…", "success")`
 * from anywhere; render `<Toaster />` once near the app root.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

type Listener = (t: ToastItem) => void;
let listener: Listener | null = null;
let nextId = 1;

export function toast(message: string, variant: ToastVariant = "info") {
  listener?.({ id: nextId++, message, variant });
}

const VARIANT_STYLE: Record<ToastVariant, { icon: typeof Info; color: string }> = {
  success: { icon: CheckCircle2, color: "var(--forest, #2F6B4F)" },
  error: { icon: AlertTriangle, color: "#B3422F" },
  info: { icon: Info, color: "var(--primary)" },
};

const TOAST_DURATION_MS = 4500;

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    listener = (t) => {
      setToasts((prev) => [...prev.slice(-3), t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), TOAST_DURATION_MS);
    };
    return () => {
      listener = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none"
    >
      {toasts.map((t) => {
        const { icon: Icon, color } = VARIANT_STYLE[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-border pl-4 pr-2 py-2.5 text-sm animate-in slide-in-from-bottom-2 fade-in duration-200"
            style={{
              background: "var(--card)",
              color: "var(--foreground)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              maxWidth: 420,
            }}
          >
            <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
            <span className="leading-snug">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Dismiss notification"
              className="ml-1 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-muted transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
