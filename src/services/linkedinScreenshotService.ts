/**
 * linkedinScreenshotService — request a full-page screenshot of a LinkedIn
 * profile URL from the screenshot endpoint.
 *
 * In production this hits the Vercel Node function at /api/screenshot; in dev it
 * hits the local Express gateway on :4000. Returns null on failure so the UI can
 * show its empty state.
 */

export interface ProfileRegion {
  key: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ScreenshotResult {
  image: string; // data:image/png;base64,…
  blocked: boolean;
  regions?: ProfileRegion[];
  note?: string;
}

const SCREENSHOT_URL =
  (import.meta.env.VITE_SCREENSHOT_URL as string) ??
  (import.meta.env.DEV ? "http://localhost:4000/api/screenshot" : "/api/screenshot");

export async function captureLinkedInScreenshot(url: string): Promise<ScreenshotResult | null> {
  try {
    const response = await fetch(SCREENSHOT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<ScreenshotResult>;
    if (!data.image) return null;
    return { image: data.image, blocked: !!data.blocked, regions: data.regions ?? [], note: data.note };
  } catch (error) {
    console.error("captureLinkedInScreenshot failed:", error);
    return null;
  }
}
