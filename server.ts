import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { spawn } from 'child_process';
import { captureScreenshot } from './api/_lib/capture';

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));

// --- Claude CLI gateway ---
// Pipes prompt via stdin to avoid shell arg-length limits on large prompts

function callClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['--print', '--dangerously-skip-permissions'], {
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
  const { prompt, systemInstruction } = req.body as {
    prompt?: string;
    systemInstruction?: string;
  };

  const userContent = prompt ?? '';
  const fullPrompt = systemInstruction
    ? `${systemInstruction}\n\n${userContent}`
    : userContent;

  console.log('\n--- [Claude Gateway] INCOMING REQUEST ---');
  console.log(`[Claude Gateway] Sending prompt: ${fullPrompt.length} chars`);
  console.log(`[Claude Gateway] Preview: ${fullPrompt.slice(0, 300).replace(/\n/g, '↵')}`);

  try {
    const text = await callClaude(fullPrompt);
    console.log(`[Claude Gateway] Response: ${text.length} chars`);
    console.log(`[Claude Gateway] Response preview: ${text.slice(0, 200).replace(/\n/g, '↵')}`);
    res.json({ text });
  } catch (error: any) {
    console.error('[Claude Gateway] Error:', error.message);
    res.status(500).json({ error: 'AI generation failed. Please try again.' });
  }
});

// --- URL fetch proxy (for job description links) ---

// Block requests to private/loopback addresses to prevent SSRF
function isPrivateUrl(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl);
    return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|0\.0\.0\.0|169\.254\.)/.test(hostname);
  } catch {
    return true;
  }
}

app.post('/api/fetch-url', async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }
  if (isPrivateUrl(url)) {
    res.status(400).json({ error: 'URL not allowed' });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TechCoachBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `Fetch failed: ${response.statusText}` });
      return;
    }

    const html = await response.text();
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
