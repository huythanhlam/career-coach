import type { AccountType } from "@/types/userProfile";
import type { ViewId } from "@/components/Sidebar";

/** localStorage key carrying a chosen account type from signup through onboarding. */
export const PENDING_ACCOUNT_TYPE_KEY = "pendingAccountType";

/** Where each mode lands by default after sign-in or a mode switch. */
export function defaultViewForAccount(type: AccountType | undefined): ViewId {
  return type === "employer" ? "employer_studio" : "dashboard";
}

export interface ModeMeta {
  /** Short label used on chips/toggles, e.g. "Employer". */
  label: string;
  /** Full label used as a mode indicator, e.g. "Employer mode". */
  modeLabel: string;
}

export const MODE_META: Record<AccountType, ModeMeta> = {
  seeker: { label: "Job Seeker", modeLabel: "Job seeker mode" },
  employer: { label: "Employer", modeLabel: "Employer mode" },
};

export const ACCOUNT_TYPES: AccountType[] = ["seeker", "employer"];

/** Read (and validate) a pending account type stashed at signup; null if none. */
export function readPendingAccountType(): AccountType | null {
  try {
    const raw = localStorage.getItem(PENDING_ACCOUNT_TYPE_KEY);
    return raw === "seeker" || raw === "employer" ? raw : null;
  } catch {
    return null;
  }
}

export function setPendingAccountType(type: AccountType): void {
  try {
    localStorage.setItem(PENDING_ACCOUNT_TYPE_KEY, type);
  } catch {
    /* storage unavailable — fall back to the in-app account-type step */
  }
}

export function clearPendingAccountType(): void {
  try {
    localStorage.removeItem(PENDING_ACCOUNT_TYPE_KEY);
  } catch {
    /* no-op */
  }
}
