/**
 * POST /api/screenshot — Vercel Node serverless function.
 *
 * Body: { url: string }
 * Returns: { image: "data:image/png;base64,…", blocked: boolean, note?: string }
 *
 * Runs headless Chromium (puppeteer-core + @sparticuz/chromium) to take a
 * full-page screenshot of a LinkedIn profile URL. See api/_lib/capture.ts for
 * the LinkedIn authwall caveat.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { captureScreenshot } from "./_lib/capture";

export const config = { maxDuration: 30 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
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
