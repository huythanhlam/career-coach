/**
 * POST /api/screenshot — Vercel Node serverless function.
 *
 * Body: { url: string }   (must be a linkedin.com URL — enforced in capture.ts)
 * Returns: { image: "data:image/png;base64,…", blocked, regions?, note? }
 *
 * Security: this endpoint is public, so it (1) requires a valid Supabase session
 * (Bearer token) and (2) rate-limits per user. Combined with the LinkedIn-host
 * allowlist in capture.ts, this closes the unauthenticated SSRF/abuse surface.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { captureScreenshot } from "./_lib/capture";

export const config = { maxDuration: 30 };

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Best-effort in-memory rate limit, keyed by user. Module scope persists across
// warm invocations (Fluid Compute reuses instances), so this meaningfully
// throttles abuse; a hard global limit would need a shared store (e.g. Upstash).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();
function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

async function authenticate(req: VercelRequest): Promise<string | null> {
  if (!supabase) return null;
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const userId = await authenticate(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (isRateLimited(userId)) {
    res.status(429).json({ error: "Too many requests — please wait a moment and try again." });
    return;
  }

  const { url } = (req.body ?? {}) as { url?: string };
  if (!url) {
    res.status(400).json({ error: "Missing url" });
    return;
  }

  try {
    const result = await captureScreenshot(url);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("[screenshot] Error:", error?.message);
    res.status(500).json({ error: "Failed to capture screenshot." });
  }
}
