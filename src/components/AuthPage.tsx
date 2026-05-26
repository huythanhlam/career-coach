import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabaseClient";

export function AuthPage() {
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
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            className="font-display"
            style={{
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              color: "var(--foreground)",
              lineHeight: 1.1,
            }}
          >
            Career Coach
          </div>
          <p
            style={{
              fontSize: 14,
              color: "var(--muted-foreground)",
              marginTop: 8,
            }}
          >
            Your AI-powered career partner
          </p>
        </div>

        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 24,
            padding: 32,
            boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
          }}
        >
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "#D97757",
                    brandAccent: "#c4664a",
                    inputBackground: "var(--muted)",
                    inputBorder: "var(--border)",
                    inputText: "var(--foreground)",
                    inputPlaceholder: "var(--muted-foreground)",
                  },
                  radii: {
                    borderRadiusButton: "14px",
                    buttonBorderRadius: "14px",
                    inputBorderRadius: "14px",
                  },
                  fontSizes: {
                    baseBodySize: "14px",
                  },
                },
              },
            }}
            providers={["google"]}
            redirectTo={window.location.origin}
          />
        </div>
      </div>
    </div>
  );
}
