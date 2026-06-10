import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { spawn } from 'child_process';
import { captureScreenshot } from './api/_lib/capture';

// This Express gateway is for LOCAL DEVELOPMENT ONLY. It shells out to the
// developer's Claude CLI (on their own subscription), which must never be
// exposed publicly. Production uses the Supabase Edge Functions instead. Refuse
// to boot in a deployed environment.
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  console.error('server.ts is a local-dev gateway and must not run in production.');
  process.exit(1);
}

const app = express();
app.use(helmet());
// Dev gateway: only the local Vite app should call it.
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));

// --- Claude CLI gateway ---
// Pipes prompt via stdin to avoid shell arg-length limits on large prompts

function callClaude(prompt: string, enableSearch = false): Promise<string> {
  return new Promise((resolve, reject) => {
    // Least privilege: plain text generation needs no tools, and browsing is
    // granted only via a *scoped* allow-list (WebSearch/WebFetch) when requested —
    // never via --dangerously-skip-permissions. Searches run on the developer's
    // logged-in Claude subscription (no extra API cost locally).
    const args = ['--print'];
    if (enableSearch) args.push('--allowedTools', 'WebSearch', 'WebFetch');
    const proc = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0 || stdout.length > 0) {
        const clean = stdout
          .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '') // strip ANSI codes
          .trim();
        resolve(clean);
      } else {
        console.error('[Claude CLI] stderr:', stderr);
        reject(new Error(`claude exited with code ${code}: ${stderr.trim()}`));
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
    });

    proc.stdin.write(prompt, 'utf8');
    proc.stdin.end();
  });
}

// --- API Endpoint ---

app.post('/api/ai/generate', async (req, res) => {
  const { prompt, systemInstruction, enableSearch } = req.body as {
    prompt?: string;
    systemInstruction?: string;
    enableSearch?: boolean;
  };

  const userContent = prompt ?? '';
  const fullPrompt = systemInstruction
    ? `${systemInstruction}\n\n${userContent}`
    : userContent;

  // Generous bound (resume + JD + instructions fit comfortably) that still
  // stops a runaway client from feeding the CLI an unbounded prompt.
  if (fullPrompt.length > 200_000) {
    res.status(400).json({ error: 'Prompt too large' });
    return;
  }

  console.log('\n--- [Claude Gateway] INCOMING REQUEST ---');
  console.log(`[Claude Gateway] Sending prompt: ${fullPrompt.length} chars${enableSearch ? ' (web search enabled)' : ''}`);
  console.log(`[Claude Gateway] Preview: ${fullPrompt.slice(0, 300).replace(/\n/g, '↵')}`);

  try {
    const text = await callClaude(fullPrompt, enableSearch === true);
    console.log(`[Claude Gateway] Response: ${text.length} chars`);
    console.log(`[Claude Gateway] Response preview: ${text.slice(0, 200).replace(/\n/g, '↵')}`);
    res.json({ text, sources: [] });
  } catch (error: any) {
    console.error('[Claude Gateway] Error:', error.message);
    res.status(500).json({ error: 'AI generation failed. Please try again.' });
  }
});

// --- URL fetch proxy (for job description links) ---

// Block requests to private/loopback/metadata addresses to prevent SSRF. A
// literal-host check isn't enough: fetch follows redirects and DNS names can
// resolve to internal IPs. We reject literal private hosts, resolve the name and
// reject private IPs, follow redirects manually (re-validating each hop), and
// cap the response body size.
function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = v4.slice(1).map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      a >= 224 || // multicast (224/4) + reserved (240/4) + broadcast
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) || // benchmarking (198.18/15)
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const h = ip.toLowerCase();
  return h === '::1' || h === '::' || h.startsWith('fe80') || h.startsWith('fc') || h.startsWith('fd') ||
    (h.startsWith('::ffff:') && isPrivateIp(h.replace('::ffff:', '')));
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  const u = new URL(rawUrl);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('URL not allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error('URL not allowed');
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    if (isPrivateIp(host)) throw new Error('URL not allowed');
  } else {
    const { lookup } = await import('node:dns/promises');
    const records = await lookup(host, { all: true }).catch(() => []);
    for (const r of records) {
      if (isPrivateIp(r.address)) throw new Error('URL not allowed');
    }
  }
  return u;
}

async function safeFetchText(rawUrl: string, maxBytes = 2 * 1024 * 1024): Promise<Response> {
  let current = await assertPublicUrl(rawUrl);
  for (let hop = 0; hop <= 4; hop++) {
    const res = await fetch(current.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TechCoachBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      current = await assertPublicUrl(new URL(loc, current).toString());
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}

app.post('/api/fetch-url', async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  try {
    let response: Response;
    try {
      response = await safeFetchText(url);
    } catch (e: any) {
      const msg = e?.message === 'URL not allowed' ? 'URL not allowed' : 'Failed to fetch URL. Please try again.';
      res.status(msg === 'URL not allowed' ? 400 : 502).json({ error: msg });
      return;
    }

    if (!response.ok) {
      res.status(response.status).json({ error: `Fetch failed: ${response.statusText}` });
      return;
    }

    const html = (await response.text()).slice(0, 2 * 1024 * 1024);
    // Strip HTML tags and condense whitespace to get readable plain text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '')
      .replace(/\s{2,}/g, '\n')
      .trim()
      .slice(0, 8000);

    res.json({ text });
  } catch (error: any) {
    console.error('[fetch-url] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch URL. Please try again.' });
  }
});

// --- BLS Public Data API proxy ---
// Keeps the (free) registration key server-side and avoids browser CORS.
app.post('/api/bls', async (req, res) => {
  const { seriesIds, startyear, endyear } = req.body as {
    seriesIds?: string[];
    startyear?: string;
    endyear?: string;
  };
  // Only allow OEWS series IDs — prevents using this as a general BLS proxy.
  const VALID_BLS_SERIES = /^OEU[NSM]\d{21}$/;
  const ids = Array.isArray(seriesIds)
    ? seriesIds.filter((s) => typeof s === 'string' && VALID_BLS_SERIES.test(s)).slice(0, 50)
    : [];
  if (ids.length === 0) {
    res.status(400).json({ error: 'No valid BLS series IDs' });
    return;
  }

  const now = new Date().getFullYear();
  const payload: Record<string, unknown> = {
    seriesid: ids,
    startyear: startyear ?? String(now - 2),
    endyear: endyear ?? String(now),
  };
  if (process.env.BLS_API_KEY) payload.registrationkey = process.env.BLS_API_KEY;

  try {
    const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error('[BLS] Error:', error.message);
    res.status(502).json({ error: 'BLS request failed' });
  }
});

// --- Screenshot proxy (LinkedIn profile preview, local dev) ---
// Mirrors the Vercel api/screenshot.ts function so the feature works in dev.

app.post('/api/screenshot', async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: 'Missing url' });
    return;
  }
  try {
    const result = await captureScreenshot(url);
    res.json(result);
  } catch (error: any) {
    console.error('[screenshot] Error:', error.message);
    res.status(500).json({ error: 'Failed to capture screenshot.' });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`TechCoach AI — Claude Gateway running at http://localhost:${PORT}`);
});
