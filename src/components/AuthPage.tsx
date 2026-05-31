import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Mode = "sign_in" | "sign_up" | "forgot_password";

const iStyle: React.CSSProperties = {
  background: "var(--muted)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  height: 44,
  fontSize: 14,
  padding: "0 14px",
  color: "var(--foreground)",
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};

const btnStyle: React.CSSProperties = {
  background: "var(--primary)",
  color: "#fff",
  border: "none",
  borderRadius: 14,
  height: 44,
  fontSize: 14,
  fontWeight: 600,
  width: "100%",
  cursor: "pointer",
  fontFamily: "inherit",
};

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "sign_in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ text: error.message, error: true });
    } else if (mode === "sign_up") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage({ text: error.message, error: true });
      else setMessage({ text: "Check your email to confirm your account.", error: false });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) setMessage({ text: error.message, error: true });
      else setMessage({ text: "Password reset link sent — check your inbox.", error: false });
    }

    setLoading(false);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background)",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            className="font-display"
            style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)", lineHeight: 1.1 }}
          >
            Career Coach
          </div>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 8 }}>
            Your AI-powered career partner
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 24,
            padding: 32,
            boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: "var(--foreground)" }}>
            {mode === "sign_in" ? "Sign in" : mode === "sign_up" ? "Create account" : "Reset password"}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={iStyle}
            />

            {mode !== "forgot_password" && (
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                style={iStyle}
              />
            )}

            {message && (
              <p style={{ fontSize: 13, color: message.error ? "var(--destructive)" : "var(--forest)", margin: 0 }} role="alert">
                {message.text}
              </p>
            )}

            <button type="submit" disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.6 : 1, marginTop: 4 }}>
              {loading ? "Please wait…" : mode === "sign_in" ? "Sign in" : mode === "sign_up" ? "Create account" : "Send reset link"}
            </button>
          </form>

          {mode !== "forgot_password" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>or</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              <button
                onClick={handleGoogle}
                style={{
                  ...btnStyle,
                  background: "var(--card)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}

          {/* Mode switcher */}
          <div style={{ marginTop: 20, fontSize: 13, textAlign: "center", color: "var(--muted-foreground)", display: "flex", flexDirection: "column", gap: 6 }}>
            {mode === "sign_in" && (
              <>
                <span>
                  Don't have an account?{" "}
                  <button onClick={() => { setMode("sign_up"); setMessage(null); }} style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", fontSize: 13 }}>
                    Sign up
                  </button>
                </span>
                <button onClick={() => { setMode("forgot_password"); setMessage(null); }} style={{ color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                  Forgot your password?
                </button>
              </>
            )}
            {mode === "sign_up" && (
              <span>
                Already have an account?{" "}
                <button onClick={() => { setMode("sign_in"); setMessage(null); }} style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", fontSize: 13 }}>
                  Sign in
                </button>
              </span>
            )}
            {mode === "forgot_password" && (
              <button onClick={() => { setMode("sign_in"); setMessage(null); }} style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", fontSize: 13 }}>
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
