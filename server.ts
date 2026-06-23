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

// --- Text-to-speech proxy (optional neural TTS backend) ---
// Gives the interviewer a human-sounding voice. Two backends, in priority order:
//   1. Hugging Face Inference — set HF_API_TOKEN + HF_TTS_MODEL (e.g.
//      "hexgrad/Kokoro-82M", "facebook/mms-tts-eng", "suno/bark-small"). No GPU
//      needed; HF hosts the model. This is the easiest path.
//   2. A custom HTTP TTS server you run (VibeVoice/ElevenLabs/etc.) — set
//      TTS_API_URL (+ optional TTS_API_KEY, TTS_VOICE); it must accept
//      { text, voice } and return audio bytes.
// Keeps any token server-side and sidesteps browser CORS. If neither is set,
// returns 501 and the frontend falls back to the browser's speech synthesis.
app.post('/api/tts', async (req, res) => {
  const { text, voice } = req.body as { text?: string; voice?: string };
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Missing text' });
    return;
  }
  if (text.length > 8000) {
    res.status(400).json({ error: 'Text too long' });
    return;
  }

  const hfToken = process.env.HF_API_TOKEN;
  const hfModel = process.env.HF_TTS_MODEL;
  const customUrl = process.env.TTS_API_URL;
  const useHf = !!(hfToken && hfModel);
  if (!useHf && !customUrl) {
    res.status(501).json({ error: 'TTS backend not configured' });
    return;
  }

  try {
    const upstream = useHf
      ? await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
            Accept: 'audio/wav',
          },
          // wait_for_model:false → if the model is cold, HF returns 503 quickly
          // and we fall back to the browser voice rather than blocking the turn.
          body: JSON.stringify({ inputs: text, options: { wait_for_model: false } }),
        })
      : await fetch(customUrl as string, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.TTS_API_KEY ? { Authorization: `Bearer ${process.env.TTS_API_KEY}` } : {}),
          },
          body: JSON.stringify({ text, voice: voice ?? process.env.TTS_VOICE }),
        });

    // 503 = HF model still loading. Transient: let the client retry next turn.
    if (upstream.status === 503) {
      console.warn('[TTS] model loading (503) — falling back to browser voice this turn');
      res.status(503).json({ error: 'TTS model is warming up' });
      return;
    }
    const contentType = upstream.headers.get('content-type') ?? 'audio/wav';
    // HF reports errors as JSON (sometimes with HTTP 200), never as audio.
    if (!upstream.ok || contentType.includes('application/json')) {
      const detail = await upstream.text().catch(() => '');
      console.error('[TTS] backend error', upstream.status, detail.slice(0, 200));
      res.status(502).json({ error: 'TTS backend error' });
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.send(buf);
  } catch (err: any) {
    console.error('[TTS] proxy failed:', err?.message);
    res.status(502).json({ error: 'TTS proxy failed' });
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

// --- Stock price history proxy (dev parity for the stock-history Edge Fn) ---
// Fetches Yahoo Finance's keyless v8 chart JSON server-side (no CORS) so the
// Research Company stock chart works in local dev without deploying the Edge Fn.

// Allowlisted chart windows → Yahoo (range, interval). User input only ever
// selects a key, never reaches the URL, so the upstream URL stays fixed-shape.
const STOCK_RANGE_MAP: Record<string, { range: string; interval: string; intraday: boolean }> = {
  '1D': { range: '1d', interval: '5m', intraday: true },
  '1W': { range: '5d', interval: '30m', intraday: true },
  '1M': { range: '1mo', interval: '1d', intraday: false },
  '3M': { range: '3mo', interval: '1d', intraday: false },
  '6M': { range: '6mo', interval: '1d', intraday: false },
  '1Y': { range: '1y', interval: '1wk', intraday: false },
  '5Y': { range: '5y', interval: '1mo', intraday: false },
  MAX: { range: 'max', interval: '1mo', intraday: false },
};
const STOCK_MAX_POINTS = 400; // intraday windows can carry a few hundred bars

app.post('/api/stock-history', async (req, res) => {
  const { ticker, range } = req.body as { ticker?: string; range?: string };
  if (!ticker || typeof ticker !== 'string' || !/^[A-Za-z][A-Za-z.\-]{0,9}$/.test(ticker)) {
    res.status(400).json({ error: 'Invalid ticker' });
    return;
  }
  const win = STOCK_RANGE_MAP[range ?? '1Y'] ?? STOCK_RANGE_MAP['1Y'];
  const symbol = ticker.trim().toUpperCase();
  const yahooSymbol = symbol.replace(/\./g, '-'); // BRK.B → BRK-B
  const path = `/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${win.range}&interval=${win.interval}`;

  try {
    // Host is hardcoded + symbol is validated + range/interval are allowlisted,
    // so plain fetch (with the browser UA Yahoo requires) is safe here. query1
    // rate-limits readily when several windows are switched in quick succession,
    // so fall back to the query2 mirror before giving up.
    let response: Response | null = null;
    for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
      const r = await fetch(`https://${host}${path}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (r.ok) {
        response = r;
        break;
      }
    }
    if (!response) {
      res.status(502).json({ error: 'Fetch failed' });
      return;
    }

    const data: any = await response.json();
    const r = data?.chart?.result?.[0];
    const ts: number[] = Array.isArray(r?.timestamp) ? r.timestamp : [];
    const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? [];
    const currency: string = typeof r?.meta?.currency === 'string' ? r.meta.currency : 'USD';
    const points: { date: string; close: number }[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (typeof c === 'number' && Number.isFinite(c) && c > 0) {
        const iso = new Date(ts[i] * 1000).toISOString();
        points.push({ date: win.intraday ? iso : iso.slice(0, 10), close: Math.round(c * 100) / 100 });
      }
    }
    if (points.length < 2) {
      res.status(404).json({ error: 'No price history for this ticker' });
      return;
    }
    res.json({ ticker: symbol, currency, points: points.slice(-STOCK_MAX_POINTS) });
  } catch (error: any) {
    console.error('[stock-history] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch prices.' });
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
