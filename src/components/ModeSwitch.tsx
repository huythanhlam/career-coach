import { Briefcase, Building2 } from "lucide-react";
import { useUserProfile } from "@/context/UserProfileContext";
import type { AccountType } from "@/types/userProfile";
import { ACCOUNT_TYPES, MODE_META } from "@/lib/accountMode";

interface ModeSwitchProps {
  /** Called after the account type is persisted — used to navigate to the mode's home. */
  onSwitched?: (type: AccountType) => void;
  /** Compact (sidebar) vs comfortable (settings) sizing. */
  size?: "sm" | "md";
}

const ICONS: Record<AccountType, React.ElementType> = {
  seeker: Briefcase,
  employer: Building2,
};

/**
 * Segmented Job Seeker | Employer toggle. Flips profile.accountType (the app
 * re-renders nav/routing off it) and reports the new mode so the caller can land
 * the user on that mode's home view.
 */
export function ModeSwitch({ onSwitched, size = "sm" }: ModeSwitchProps) {
  const { profile, updateProfile } = useUserProfile();
  const active: AccountType = profile.accountType === "employer" ? "employer" : "seeker";
  const h = size === "sm" ? 32 : 38;

  const choose = (type: AccountType) => {
    if (type === active) return;
    updateProfile({ accountType: type });
    onSwitched?.(type);
  };

  return (
    <div
      role="group"
      aria-label="Switch between job seeker and employer mode"
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        borderRadius: 12,
        background: "var(--muted)",
        border: "1px solid var(--border)",
      }}
    >
      {ACCOUNT_TYPES.map((type) => {
        const Icon = ICONS[type];
        const isActive = type === active;
        return (
          <button
            key={type}
            type="button"
            onClick={() => choose(type)}
            aria-pressed={isActive}
            style={{
              flex: 1,
              height: h,
              borderRadius: 9,
              border: "none",
              cursor: isActive ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontFamily: "inherit",
              fontSize: size === "sm" ? 12 : 13,
              fontWeight: 600,
              background: isActive ? "var(--card)" : "transparent",
              color: isActive ? "var(--primary)" : "var(--muted-foreground)",
              boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              transition: "color 0.15s, background 0.15s",
            }}
          >
            <Icon className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
            {MODE_META[type].label}
          </button>
        );
      })}
    </div>
  );
}
