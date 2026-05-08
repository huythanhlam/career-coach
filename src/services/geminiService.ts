const GATEWAY_URL = "http://localhost:4000/api/ai/generate";

export interface Improvement {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'impact' | 'clarity' | 'grammar' | 'keywords' | 'formatting';
  checklistLabel: string;
  description: string;
  originalText: string;
  suggestedText: string;
}

export interface ResumeAnalysisResult {
  resumeText: string;
  overallScore: number | null;
  summary: string;
  improvements: Improvement[];
}

async function postToGateway(body: object): Promise<string> {
  console.log("🚀 Sending to gateway:", GATEWAY_URL);
  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("Gateway unreachable");
    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("❌ Gateway Error:", error);
    return "The local Privacy Gateway is not running. Please run 'npx tsx server.ts' in your terminal.";
  }
}

export async function generateWorkflowData(
  systemInstruction: string,
  prompt: string,
  model: string = "claude-haiku-4-5-20251001"
) {
  return postToGateway({ systemInstruction, prompt, model });
}

function parseResumeAnalysisResponse(raw: string) {
  // 1. Direct parse (ideal — model returned clean JSON)
  try { return JSON.parse(raw.trim()); } catch {}

  // 2. Strip markdown code fences then parse
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch {}

  // 3. Extract the first complete {...} block (handles text before/after the JSON)
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }

  throw new Error("Could not parse JSON from response");
}

const buildResumeAnalysisPrompt = (resumeText: string, jd: string): string => `
Analyze the resume below and return ONLY a raw JSON object — no markdown fences, no explanation.

Required JSON shape:
{
  "resumeText": "<full resume as clean Markdown, preserving all content>",
  "overallScore": <integer 0-100>,
  "summary": "<2-3 sentence assessment of key strengths and gaps>",
  "improvements": [
    {
      "id": "<unique string like '1', '2', ...>",
      "priority": "high" | "medium" | "low",
      "category": "impact" | "clarity" | "grammar" | "keywords" | "formatting",
      "checklistLabel": "<short imperative label, max 8 words, e.g. Quantify impact in Work Experience>",
      "description": "<1-2 sentences explaining what to fix and why>",
      "originalText": "<verbatim substring from resumeText — must match exactly, character-for-character>",
      "suggestedText": "<improved replacement text>"
    }
  ]
}

Rules:
- Produce 8-15 improvements
- originalText must be copied verbatim from resumeText — never paraphrase or abbreviate
- Do not include the candidate's name or contact info in originalText
- impact: flag vague duties (Responsible for, Helped with) and missing metrics; use XYZ formula (Action + Metric + Result)
- clarity: flag passive voice, sentences over 25 words, jargon
- grammar: flag tense inconsistency, punctuation errors
- keywords: flag JD keywords missing from resume (high priority)
- formatting: flag inconsistent dates, missing section headers
${jd ? `\nTarget Job Description:\n${jd}` : ''}

Resume:
${resumeText}
`.trim();

export async function analyzeResume(
  resumeText: string,
  jdText: string,
  jdUrl: string
): Promise<ResumeAnalysisResult> {
  const jd = jdText || jdUrl;
  const prompt = buildResumeAnalysisPrompt(resumeText, jd);
  const response = await generateWorkflowData('', prompt, 'claude-sonnet-4-6');

  try {
    const parsed = parseResumeAnalysisResponse(response);
    return {
      resumeText: parsed.resumeText ?? resumeText,
      overallScore: parsed.overallScore ?? null,
      summary: parsed.summary ?? '',
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    };
  } catch (e) {
    console.error('Failed to parse resume analysis JSON. Raw response preview:', response.slice(0, 500));
    return { resumeText, overallScore: null, summary: '', improvements: [] };
  }
}

export async function rewriteResumeSelection(selectedText: string, instruction: string, fullResumeText: string) {
  const systemInstruction = `You are an elite resume writer. The user has selected a specific passage from their resume and wants it improved.
Return ONLY the rewritten text — no explanation, no preamble, no quotes. Preserve markdown formatting (bold, bullets, etc.) from the original. The rewrite must be a drop-in replacement for the selected text.`;
  const prompt = `Full resume context:\n${fullResumeText}\n\n---\nSelected text to rewrite:\n${selectedText}\n\nInstruction: ${instruction}`;
  return await generateWorkflowData(systemInstruction, prompt, "claude-haiku-4-5-20251001");
}

export async function suggestWorkExperienceBullets(role: string, company: string, currentBullets: string = "") {
  const systemInstruction = "You are an expert resume writer. Generate 3-5 high-impact, metric-driven bullet points for the given role and company.";
  const prompt = `Role: ${role}\nCompany: ${company}\nCurrent content: ${currentBullets}\n\nGenerate improved bullet points using the XYZ formula (Action + Metric + Result).`;
  return await generateWorkflowData(systemInstruction, prompt);
}

export function createTechCoachChat(systemInstruction: string, _enableSearch?: boolean) {
  return {
    sendMessageStream: async ({ message }: any) => {
      const response = await generateWorkflowData(systemInstruction, message);
      return [{ text: response }];
    }
  };
}

export async function sendMessageStream(chat: any, message: string, onChunk: (text: string) => void) {
  const chunks = await chat.sendMessageStream({ message });
  onChunk(chunks[0].text);
}
