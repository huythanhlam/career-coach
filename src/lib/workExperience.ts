/**
 * Canonical handling of an ongoing ("Present") role.
 *
 * Source of truth = the boolean `current` flag. `endDate` holds ONLY a real
 * month/year and is empty for current roles. Legacy data sometimes encoded
 * "Present" as the literal `endDate` string; the helpers below treat that as
 * equivalent and `normalize*` rewrites it to the canonical shape.
 *
 * Why a boolean and not a magic string: it's queryable in SQL
 * (`work_history @> '[{"current": true}]'`), locale-proof, and avoids "Present"
 * vs "present" vs "Current" drift.
 */

export const PRESENT_LABEL = "Present";

type EndFields = { endDate?: string; current?: boolean };

/** Is this an ongoing role? Honors the canonical flag and legacy "Present". */
export function isCurrentRole(w: EndFields): boolean {
  return w.current === true || (w.endDate ?? "").trim().toLowerCase() === "present";
}

/** Display label for the end of a role: "Present" for current, else the date. */
export function endDateLabel(w: EndFields): string {
  return isCurrentRole(w) ? PRESENT_LABEL : (w.endDate ?? "");
}

/**
 * Rewrite one entry to the canonical shape: `current` boolean is authoritative,
 * `endDate` is cleared when current and never holds the string "Present".
 */
export function normalizeWorkEntry<T extends EndFields>(w: T): T {
  const current = isCurrentRole(w);
  return { ...w, current, endDate: current ? "" : (w.endDate ?? "") };
}

export function normalizeWorkHistory<T extends EndFields>(list: T[] | undefined): T[] {
  return (list ?? []).map(normalizeWorkEntry);
}
