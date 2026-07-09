import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StopGeneratingButtonProps {
  onStop: () => void;
  className?: string;
}

/**
 * Visible mid-stream cancel control, shared across every AI generation
 * surface (F2). Callers render it only while their own `isGenerating` state
 * is true; `onStop` should call the in-flight `AbortController.abort()` —
 * partial content stays on screen, no error is shown for a user-initiated stop.
 */
export function StopGeneratingButton({ onStop, className }: StopGeneratingButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onStop}
      aria-label="Stop generating"
      title="Stop generating"
      className={cn("gap-1.5", className)}
    >
      <Square className="w-3 h-3 fill-current" />
      Stop
    </Button>
  );
}
