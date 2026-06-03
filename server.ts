import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
    res.status(500).json({ error: error.message });
  }
});

// --- URL fetch proxy (for job description links) ---

app.post('/api/fetch-url', async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: 'Invalid URL' });
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
    res.status(500).json({ error: error.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`TechCoach AI — Claude Gateway running at http://localhost:${PORT}`);
});
