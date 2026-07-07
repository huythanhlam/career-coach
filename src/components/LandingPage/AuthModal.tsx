import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Compass, X, Briefcase, Building2 } from "lucide-react";
import type { AccountType } from "@/types/userProfile";
import { setPendingAccountType } from "@/lib/accountMode";

type AuthMode = "sign_in" | "sign_up" | "forgot_password";

interface AuthModalProps {
  onClose: () => void;
  pendingTab?: string;
  intent?: AccountType;
}

export function AuthModal({ onClose, pendingTab, intent = "seeker" }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("sign_up");
  const [accountIntent, setAccountIntent] = useState<AccountType>(intent);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const isEmployer = accountIntent === "employer";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (pendingTab) {
      localStorage.setItem("pendingTab", pendingTab);
    }
    // Carry the chosen account type through signup → onboarding.
    setPendingAccountType(accountIntent);

    if (mode === "sign_in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ text: error.message, error: true });
    } else if (mode === "sign_up") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage({ text: error.message, error: true });
      else setMessage({ text: "Check your email to confirm your account.", error: false });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) setMessage({ text: error.message, error: true });
      else setMessage({ text: "Password reset email sent.", error: false });
    }
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(31,27,22,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 sm:p-8 relative"
        style={{
          background: "var(--background)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.15)",
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "var(--primary)" }}
            >
              <Compass className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm">TechCoach AI</span>
          </div>

          {/* Account intent — a clear, distinct path for candidates vs employers */}
          {mode !== "forgot_password" && (
            <div
              role="group"
              aria-label="Account type"
              className="flex gap-1 p-1 rounded-xl mb-4"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
            >
              {[
                { type: "seeker" as AccountType, icon: Briefcase, label: "I'm a candidate" },
                { type: "employer" as AccountType, icon: Building2, label: "I'm an employer" },
              ].map(({ type, icon: Icon, label }) => {
                const active = accountIntent === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAccountIntent(type)}
                    aria-pressed={active}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{
                      height: 34,
                      background: active ? "var(--card)" : "transparent",
                      color: active ? "var(--primary)" : "var(--muted-foreground)",
                      boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                );
              })}
            </div>
          )}

          <h2 className="font-display text-2xl font-semibold text-foreground">
            {mode === "sign_in"
              ? "Welcome back"
              : mode === "forgot_password"
                ? "Reset password"
                : isEmployer
                  ? "Hire with TechCoach AI"
                  : "Start for free"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "sign_in"
              ? "Sign in to your account"
              : mode === "forgot_password"
                ? "Enter your email to reset"
                : isEmployer
                  ? "Create your employer account — post jobs and reach candidates"
                  : "Create your free account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
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
            }}
          />
          {mode !== "forgot_password" && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
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
              }}
            />
          )}

          {message && (
            <div
              className="text-sm rounded-xl px-3 py-2"
              style={{
                background: message.error ? "rgba(244,63,94,0.08)" : "rgba(47,107,79,0.08)",
                color: message.error ? "#F43F5E" : "#2F6B4F",
                border: `1px solid ${message.error ? "rgba(244,63,94,0.2)" : "rgba(47,107,79,0.2)"}`,
              }}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
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
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "Please wait…"
              : mode === "sign_in"
                ? "Sign In"
                : mode === "sign_up"
                  ? "Create Account"
                  : "Send Reset Email"}
          </button>
        </form>

        <div className="mt-4 text-center space-y-2">
          {mode === "sign_in" && (
            <>
              <button
                onClick={() => setMode("forgot_password")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Forgot password?
              </button>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button
                  onClick={() => setMode("sign_up")}
                  className="font-semibold"
                  style={{ color: "var(--primary)" }}
                >
                  Sign up free
                </button>
              </p>
            </>
          )}
          {mode === "sign_up" && (
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                onClick={() => setMode("sign_in")}
                className="font-semibold"
                style={{ color: "var(--primary)" }}
              >
                Sign in
              </button>
            </p>
          )}
          {mode === "forgot_password" && (
            <button
              onClick={() => setMode("sign_in")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
