import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  listActiveNudges,
  dismissNudge,
  markNudgeDone,
  snoozeNudge,
  type CoachNudge,
} from "@/services/coachNudges";

/** Active Coach OS nudges (`coach_nudges`) for the Dashboard, with optimistic mutations. */
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

  const markDone = useCallback((id: string) => {
    setNudges((prev) => prev.filter((n) => n.id !== id));
    void markNudgeDone(id);
  }, []);

  const snooze = useCallback((id: string, days: number) => {
    setNudges((prev) => prev.filter((n) => n.id !== id));
    void snoozeNudge(id, days);
  }, []);

  return { nudges, loading, dismiss, markDone, snooze };
}
