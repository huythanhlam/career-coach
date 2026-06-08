/**
 * capture — full-page screenshot of the PUBLIC LinkedIn profile page (the same
 * version Google indexes/shows), captured fully logged-out.
 *
 * No user session, cookies, or persistent Chrome profile is ever used. To get
 * LinkedIn to serve the public page (instead of the bot authwall) we make the
 * headless browser look like a real human arriving from a Google search:
 *   • puppeteer-extra stealth plugin (defeats headless fingerprinting)
 *   • a real Chrome user-agent + Google referer
 *   • scroll the page to trigger lazy-loaded sections and expand "see more"
 *
 * Shared by the Vercel serverless function (api/screenshot.ts) and the local
 * Express dev gateway (server.ts).
 */
import type { Browser, Page } from "puppeteer-core";

export interface ProfileRegion {
  key: string;   // banner | photo | headline | about | featured | experience | education | skills | …
  label: string; // human label from the section heading
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CaptureResult {
  image: string; // data:image/png;base64,…
  blocked: boolean;
  regions?: ProfileRegion[]; // bounding boxes (image px) of profile sections, for highlighting
  note?: string;
}

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const GOOGLE_REFERER = "https://www.google.com/";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Block requests to private/loopback addresses to prevent SSRF.
export function isPrivateUrl(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl);
    return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|0\.0\.0\.0|169\.254\.)/.test(hostname);
  } catch {
    return true;
  }
}

