/**
 * Turn a Supabase/PostgREST error into a short, actionable message for the UI.
 * The most common failure in a fresh deployment is "the employer tables don't
 * exist yet" (migrations not applied), which otherwise surfaces as an opaque
 * PostgREST error — so we detect it and say what to do.
 */
export function describeDbError(error: unknown): string {
  const e = (error ?? {}) as { code?: string; message?: string; details?: string; hint?: string };
  const code = typeof e.code === "string" ? e.code : "";
  const text = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();

  // Undefined table/column — migrations haven't been applied.
  // 42P01 = undefined_table, 42703 = undefined_column (Postgres);
  // PGRST205 / "could not find the table" = PostgREST schema-cache miss.
  if (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST205" ||
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache")
  ) {
    return "The employer tables aren't set up yet. Apply the database migrations (see supabase/pending_migrations) and try again.";
  }

  // Row-level security blocked the write.
  if (code === "42501" || text.includes("row-level security") || text.includes("violates row-level security")) {
    return "You don't have permission to save this (row-level security). Make sure you're signed in and the migrations are applied.";
  }

  // Auth/session expired.
  if (code === "401" || text.includes("jwt") || text.includes("not authenticated")) {
    return "Your session has expired. Please refresh and sign in again.";
  }

  return e.message?.trim() || "Something went wrong saving to the database. Please try again.";
}
