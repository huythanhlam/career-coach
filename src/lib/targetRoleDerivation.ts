import type { UserProfile } from "@/types/userProfile";
import { generateId } from "@/types/userProfile";
import type { TargetRole } from "@/types/jobPosting";

// Auto-derives structured `TargetRole`s from a profile's resume-derived
// `targetRole` / `workHistory`, so the weekly suggestion cron and the
// "Suggested this week" lane in Job Postings work as soon as a resume or work
// history exists — without requiring a manual visit to the job-alerts editor.

export const MAX_AUTO_TARGET_ROLES = 3;

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Derive up to MAX_AUTO_TARGET_ROLES target roles from a profile's
 * resume-derived `targetRole` and `workHistory`, most-relevant first.
 * Pure and deterministic — callers decide whether/when to persist the result.
 */
export function deriveTargetRoles(profile: UserProfile): TargetRole[] {
  const candidates: string[] = [];
  if (profile.targetRole?.trim()) candidates.push(profile.targetRole.trim());

  const workHistory = profile.workHistory ?? [];
  const currentFirst = [...workHistory].sort(
    (a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0),
  );
  for (const w of currentFirst) {
    if (w.role?.trim()) candidates.push(w.role.trim());
  }

  const seen = new Set<string>();
  const roles: TargetRole[] = [];
  for (const title of candidates) {
    const key = normalizeTitle(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    roles.push({ id: generateId(), title });
    if (roles.length >= MAX_AUTO_TARGET_ROLES) break;
  }
  return roles;
}
