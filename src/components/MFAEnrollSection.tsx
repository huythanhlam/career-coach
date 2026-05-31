import { useState, useEffect } from "react";
import { ShieldCheck, ShieldOff, QrCode, Trash2, Check, X } from "lucide-react";
import { useAuthMFA } from "@/hooks/useAuthMFA";

const iStyle: React.CSSProperties = {
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  height: 38,
  fontSize: 13,
  padding: "0 12px",
  color: "var(--foreground)",
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
  letterSpacing: "0.15em",
  textAlign: "center",
};

/** Section shown inside ProfileSettings for MFA management */
export function MFAEnrollSection() {
  const {
    enrollState,
    enrolledFactors,
    listFactors,
    startEnroll,
    verifyEnroll,
    unenroll,
  } = useAuthMFA();

  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [unenrolling, setUnenrolling] = useState<string | null>(null);

  useEffect(() => {
    listFactors();
  }, [listFactors]);

  const verified = enrolledFactors.filter((f) => f.status === "verified");
  const isEnrolled = verified.length > 0;

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError(null);
    const ok = await verifyEnroll(code.replace(/\s/g, ""));
    if (!ok) {
      setVerifyError("Invalid code — check your authenticator and try again.");
      setCode("");
    } else {
      setCode("");
    }
  }

  async function handleUnenroll(factorId: string) {
    setUnenrolling(factorId);
    await unenroll(factorId);
    setUnenrolling(null);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: "var(--muted-foreground)" }}
        >
          Two-Factor Auth
        </h3>
        {isEnrolled ? (
          <span
            className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(47,107,79,0.12)", color: "var(--forest)" }}
          >
            <ShieldCheck className="w-3 h-3" /> Enabled
          </span>
        ) : (
          <span
            className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            <ShieldOff className="w-3 h-3" /> Off
          </span>
        )}
      </div>

      {/* Enrolled factors */}
      {isEnrolled && (
        <div className="flex flex-col gap-2 mb-3">
          {verified.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <QrCode className="w-3.5 h-3.5" style={{ color: "var(--forest)" }} />
                <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                  {f.friendlyName ?? "Authenticator app"}
                </span>
              </div>
              <button
                onClick={() => handleUnenroll(f.id)}
                disabled={unenrolling === f.id}
                className="p-1.5 rounded-lg transition-colors hover:opacity-70 disabled:opacity-40"
                style={{ background: "rgba(244,63,94,0.08)" }}
                aria-label="Remove authenticator"
              >
                <Trash2 className="w-3 h-3" style={{ color: "var(--destructive)" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Enroll flow */}
      {enrollState.status === "idle" && !isEnrolled && (
        <button
          onClick={() => startEnroll()}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-opacity hover:opacity-80 w-full justify-center"
          style={{
            background: "rgba(217,119,87,0.1)",
            color: "var(--primary)",
            border: "1px solid rgba(217,119,87,0.2)",
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Set up authenticator app
        </button>
      )}

      {enrollState.status === "enrolling" && (
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ background: "var(--card)", border: "1.5px solid var(--primary)" }}
        >
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Scan this QR code with your authenticator app (Google Authenticator, 1Password, etc.),
            then enter the 6-digit code below to confirm.
          </p>

          {/* QR Code */}
          <div className="flex justify-center">
            <img
              src={enrollState.qrCode}
              alt="MFA QR code"
              width={160}
              height={160}
              className="rounded-xl"
              style={{ imageRendering: "pixelated" }}
            />
          </div>

          {/* Manual secret */}
          <details className="text-xs">
            <summary
              className="cursor-pointer select-none"
              style={{ color: "var(--muted-foreground)" }}
            >
              Can't scan? Enter code manually
            </summary>
            <code
              className="block mt-1 p-2 rounded-lg text-xs break-all"
              style={{
                background: "var(--muted)",
                color: "var(--foreground)",
                letterSpacing: "0.1em",
                fontFamily: "monospace",
              }}
            >
              {enrollState.secret}
            </code>
          </details>

          {/* Verify form */}
          <form onSubmit={handleVerify} noValidate>
            <label
              className="block text-xs font-semibold mb-1.5 uppercase tracking-wider"
              style={{ color: "var(--muted-foreground)" }}
              htmlFor="mfa-verify-code"
            >
              Verification code
            </label>
            <input
              id="mfa-verify-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              autoComplete="one-time-code"
              style={iStyle}
            />
            {verifyError && (
              <p className="text-xs mt-1.5" role="alert" style={{ color: "var(--destructive)" }}>
                {verifyError}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                type="submit"
                disabled={code.length !== 6}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                <Check className="w-3.5 h-3.5" /> Confirm
              </button>
              <button
                type="button"
                onClick={() => { setCode(""); setVerifyError(null); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium"
                style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {enrollState.status === "enrolled" && (
        <p
          className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: "var(--forest)" }}
        >
          <Check className="w-3.5 h-3.5" />
          Authenticator app added successfully.
        </p>
      )}

      {enrollState.status === "error" && (
        <p className="text-xs" role="alert" style={{ color: "var(--destructive)" }}>
          {enrollState.message}
        </p>
      )}
    </section>
  );
}