// Only LinkedIn profile URLs may be captured. This is the primary SSRF / open-proxy
// guard: it prevents the headless browser from being pointed at arbitrary hosts.
export function isLinkedInUrl(rawUrl: string): boolean {
  try {
    const { protocol, hostname } = new URL(rawUrl);
    return protocol === "https:" && (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com"));
  } catch {
    return false;
  }
}

const isAuthwall = (url: string, title: string): boolean =>
  /\/(authwall|login|signup|uas\/login|checkpoint)/i.test(url) ||
  /\b(sign in|sign up|join linkedin|log in)\b/i.test(title);

// puppeteer-extra + stealth, wired onto puppeteer-core (cached).
let puppeteerPromise: Promise<any> | null = null;
function getPuppeteer(): Promise<any> {
  if (!puppeteerPromise) {
    puppeteerPromise = (async () => {
      const { addExtra } = await import("puppeteer-extra");
      const core = (await import("puppeteer-core")).default;
      const StealthPlugin = (await import("puppeteer-extra-plugin-stealth")).default;
      const pp = addExtra(core as any);
      pp.use(StealthPlugin());
      return pp;
    })();
  }
  return puppeteerPromise;
}

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await getPuppeteer();

  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: [...chromium.args, "--disable-blink-features=AutomationControlled"],
      defaultViewport: { width: 1280, height: 1024 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Local dev: system-installed Chrome, no user profile / no cookies.
  return puppeteer.launch({
    channel: "chrome",
    defaultViewport: { width: 1280, height: 1024 },
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
  });
}

// Strip LinkedIn's sign-in modal and restore scrolling so the public profile
// rendered underneath is fully visible.
function dismissOverlays(): void {
  const selectors = [
    ".authwall", ".auth-wall", ".modal__overlay", ".artdeco-modal-overlay", ".artdeco-modal",
    ".contextual-sign-in-modal", ".sign-in-modal", "[data-test-modal]", ".modal-wormhole-content",
    ".google-auth-button", "#public_profile_contextual-sign-in", ".join-form", ".cta-modal",
  ];
  selectors.forEach((sel) => document.querySelectorAll(sel).forEach((el) => el.remove()));
  for (const el of [document.documentElement, document.body]) {
    el.style.overflow = "auto";
    el.style.position = "static";
    el.classList.remove("overflow-hidden");
  }
}

// Locate profile sections in the rendered page and return their bounding boxes
// (document coordinates ≈ screenshot pixels at deviceScaleFactor 1). Runs in the
// browser; must be self-contained.
function extractRegions(): { key: string; label: string; x: number; y: number; w: number; h: number }[] {
  const out: { key: string; label: string; x: number; y: number; w: number; h: number }[] = [];
  const add = (key: string, label: string, el: Element | null) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    out.push({
      key, label,
      x: Math.round(r.left + window.scrollX),
      y: Math.round(r.top + window.scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
    });
  };

  add("banner", "Background banner", document.querySelector("[class*='cover-img'], .profile-background-image__image"));

  // Profile photo: a near-square image in the top card.
  const photo = [...document.querySelectorAll("img")].find((im) => {
    const r = im.getBoundingClientRect();
    return r.width >= 80 && r.width <= 280 && Math.abs(r.width - r.height) < 12 && r.top + window.scrollY < 700;
  });
  add("photo", "Profile photo", photo ?? null);

  const h1 = document.querySelector("h1");
  add("headline", "Name & headline", h1?.closest("section") ?? h1);

  // Sections, located by their heading text.
  const sectionKeys: Record<string, string> = {
    about: "about", featured: "featured", activity: "activity", experience: "experience",
    education: "education", "licenses & certifications": "licenses", skills: "skills",
    projects: "projects", "honors & awards": "honors", languages: "languages",
    "volunteer experience": "volunteer", courses: "courses", recommendations: "recommendations",
  };
  [...document.querySelectorAll("h2, h3")].forEach((h) => {
    const t = (h as HTMLElement).innerText.trim().toLowerCase();
    for (const heading in sectionKeys) {
      if (t === heading || t.startsWith(heading)) {
        add(sectionKeys[heading], (h as HTMLElement).innerText.trim(), h.closest("section") ?? h.parentElement);
        break;
      }
    }
  });

  return out;
}

// Scroll to the bottom in steps to trigger lazy-loaded sections, then back to top.
function autoScroll(): Promise<void> {
  return new Promise<void>((resolve) => {
    let total = 0;
    const step = 500;
    const timer = setInterval(() => {
      window.scrollBy(0, step);
      total += step;
      if (total >= document.body.scrollHeight - window.innerHeight - 200 || total > 25000) {
        clearInterval(timer);
        window.scrollTo(0, 0);
        resolve();
      }
    }, 150);
  });
}

export async function captureScreenshot(url: string): Promise<CaptureResult> {
  if (!isLinkedInUrl(url)) throw new Error("Only LinkedIn profile URLs are allowed");
  if (isPrivateUrl(url)) throw new Error("URL not allowed");

  let browser: Browser | undefined;
  try {
    browser = await launchBrowser();
    const page: Page = await browser.newPage();
    // esbuild/tsx "keepNames" wraps our evaluated helpers with a __name() call
    // that doesn't exist in the browser; shim it on every document so
    // page.evaluate(...) of those functions doesn't throw.
    await page.evaluateOnNewDocument(() => {
      const g = window as unknown as { __name?: (f: unknown) => unknown };
      g.__name = g.__name || ((f: unknown) => f);
    });
    await page.setUserAgent(CHROME_UA);
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    // Warm up a guest session: hitting the homepage first sets LinkedIn's guest
    // cookies, which unlock public-profile viewing — without this, a cold request
    // is often served the authwall.
    try {
      await page.goto("https://www.linkedin.com/", { waitUntil: "domcontentloaded", timeout: 20000, referer: GOOGLE_REFERER });
    } catch { /* ignore */ }
    await sleep(1200);

    // LinkedIn serves the authwall intermittently; retry the profile load a few
    // times (cookies accumulate across attempts) until we get the public page.
    let blocked = true;
    for (let attempt = 0; attempt < 3 && blocked; attempt++) {
      if (attempt > 0) await sleep(2000);
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000, referer: GOOGLE_REFERER });
      } catch { /* capture whatever loaded */ }
      await sleep(2000);
      blocked = isAuthwall(page.url(), await page.title().catch(() => ""));
    }

    // Load the whole page (lazy sections) and clear the sign-in modal.
    await page.evaluate(autoScroll).catch(() => {});
    await page.evaluate(dismissOverlays).catch(() => {});
    await sleep(800);

    blocked = isAuthwall(page.url(), await page.title().catch(() => ""));

    const regions = blocked ? [] : await page.evaluate(extractRegions).catch(() => []);
    const shot = await page.screenshot({ fullPage: true, type: "png" });
    return {
      image: `data:image/png;base64,${Buffer.from(shot).toString("base64")}`,
      blocked,
      regions,
      note: blocked
        ? "LinkedIn returned its sign-in wall for this profile. Only fully-public profiles are viewable logged-out."
        : undefined,
    };
  } finally {
    await browser?.close().catch(() => {});
  }
}
