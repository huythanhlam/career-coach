import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Map Claude model names (sent by the frontend) to Gemini equivalents
function toGeminiModel(model: string): string {
  if (model.includes("sonnet")) return "gemini-1.5-pro";
  if (model.includes("haiku")) return "gemini-2.0-flash";
  // Already a Gemini model name (e.g. "gemini-1.5-pro")
  return model;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, systemInstruction, model } = await req.json();

    const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });

    const response = await ai.models.generateContent({
      model: toGeminiModel(model ?? "claude-haiku-4-5-20251001"),
      contents: prompt ?? "",
      config: {
        systemInstruction: systemInstruction || undefined,
        maxOutputTokens: 8096,
      },
    });

    return new Response(JSON.stringify({ text: response.text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
