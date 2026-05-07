import express from 'express';
import cors from 'cors';
import { spawn, ChildProcessByStdio } from 'child_process';
import { Writable, Readable } from 'stream';
import readline from 'readline';

const app = express();
app.use(cors());
app.use(express.json());

// --- ACP Connection Logic ---

let geminiProcess: ChildProcessByStdio<Writable, Readable, Readable> | null = null;
let messageId = 1;
let currentSessionId: string | null = null;
const pendingRequests = new Map<number, (response: any) => void>();
const responseBuffers = new Map<string, string>(); // sessionId -> accumulated text

function startGeminiACP() {
  console.log("\x1b[35m[ACP] Starting Gemini CLI in ACP mode...\x1b[0m");
  
  geminiProcess = spawn('gemini', ['--acp', '--skip-trust'], {
    stdio: ['pipe', 'pipe', 'pipe']
  }) as ChildProcessByStdio<Writable, Readable, Readable>;

  const rl = readline.createInterface({
    input: geminiProcess.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    try {
      const msg = JSON.parse(line);
      
      // Handle Notifications (session updates / streaming chunks)
      if (msg.method === 'session/update' && msg.params) {
        const { sessionId, update } = msg.params;
        if (update.sessionUpdate === 'agent_message_chunk' && update.content?.text) {
          const currentText = responseBuffers.get(sessionId) || "";
          responseBuffers.set(sessionId, currentText + update.content.text);
        }
        return;
      }

      // Handle Responses
      if (msg.id && pendingRequests.has(msg.id)) {
        console.log(`\x1b[34m[ACP] Received Response ID:\x1b[0m`, msg.id);
        const resolve = pendingRequests.get(msg.id);
        if (resolve) {
          resolve(msg);
          pendingRequests.delete(msg.id);
        }
      }
    } catch (e) {
      console.error("[ACP] Error parsing JSON:", e, line);
    }
  });

  geminiProcess.stderr.on('data', (data) => {
    const err = data.toString();
    if (!err.includes("Warning:")) {
        console.error(`\x1b[31m[ACP CLI Error]\x1b[0m`, err);
    }
  });

  geminiProcess.on('exit', (code) => {
    console.log(`\x1b[31m[ACP] Gemini CLI exited with code ${code}. Restarting...\x1b[0m`);
    currentSessionId = null;
    setTimeout(startGeminiACP, 2000);
  });

  // 1. Handshake
  sendToGemini('initialize', {
    clientInfo: { name: 'TechCoach-Web-Proxy', version: '1.0.0' },
    protocolVersion: 1
  }).then(() => {
    // 2. Create Session
    return sendToGemini('session/new', {
      cwd: process.cwd(),
      mcpServers: []
    });
  }).then((res) => {
    if (res.result?.sessionId) {
      currentSessionId = res.result.sessionId;
      console.log(`\x1b[32m[ACP] Session Established: ${currentSessionId}\x1b[0m`);
    } else {
      console.error("[ACP] Failed to create session:", res.error);
    }
  });
}

function sendToGemini(method: string, params = {}): Promise<any> {
  return new Promise((resolve) => {
    const id = messageId++;
    const request = { jsonrpc: '2.0', id, method, params };
    
    pendingRequests.set(id, resolve);
    
    if (geminiProcess && geminiProcess.stdin) {
      geminiProcess.stdin.write(JSON.stringify(request) + '\n');
    } else {
      resolve({ error: { message: "CLI Process Unavailable" } });
    }
  });
}

// Start the process
startGeminiACP();

// --- API Endpoints ---

app.post('/api/ai/generate', async (req, res) => {
  const { prompt, systemInstruction } = req.body;

  if (!currentSessionId) {
    return res.status(503).json({ error: "CLI Session not ready. Please try again in a few seconds." });
  }

  console.log("\n\x1b[35m--- [ACP PROXY] INCOMING PROMPT ---\x1b[0m");
  
  try {
    const fullPrompt = systemInstruction 
      ? `System Instruction: ${systemInstruction}\n\nUser Message: ${prompt}`
      : prompt;

    // Reset buffer for this session before prompting
    responseBuffers.set(currentSessionId, "");

    const acpResponse = await sendToGemini('session/prompt', { 
        sessionId: currentSessionId,
        prompt: [{ type: 'text', text: fullPrompt }]
    });
    
    if (acpResponse.result) {
      const finalResult = responseBuffers.get(currentSessionId) || "";
      res.json({ text: finalResult });
    } else if (acpResponse.error) {
      res.status(500).json({ error: acpResponse.error.message });
    } else {
      res.status(500).json({ error: "Unknown ACP error" });
    }
  } catch (error: any) {
    console.error("\x1b[31mProxy Error:\x1b[0m", error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`\x1b[35mTechCoach AI ACP Proxy running at http://localhost:${PORT}\x1b[0m`);
});
