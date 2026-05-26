import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

export interface Application {
  id: string;
  company: string;
  role: string;
  status: "applied" | "interviewing" | "offer" | "rejected" | "pending";
  date: string;
  location: string;
}

function rowToApplication(row: Record<string, unknown>): Application {
  return {
    id: row.id as string,
    company: row.company as string,
    role: row.role as string,
    status: row.status as Application["status"],
    date: row.applied_date as string,
    location: row.location as string,
  };
}

export function useJobApplications() {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("job_applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setApps(data.map(rowToApplication));
        setLoading(false);
      });
  }, [user?.id]);

  const addApplication = useCallback(
    async (app: Omit<Application, "id">) => {
      if (!user) return;
      const { data } = await supabase
        .from("job_applications")
        .insert({
          user_id: user.id,
          company: app.company,
          role: app.role,
          status: app.status,
          applied_date: app.date,
          location: app.location,
        })
        .select()
        .single();
      if (data) setApps((prev) => [rowToApplication(data), ...prev]);
    },
    [user]
  );

  const updateStatus = useCallback(
    async (id: string, status: Application["status"]) => {
      await supabase.from("job_applications").update({ status }).eq("id", id);
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    },
    []
  );

  const deleteApplication = useCallback(async (id: string) => {
    await supabase.from("job_applications").delete().eq("id", id);
    setApps((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { apps, loading, addApplication, updateStatus, deleteApplication };
}
