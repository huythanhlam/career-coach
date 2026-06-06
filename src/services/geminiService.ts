import type { UserProfile } from "@/types/userProfile";

const GATEWAY_URL =
  (import.meta.env.VITE_API_URL as string) ?? "http://localhost:4000/api/ai/generate";

const PROFILE_EXTRACTION_SYSTEM = `You are a structured data extractor. Given career content (LinkedIn profile text or resume text), return ONLY a valid JSON object — no markdown fences, no explanation — matching this exact schema:
{
  "fullName": "string",
  "email": "string",
  "phone": "string",
  "linkedin": "string (URL if present)",
  "github": "string (URL if present)",
  "portfolio": "string (URL if present)",
  "targetRole": "string (infer from most recent role or stated goal)",
  "currentRole": "string (most recent job title)",
  "yearsOfExperience": number,
  "summary": "string (2-3 sentences)",
  "workHistory": [{ "id": "string (8-char random alphanumeric)", "company": "string", "role": "string", "startDate": "string (e.g. January 2020)", "endDate": "string (e.g. March 2023, or Present if current)", "responsibilities": "string (every bullet/sentence copied VERBATIM from the source, one per line, separated by \\n — do not summarise, reword, merge, or drop any)", "current": boolean }],
  "education": [{ "id": "string (8-char random alphanumeric)", "university": "string", "degree": "string", "graduationYear": "string (e.g. May 2021)", "major": "string", "minor": "string" }],
  "skills": ["array of individual skill strings"]
}
CRITICAL ACCURACY RULES:
- Transcribe content exactly as written. Never invent, embellish, or infer responsibilities, metrics, titles, dates, or skills that are not in the source.
- Preserve every work-experience bullet verbatim — do not summarise or combine bullets.
- Keep dates exactly as the source presents them.
- Omit fields not present in the source material (do not include null or empty strings).
- The source is machine-extracted text and may be messy (multi-column layouts, broken line wraps, stray characters). Reassemble it into the correct fields using your best reading, but if a field is garbled, truncated, or you cannot confidently determine it, omit that field rather than guessing.
- Generate random 8-character alphanumeric IDs for id fields.
- Output the raw JSON object only: begin with "{" and end with "}", with no prose, comments, or code fences before or after.`;

export async function parseProfileFromImport(
  input:
    | { type: "linkedin"; text: string; url?: string }
    | { type: "resume"; text: string }
): Promise<Partial<UserProfile>> {
  let prompt: string;
  if (input.type === "linkedin") {
    prompt = `Extract structured career profile data from the following LinkedIn profile text.\n`;
    if (input.url) prompt += `LinkedIn URL: ${input.url}\n\n`;
    prompt += `LinkedIn Profile Text:\n${input.text}`;
  } else {
    prompt = `Extract structured career profile data from the following resume:\n\n${input.text}`;
  }

  try {
    const raw = await generateWorkflowData(PROFILE_EXTRACTION_SYSTEM, prompt, "gemini-3.1-flash-lite");
    const clean = raw.replace(/^```json\s*/m, "").replace(/\s*```$/m, "").trim();
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    const jsonStr = firstBrace >= 0 && lastBrace >= 0 ? clean.slice(firstBrace, lastBrace + 1) : clean;
    const parsed = JSON.parse(jsonStr) as Partial<UserProfile>;
    return parsed;
  } catch (err) {
    console.error("parseProfileFromImport failed:", err);
    return {};
  }
}

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

const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ?? "";

async function postToGateway(body: object): Promise<string> {
  console.log("🚀 Sending to gateway:", GATEWAY_URL);
  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => "(no body)");
      throw new Error(`Gateway ${response.status}: ${errBody}`);
    }
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

const RESUME_ANALYSIS_SYSTEM = `You are an expert resume reviewer and applicant-tracking-system (ATS) specialist who has screened thousands of resumes across many industries. You give honest, specific, prioritized feedback, tailored to the candidate's field and — when provided — the target job. Output only the requested JSON: no prose, no explanations, no code fences; begin with "{" and end with "}".`;

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
      "originalText": "<a SHORT exact substring (one sentence or phrase, not a whole section) copied character-for-character from resumeText>",
      "suggestedText": "<improved replacement text>"
    }
  ]
}

Rules:
- Produce 6-15 of the highest-impact improvements, prioritized — do not pad the list or repeat the same issue.
- overallScore guide: 85-100 = strong, interview-ready; 70-84 = solid with clear gaps; 50-69 = needs significant work; below 50 = major issues. Score against the target job if one is provided, otherwise against general best practice for the candidate's field.
- originalText must be a SHORT exact substring copied character-for-character from resumeText (a single sentence or phrase, not a whole paragraph or section) so the app can locate and replace it — never paraphrase, abbreviate, or add line breaks that aren't in the source.
- Do not include the candidate's name or contact info in originalText.
- impact: flag vague duties (Responsible for, Helped with) and missing metrics; suggest the XYZ pattern (Action + Metric + Result).
- clarity: flag passive voice, sentences over 25 words, jargon.
- grammar: flag tense inconsistency, punctuation errors.
- keywords: flag keywords from the target job that are missing from the resume (high priority); skip this category entirely if no job description was provided.
- formatting: flag inconsistent dates, missing section headers.
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
  const response = await generateWorkflowData(RESUME_ANALYSIS_SYSTEM, prompt, 'claude-sonnet-4-6');

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

