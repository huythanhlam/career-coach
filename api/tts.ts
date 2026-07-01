/**
 * POST /api/tts — Vercel Node serverless function.
 *
 * Body: { text: string, voice?: string }
 * Returns: { audio: base64, contentType } synthesized by the Vercel AI Gateway
 * voice models (https://vercel.com/blog/realtime-voice-agents-on-ai-gateway).
 * Audio is returned base64-in-JSON (not raw bytes) to mirror api/screenshot.ts —
 * a proven-reliable transport for binary payloads from a Vercel Node function.
 *
 * Security: this endpoint is public and spends AI Gateway credits, so it (1)
 * requires a valid Supabase session (Bearer token) and (2) rate-limits per user,
 * mirroring api/screenshot.ts. If AI_GATEWAY_API_KEY is unset it returns 501 and
 * the frontend falls back to the browser's built-in speech synthesis.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { synthesizeViaGateway, TTS_TEXT_LIMIT } from "./_lib/tts";

export const config = { maxDuration: 30 };

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Best-effort in-memory rate limit, keyed by user. Module scope persists across
// warm invocations (Fluid Compute reuses instances), so this meaningfully
// throttles abuse; a hard global limit would need a shared store (e.g. Upstash).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
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

const detailOf = (e: any) => String(e?.message ?? e).slice(0, 300);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
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

    const { text, voice } = (req.body ?? {}) as { text?: string; voice?: string };
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Missing text" });
      return;
    }
    if (text.length > TTS_TEXT_LIMIT) {
      res.status(400).json({ error: "Text too long" });
      return;
    }
    if (!process.env.AI_GATEWAY_API_KEY) {
      res.status(501).json({ error: "TTS backend not configured" });
      return;
    }

    let audio: Buffer;
    let contentType: string;
    try {
      ({ audio, contentType } = await synthesizeViaGateway(text, voice));
    } catch (error: any) {
      // Log the full stack server-side; 502 tells the client the gateway call
      // itself failed (vs. auth/config). `detail` surfaces the reason to the
      // browser Network tab so it's diagnosable without server-log access.
      console.error("[tts] gateway error:", error?.stack ?? error?.message ?? error);
      if (!res.headersSent) res.status(502).json({ error: "TTS backend error", detail: detailOf(error) });
      return;
    }

    res.status(200).json({ audio: audio.toString("base64"), contentType });
  } catch (error: any) {
    // Anything the checks above didn't handle — never let it become a bare 500.
    console.error("[tts] unhandled error:", error?.stack ?? error?.message ?? error);
    if (!res.headersSent) res.status(500).json({ error: "TTS failed", detail: detailOf(error) });
  }
}
