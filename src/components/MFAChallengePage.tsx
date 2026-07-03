import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { ShieldCheck, ArrowRight, LogOut } from "lucide-react";
import { useAuthMFA } from "@/hooks/useAuthMFA";
import { useAuth } from "@/context/AuthContext";

interface Props {
  factorId: string;
  onSuccess: () => void;
}

/** 6-digit OTP input split into individual cells */
function OTPInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.replace(/\s/g, "").length === 6) {
      // bubble — parent listens to form submit
    }
  }

  return (
    <div className="relative">
      {/* Visible segmented display */}
      <div className="flex gap-2 justify-center mb-1" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => {
          const ch = value.replace(/\s/g, "")[i] ?? "";
          const isActive = value.replace(/\s/g, "").length === i;
          return (
            <div
              key={i}
              className="w-11 h-14 rounded-xl flex items-center justify-center text-2xl font-bold transition-all"
              style={{
                background: "var(--muted)",
                border: isActive
                  ? "2px solid var(--primary)"
                  : ch
                    ? "2px solid var(--border)"
                    : "2px solid var(--border)",
                color: "var(--foreground)",
                fontFamily: "var(--font-display)",
                boxShadow: isActive ? "0 0 0 3px rgba(217,119,87,0.15)" : "none",
              }}
            >
              {ch}
            </div>
          );
        })}
      </div>
      {/* Single hidden input driving state */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9 ]*"
        maxLength={7}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
          onChange(raw);
        }}
        onKeyDown={handleKey}
        aria-label="6-digit authentication code"
        className="absolute inset-0 opacity-0 cursor-text"
        style={{ caretColor: "transparent" }}
      />
    </div>
  );
}

export function MFAChallengePage({ factorId, onSuccess }: Props) {
  const { signOut } = useAuth();
  const { verifyChallenge, challengeState } = useAuthMFA();
  const [code, setCode] = useState("");

  const isVerifying = challengeState.status === "verifying";
  const error = challengeState.status === "error" ? challengeState.message : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = code.replace(/\s/g, "");
    if (digits.length !== 6 || isVerifying) return;
    const ok = await verifyChallenge(factorId, digits);
    if (ok) onSuccess();
    else setCode("");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-sm">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(217,119,87,0.12)",
              border: "1.5px solid rgba(217,119,87,0.25)",
            }}
          >
            <ShieldCheck className="w-8 h-8" style={{ color: "var(--primary)" }} />
          </div>
        </div>

        {/* Heading */}
        <h1
          className="text-center text-2xl font-bold mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
        >
          Two-factor authentication
        </h1>
        <p className="text-center text-sm mb-8" style={{ color: "var(--muted-foreground)" }}>
          Enter the 6-digit code from your authenticator app.
        </p>

        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
          }}
        >
          <form onSubmit={handleSubmit} noValidate>
            <OTPInput value={code} onChange={setCode} disabled={isVerifying} />

            {error && (
              <p
                className="text-center text-xs mt-3"
                role="alert"
                style={{ color: "var(--destructive)" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={code.replace(/\s/g, "").length !== 6 || isVerifying}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 hover:opacity-90"
              style={{
                background: "var(--primary)",
                color: "#fff",
                cursor: isVerifying ? "wait" : "pointer",
              }}
            >
              {isVerifying ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  Verify
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Sign out escape hatch */}
        <button
          onClick={() => signOut()}
          className="mt-5 w-full flex items-center justify-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: "var(--muted-foreground)" }}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out and use a different account
        </button>
      </div>
    </div>
  );
}
