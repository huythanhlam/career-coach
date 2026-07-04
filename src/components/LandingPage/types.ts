import type { AccountType } from "@/types/userProfile";

/** Opens the auth modal, optionally deep-linking to a tab and account intent. */
export type OpenAuth = (tab?: string, intent?: AccountType) => void;
