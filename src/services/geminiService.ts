import { GoogleGenAI, Chat, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export function createTechCoachChat(systemInstruction: string, enableSearch: boolean = false): Chat {
  const config: any = {
    systemInstruction,
    temperature: 0.7,
  };

  if (enableSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  return ai.chats.create({
    model: "gemini-3.1-pro-preview",
    config,
  });
}

export async function sendMessageStream(
  chat: Chat,
  message: string | any[],
  onChunk: (text: string) => void
) {
  try {
    const response = await chat.sendMessageStream({ message });
    for await (const chunk of response) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}

export async function generateWorkflowData(
  systemInstruction: string,
  prompt: string,
  fileData?: { data: string; mimeType: string } | null,
  enableSearch: boolean = false
) {
  const parts: any[] = [{ text: prompt }];
  if (fileData) {
    parts.push({
      inlineData: {
        data: fileData.data,
        mimeType: fileData.mimeType
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: parts,
    config: {
      systemInstruction,
      temperature: 0.3,
      tools: enableSearch ? [{ googleSearch: {} }] : [],
    }
  });

  return response.text;
}

export async function suggestWorkExperienceBullets(jobTitle: string, targetRole: string): Promise<string> {
  const parts = [{ text: `You are an expert career coach. Provide 3-5 high-impact example resume bullet points for a "${jobTitle}" applying for a "${targetRole}" role. Focus on transferable skills, strong action verbs, and quantify achievements. Output ONLY the bullet points, starting each with a dash (-).` }];

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: parts,
    config: {
      temperature: 0.7,
    }
  });

  return response.text || "";
}

export async function analyzeResume(
  resumeText: string,
  resumeFile: { data: string; mimeType: string } | null,
  jdText: string,
  jdUrl: string
) {
  const parts: any[] = [
    { text: "You are an expert tech career coach. Analyze the provided resume against the Target Job Description. Return a JSON object with two properties: 'resumeText' (the full resume text, improved and tailored to the JD, formatted in Markdown) and 'annotations' (an array of objects highlighting specific strengths or weaknesses in the 'resumeText'). Each annotation must have 'textToHighlight' (an exact substring from 'resumeText' to highlight), 'type' (either 'strength' or 'weakness'), and 'suggestion' (your advice or explanation)." }
  ];

  if (jdUrl) parts.push({ text: `Target Job Description URL: ${jdUrl}` });
  if (jdText) parts.push({ text: `Target Job Description Text: ${jdText}` });
  if (resumeText) parts.push({ text: `Resume Text: ${resumeText}` });
  if (resumeFile) {
    parts.push({
      inlineData: {
        data: resumeFile.data,
        mimeType: resumeFile.mimeType
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: parts,
    config: {
      temperature: 0.2,
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          resumeText: {
            type: Type.STRING,
            description: "The full, improved resume text formatted in Markdown."
          },
          annotations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                textToHighlight: {
                  type: Type.STRING,
                  description: "An EXACT substring from the resumeText to highlight."
                },
                type: {
                  type: Type.STRING,
                  enum: ["strength", "weakness"]
                },
                suggestion: {
                  type: Type.STRING,
                  description: "The feedback or suggestion for this highlighted text."
                }
              },
              required: ["textToHighlight", "type", "suggestion"]
            }
          }
        },
        required: ["resumeText", "annotations"]
      }
    }
  });

  if (!response.text) throw new Error("No response from AI");
  return JSON.parse(response.text);
}

