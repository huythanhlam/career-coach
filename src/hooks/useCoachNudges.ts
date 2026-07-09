import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { listActiveNudges, dismissNudge, type CoachNudge } from "@/services/coachNudges";

/** Active Coach OS nudges (`coach_nudges`) for the Dashboard, with optimistic dismiss. */
export function useCoachNudges() {
  const { user } = useAuth();
  const [nudges, setNudges] = useState<CoachNudge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNudges([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listActiveNudges().then((rows) => {
      if (!cancelled) {
        setNudges(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dismiss = useCallback((id: string) => {
    setNudges((prev) => prev.filter((n) => n.id !== id));
    void dismissNudge(id);
  }, []);

  return { nudges, loading, dismiss };
}
