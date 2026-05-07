import * as MockService from "./geminiService.mock";

const GATEWAY_URL = "http://localhost:4000/api/ai/generate";

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
