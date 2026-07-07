/**
 * Per-user caching layer for AI-generated resume analysis.
 *
 * Two tiers: a localStorage layer for instant repeat lookups on the same device,
 * and a per-user Supabase table (`resume_analysis_cache`) so a resume analysis
 * persists across a user's devices without re-spending a Gemini call. Entries
 * older than TTL_DAYS are treated as stale.
 *
 * Unlike `marketDataCache` / `companyResearchCache` (shared public reference
 * data, readable by any user), a resume analysis is private, PII-derived output.
 * This cache is therefore strictly per-owner: reads/writes are RLS-scoped to the
 * caller (`auth.uid() = user_id`) and there is no cross-user sharing. The
 * `cache_key` is a content hash of (resumeText + jd), so editing the resume — or
 * changing the target job — yields a new key and the stale result is never
 * served.
 */
import { supabase } from "@/lib/supabaseClient";
import type { ResumeAnalysisOutput } from "@/ai/workflows/resumeAnalysis";

const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;
const LS_PREFIX = "racache:";
// NUL separator so ("a", "bc") and ("ab", "c") can never hash to the same key.
const SEP = "\u0000";

export interface CachedAnalysis {
  data: ResumeAnalysisOutput;
  cachedAt: string; // ISO timestamp
}

/**
 * Build a stable content-hash key over (resumeText, jd). Identical inputs always
 * hash to the same key; any change to either field produces a different key.
 */
export async function resumeAnalysisCacheKey(resumeText: string, jd: string): Promise<string> {
  const bytes = new TextEncoder().encode(resumeText + SEP + jd);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isFresh(ts: string | number): boolean {
  return Date.now() - new Date(ts).getTime() < TTL_MS;
}

function readLocal(key: string): CachedAnalysis | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAnalysis;
    if (!parsed?.cachedAt || !isFresh(parsed.cachedAt)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(key: string, entry: CachedAnalysis): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota / unavailable — non-fatal */
  }
}

/**
 * Look up a fresh cached analysis: localStorage first (instant), then the
 * per-user Supabase table (RLS restricts the row to the caller). A Supabase hit
 * warms localStorage. Returns null on miss/stale so the caller runs the workflow.
 */
export async function getCachedResumeAnalysis(key: string): Promise<CachedAnalysis | null> {
  const local = readLocal(key);
  if (local) return local;

  try {
    // RLS scopes this to the current user, so cache_key alone is sufficient.
    const { data, error } = await supabase
      .from("resume_analysis_cache")
      .select("data, updated_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (error || !data?.updated_at || !isFresh(data.updated_at as string)) return null;
    const entry: CachedAnalysis = {
      data: data.data as ResumeAnalysisOutput,
      cachedAt: data.updated_at as string,
    };
    writeLocal(key, entry);
    return entry;
  } catch {
    return null;
  }
}

/** Upsert a freshly generated analysis into both localStorage and the per-user table. */
export async function putCachedResumeAnalysis(
  key: string,
  data: ResumeAnalysisOutput,
): Promise<void> {
  const cachedAt = new Date().toISOString();
  writeLocal(key, { data, cachedAt });

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return; // signed-out / no session — localStorage still serves this device
    await supabase
      .from("resume_analysis_cache")
      .upsert(
        { user_id: userId, cache_key: key, data, updated_at: cachedAt },
        { onConflict: "user_id,cache_key" },
      );
  } catch {
    /* offline / RLS — localStorage still serves this device */
  }
}