export interface TailorSuggestion {
  id: string;
  section: string;
  type: 'rewrite' | 'add_keyword' | 'strengthen';
  originalText: string;
  suggestedText: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

const TAILOR_RESUME_SYSTEM = `You are an expert resume coach. Your job is to help candidates tailor their existing resume to a specific job description by suggesting targeted inline edits.

CRITICAL RULES:
- Never invent new companies, job titles, dates, projects, or metrics that don't exist in the resume
- Only rewrite or strengthen content that already exists
- You may suggest adding job-relevant keywords where the existing context supports them
- Focus on: keyword alignment, stronger action verbs, quantification of existing achievements, reordering emphasis
- Return ONLY a valid JSON array — no markdown fences, no explanation; begin with "[" and end with "]"`;

function parseTailorResponse(raw: string): TailorSuggestion[] {
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(clean); } catch {}
  const match = clean.match(/\[[\s\S]*\]/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  throw new Error("Could not parse tailor suggestions JSON");
}

export async function tailorResume(
  resumeText: string,
  jobDescription: string,
  jobMeta?: { jobTitle?: string; companyName?: string }
): Promise<TailorSuggestion[]> {
  const targetLine = [jobMeta?.jobTitle, jobMeta?.companyName].filter(Boolean).join(" at ");
  const prompt = `Analyze the resume below against the job description and produce 6–15 high-impact inline edit suggestions, prioritized.
${targetLine ? `\nTARGET ROLE: ${targetLine}\n` : ""}

Return a JSON array with this exact shape:
[
  {
    "id": "<unique string>",
    "section": "<section label, e.g. 'Summary', 'Work Experience – Acme Corp'>",
    "type": "rewrite" | "add_keyword" | "strengthen",
    "originalText": "<a SHORT exact substring (one sentence or phrase) copied character-for-character from the resume>",
    "suggestedText": "<drop-in replacement — same length/scope as originalText>",
    "rationale": "<one sentence naming the specific job-description requirement or keyword this edit targets>",
    "priority": "high" | "medium" | "low"
  }
]

Rules:
- originalText must be a SHORT exact substring (a single sentence or phrase, not a whole section) copied character-for-character from the resume so the app can locate it — never abbreviate or add line breaks that aren't in the source.
- Do NOT invent new roles, companies, dates, or metrics; only strengthen or reframe what already exists.
- Every suggestion's rationale must name the specific job-description requirement or keyword it targets.
- high priority = directly matches a key requirement/keyword in the job description.
- Spread suggestions across the relevant sections (e.g. Summary, Skills, Work Experience) and don't pile more than a few edits into any single section.

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}`;

  const response = await generateWorkflowData(TAILOR_RESUME_SYSTEM, prompt, 'claude-sonnet-4-6');
  try {
    return parseTailorResponse(response);
  } catch (e) {
    console.error('Failed to parse tailor suggestions. Raw preview:', response.slice(0, 500));
    return [];
  }
}

export async function rewriteResumeSelection(selectedText: string, instruction: string, fullResumeText: string) {
  const systemInstruction = `You are an elite resume writer. The user has selected a specific passage from their resume and wants it improved.
Return ONLY the rewritten text — no explanation, no preamble, no quotes. Preserve the original's markdown structure (any leading bullet marker like "- ", heading level, bold, etc.) so it drops in cleanly, and keep it close to the original length (within roughly ±15%). Improve wording, impact, and clarity, but never invent achievements, metrics, employers, titles, or dates that aren't in the original or clearly supported by the resume context — if a metric would help, leave a placeholder like "[X%]" for the user to fill in.`;
  const prompt = `Full resume context:\n${fullResumeText}\n\n---\nSelected text to rewrite:\n${selectedText}\n\nInstruction: ${instruction}`;
  return await generateWorkflowData(systemInstruction, prompt, "claude-haiku-4-5-20251001");
}

export async function suggestWorkExperienceBullets(role: string, company: string, currentBullets: string = "") {
  const systemInstruction = `You are an expert resume writer. Generate 3-5 high-impact bullet points for the given role, tailored to its field, using strong action verbs and the XYZ pattern (accomplished X, measured by Y, by doing Z). Do NOT invent specific numbers, metrics, employers, or facts the user hasn't provided — where a metric would strengthen a bullet, insert a clear placeholder like "[X%]" or "[$ amount]" for the user to fill in. Return only the bullet points.`;
  const prompt = `Role: ${role}\nCompany: ${company}\nCurrent content: ${currentBullets}\n\nGenerate improved bullet points using the XYZ pattern. Use placeholders like [X%] for any metric you don't have.`;
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
