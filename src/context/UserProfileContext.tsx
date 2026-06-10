import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

  // Mirror of `profile` that updateProfile reads/writes synchronously, so
  // back-to-back calls compose instead of clobbering each other, and the
  // callback stays referentially stable across profile changes.
  const profileRef = useRef(profile);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error("Failed to load profile:", error);
        if (data) {
          const loaded = rowToProfile(data);
          profileRef.current = loaded;
          setProfile(loaded);
        }
        setLoading(false);
      });
  }, [user?.id]);

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (!user) return;
      const next = { ...profileRef.current, ...patch, updatedAt: new Date().toISOString() };
      profileRef.current = next;
      setProfile(next);
      const { error } = await supabase.from("profiles").upsert(profileToRow(next, user.id));
      if (error) console.error("Failed to save profile:", error);
    },
    [user]
  );

  const resetProfile = useCallback(async () => {
    if (!user) return;
    const fresh = createEmptyProfile();
    profileRef.current = fresh;
    setProfile(fresh);
    await supabase.from("profiles").upsert(profileToRow(fresh, user.id));
  }, [user]);

  const value = useMemo(
    () => ({ profile, updateProfile, resetProfile, loading }),
    [profile, updateProfile, resetProfile, loading]
  );

  return (
    <UserProfileContext.Provider value={value}>
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
