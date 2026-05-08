import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type UserProfile, createEmptyProfile } from "@/types/userProfile";

const STORAGE_KEY = "careerCoach_userProfile";

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as UserProfile;
  } catch {
    // ignore parse errors
  }
  return createEmptyProfile();
}

function saveProfile(profile: UserProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

interface UserProfileContextValue {
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  resetProfile: () => void;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      saveProfile(next);
      return next;
    });
  }, []);

  const resetProfile = useCallback(() => {
    const fresh = createEmptyProfile();
    saveProfile(fresh);
    setProfile(fresh);
  }, []);

  return (
    <UserProfileContext.Provider value={{ profile, updateProfile, resetProfile }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileContextValue {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error("useUserProfile must be used within UserProfileProvider");
  return ctx;
}
