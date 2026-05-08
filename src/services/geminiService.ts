import * as MockService from "./geminiService.mock";
import type { UserProfile } from "@/types/userProfile";

const GATEWAY_URL = "http://localhost:4000/api/ai/generate";

const PROFILE_EXTRACTION_SYSTEM = `You are a structured data extractor. Given career content (LinkedIn profile text or resume text), return ONLY a valid JSON object — no markdown fences, no explanation — matching this exact schema:
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "linkedin": "string (URL if present)",
  "github": "string (URL if present)",
  "portfolio": "string (URL if present)",
  "targetRole": "string (infer from most recent role or stated goal)",
  "currentRole": "string (most recent job title)",
  "yearsOfExperience": number,
  "summary": "string (2-3 sentences)",
  "workHistory": [{ "id": "string (8-char random alphanumeric)", "company": "string", "role": "string", "startDate": "string", "endDate": "string", "responsibilities": "string (all bullets as newline-separated text)", "current": boolean }],
  "education": [{ "id": "string (8-char random alphanumeric)", "university": "string", "degree": "string", "year": "string" }],
  "skills": ["array of individual skill strings"]
}
Omit fields not present in the source material (do not include null or empty strings). Generate random 8-character alphanumeric IDs for id fields.`;

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
    const raw = await generateWorkflowData(PROFILE_EXTRACTION_SYSTEM, prompt, "gemini-1.5-pro");
    const clean = raw.replace(/^```json\s*/m, "").replace(/\s*```$/m, "").trim();
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    const jsonStr = firstBrace >= 0 && lastBrace >= 0 ? clean.slice(firstBrace, lastBrace + 1) : clean;
    const parsed = JSON.parse(jsonStr) as Partial<UserProfile>;
    if (input.type === "linkedin") parsed.linkedinText = input.text;
    if (input.type === "resume") parsed.resumeText = input.text;
    return parsed;
  } catch (err) {
    console.error("parseProfileFromImport failed:", err);
    return {};
  }
}

export async function generateWorkflowData(
  systemInstruction: string,
  prompt: string,
  model: string = "gemini-1.5-flash"
) {
  console.log("🚀 TechCoach AI: Routing prompt through local gateway...");

  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction, prompt, model }),
    });

    if (!response.ok) throw new Error("Gateway unreachable");
    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("❌ Gateway Error:", error);
    return "The local Privacy Gateway is not running. Please run 'npx tsx server.ts' in your terminal.";
  }
}

export async function analyzeResume(resumeText: string, resumeFile: any, jdText: string, jdUrl: string) {
  const prompt = `Analyze this resume against the JD. Resume: ${resumeText}. JD: ${jdText || jdUrl}`;
  const systemInstruction = "Return a JSON object with 'resumeText' (Markdown) and 'annotations' array.";
  
  const response = await generateWorkflowData(systemInstruction, prompt, "gemini-1.5-pro");
  try {
    return JSON.parse(response);
  } catch (e) {
    return { resumeText: response, annotations: [] };
  }
}

export async function suggestWorkExperienceBullets(role: string, company: string, currentBullets: string) {
  const systemInstruction = "You are an expert resume writer. Generate 3-5 high-impact, metric-driven bullet points for the given role and company.";
  const prompt = `Role: ${role}\nCompany: ${company}\nCurrent content: ${currentBullets}\n\nGenerate improved bullet points using the XYZ formula (Action + Metric + Result).`;
  
  return await generateWorkflowData(systemInstruction, prompt);
}

export function createTechCoachChat(systemInstruction: string) {
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
