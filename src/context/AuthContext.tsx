import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { migrateFromLocalStorage } from "@/lib/migrateFromLocalStorage";

export type AuthStep =
  | "idle"        // not signed in
  | "authenticated" // fully signed in (MFA passed or not enrolled)
  | "mfa_challenge"; // signed in with password, MFA required

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authStep: AuthStep;
  mfaFactorId: string | null;
  signOut: () => Promise<void>;
  completeMfaChallenge: (factorId: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>("idle");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function resolveStep(sess: Session | null) {
    if (!sess) {
      setAuthStep("idle");
      setMfaFactorId(null);
      return;
    }

    // Check if any TOTP factors are enrolled and not yet verified this session
    const { data } = await supabase.auth.mfa.listFactors();
    const totpFactors = data?.totp ?? [];
    const verified = totpFactors.filter((f) => f.status === "verified");

    if (verified.length > 0) {
      // Check AAL — if still aal1, MFA challenge is required
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel === "aal1" && aalData?.nextLevel === "aal2") {
        setMfaFactorId(verified[0].id);
        setAuthStep("mfa_challenge");
        return;
      }
    }

    setAuthStep("authenticated");
    setMfaFactorId(null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      resolveStep(session).finally(() => setLoading(false));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "SIGNED_IN" && session?.user) {
        migrateFromLocalStorage(session.user.id);
      }
      resolveStep(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  function completeMfaChallenge(factorId: string) {
    setMfaFactorId(null);
    setAuthStep("authenticated");
    // Re-fetch session so AAL2 token is reflected
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthStep("idle");
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        authStep,
        mfaFactorId,
        signOut,
        completeMfaChallenge,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
