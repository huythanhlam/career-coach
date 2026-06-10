/**
 * Optional headless-render helper for review sites that serve their data to a
 * real browser but rate-limit/empty plain fetches (e.g. RepVue). This is NOT
 * bot-detection bypass: we only render sites that load normally in a browser
 * (no CAPTCHA / "prove you're human" wall) and read what they display.
 *
 * Uses puppeteer-core against a system Chrome. If no Chrome is found (or launch
 * fails) `createRenderer()` returns null and the pipeline simply skips
 * render-only sources — plain-fetch sources (Blind) still work.
 *
 * Resolution order for the Chrome binary: CHROME_PATH / PUPPETEER_EXECUTABLE_PATH
 * env, then common macOS/Linux locations.
 */
import { statSync } from "node:fs";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function resolveChrome(): string | null {
  const env = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env) return env;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  for (const p of candidates) {
    try { if (statSync(p).isFile()) return p; } catch { /* not here */ }
  }
  return null;
}

export interface Renderer {
  /** Return the fully-rendered HTML of a URL, or null on failure/challenge. */
  render: (url: string) => Promise<string | null>;
  close: () => Promise<void>;
}

/** Launch one shared headless browser, or null if Chrome isn't available. */
export async function createRenderer(): Promise<Renderer | null> {
  const executablePath = resolveChrome();
  if (!executablePath) return null;
  let puppeteer: typeof import("puppeteer-core");
  try {
    puppeteer = (await import("puppeteer-core")).default as unknown as typeof import("puppeteer-core");
  } catch {
    return null;
  }
  let browser: Awaited<ReturnType<typeof puppeteer.launch>>;
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-http2"] });
  } catch {
    return null;
  }

  const render = async (url: string): Promise<string | null> => {
    const page = await browser.newPage();
    try {
      await page.setUserAgent(BROWSER_UA);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await new Promise((r) => setTimeout(r, 2500));
      const html = await page.content();
      // Never treat a human-verification wall as content.
      if (/press & hold|just a moment|verify you are human|humans only/i.test(html)) return null;
      return html;
    } catch {
      return null;
    } finally {
      await page.close().catch(() => {});
    }
  };

  return { render, close: () => browser.close().catch(() => {}) };
}
