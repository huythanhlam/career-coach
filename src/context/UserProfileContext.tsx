import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { type UserProfile, createEmptyProfile } from "@/types/userProfile";
import { supabase } from "@/lib/supabaseClient";
import { rowToProfile, profileToRow } from "@/lib/profileMapper";
import { useAuth } from "./AuthContext";

interface UserProfileContextValue {
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  resetProfile: () => Promise<void>;
  loading: boolean;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(createEmptyProfile());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(rowToProfile(data));
        setLoading(false);
      });
  }, [user?.id]);

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!user) return;
      const next = { ...profile, ...patch, updatedAt: new Date().toISOString() };
      setProfile(next);
      await supabase.from("profiles").upsert(profileToRow(next, user.id));
    },
    [profile, user]
  );

  const resetProfile = useCallback(async () => {
    if (!user) return;
    const fresh = createEmptyProfile();
    setProfile(fresh);
    await supabase.from("profiles").upsert(profileToRow(fresh, user.id));
  }, [user]);

  return (
    <UserProfileContext.Provider
      value={{ profile, updateProfile, resetProfile, loading }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileContextValue {
  const ctx = useContext(UserProfileContext);
  if (!ctx)
    throw new Error("useUserProfile must be used within UserProfileProvider");
  return ctx;
}
