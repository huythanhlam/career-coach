import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export type MFAEnrollState =
  | { status: "idle" }
  | { status: "enrolling"; factorId: string; qrCode: string; secret: string }
  | { status: "verifying" }
  | { status: "enrolled" }
  | { status: "error"; message: string };

export type MFAChallengeState =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "success" }
  | { status: "error"; message: string };

export function useAuthMFA() {
  const [enrollState, setEnrollState] = useState<MFAEnrollState>({ status: "idle" });
  const [challengeState, setChallengeState] = useState<MFAChallengeState>({ status: "idle" });
  const [enrolledFactors, setEnrolledFactors] = useState<
    Array<{ id: string; friendlyName: string | null; status: string }>
  >([]);

  const listFactors = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return;
    setEnrolledFactors(
      data.totp.map((f) => ({
        id: f.id,
        friendlyName: f.friendly_name ?? null,
        status: f.status,
      })),
    );
  }, []);

  const startEnroll = useCallback(async (friendlyName?: string) => {
    setEnrollState({ status: "idle" });
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: friendlyName ?? "Authenticator app",
    });
    if (error || !data) {
      setEnrollState({ status: "error", message: error?.message ?? "Enrollment failed" });
      return;
    }
    setEnrollState({
      status: "enrolling",
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }, []);

  const verifyEnroll = useCallback(
    async (code: string): Promise<boolean> => {
      if (enrollState.status !== "enrolling") return false;
      setEnrollState({ ...enrollState, status: "verifying" } as MFAEnrollState);

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollState.factorId,
      });

      if (challengeError || !challengeData) {
        setEnrollState({ status: "error", message: challengeError?.message ?? "Challenge failed" });
        return false;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollState.factorId,
        challengeId: challengeData.id,
        code: code.replace(/\s/g, ""),
      });

      if (verifyError) {
        setEnrollState({
          status: "enrolling",
          factorId: enrollState.factorId,
          qrCode:
            (
              enrollState as Extract<
                MFAEnrollState,
                { status: "verifying" | "enrolling" } & { qrCode: string }
              >
            ).qrCode ?? "",
          secret: (enrollState as any).secret ?? "",
        });
        return false;
      }

      // Mark mfa_enrolled via security definer RPC (client cannot write this column directly)
      await supabase.rpc("set_mfa_enrolled", { enrolled: true });

      setEnrollState({ status: "enrolled" });
      await listFactors();
      return true;
    },
    [enrollState, listFactors],
  );

  const unenroll = useCallback(
    async (factorId: string): Promise<boolean> => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) return false;

      const { error: rpcError } = await supabase.rpc("set_mfa_enrolled", { enrolled: false });
      if (rpcError) {
        // Server enforces aal2 before unenroll — surface to caller
        setEnrollState({ status: "error", message: rpcError.message });
        return false;
      }

      await listFactors();
      return true;
    },
    [listFactors],
  );

  const verifyChallenge = useCallback(async (factorId: string, code: string): Promise<boolean> => {
    setChallengeState({ status: "verifying" });

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError || !challengeData) {
      setChallengeState({
        status: "error",
        message: challengeError?.message ?? "Challenge failed",
      });
      return false;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: code.replace(/\s/g, ""),
    });

    if (verifyError) {
      setChallengeState({ status: "error", message: "Invalid code. Try again." });
      return false;
    }

    setChallengeState({ status: "success" });
    return true;
  }, []);

  return {
    enrollState,
    challengeState,
    enrolledFactors,
    listFactors,
    startEnroll,
    verifyEnroll,
    unenroll,
    verifyChallenge,
  };
}
