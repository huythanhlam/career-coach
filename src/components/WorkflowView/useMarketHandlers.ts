import { useState } from "react";
import {
  createTechCoachChat, sendMessageStream,
} from "@/services/geminiService";
import { MarketCompData, marketToMarkdown } from "@/components/MarketCompensationViz";
import { marketCacheKey, getCachedMarketData, putCachedMarketData, getStaleRow } from "@/services/marketDataCache";
import { enrichWithBls } from "@/services/blsService";
import { useSavedAnalyses } from "@/hooks/useSavedAnalyses";
import { workflowsConfig } from "@/config/workflows";
import { WorkflowId } from "@/components/Sidebar";

export function useMarketHandlers(
  workflowId: WorkflowId,
  formData: Record<string, any>,
  setMainDocumentText: (text: string) => void,
) {
  const config = workflowsConfig[workflowId];
  const [marketData, setMarketData] = useState<MarketCompData | null>(null);
  const [marketCachedAt, setMarketCachedAt] = useState<string | null>(null);
  const [isGeneratingMarketData, setIsGeneratingMarketData] = useState(false);
  const [marketSaveState, setMarketSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [marketCopied, setMarketCopied] = useState(false);
  const { saveAnalysis: persistMarketAnalysis } = useSavedAnalyses();

  const handleSaveMarket = async () => {
    if (!marketData || marketSaveState === "saving") return;
    setMarketSaveState("saving");
    try {
      await persistMarketAnalysis({
        jobInput: [formData.role, formData.location, formData.secondaryLocation].filter(Boolean).join(" · "),
        yoe: formData.yoe ?? "",
        level: "",
        marketData,
        companyIntel: null,
        resumeFit: null,
        interviewStrategy: null,
        resumeFileName: null,
      });
      setMarketSaveState("saved");
    } catch (err) {
      console.error(err);
      setMarketSaveState("idle");
    }
  };

  const handleCopyMarket = async () => {
    if (!marketData) return;
    try {
      await navigator.clipboard.writeText(marketToMarkdown(marketData));
      setMarketCopied(true);
      setTimeout(() => setMarketCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const tryParseMarketData = (text: string): MarketCompData | null => {
    try {
      const match = text.match(/```json\s*([\s\S]*?)\s*(?:```|$)/);
      if (match?.[1]) {
        const parsed = JSON.parse(match[1]);
        if (parsed.locations && Array.isArray(parsed.locations)) return parsed;
      }
    } catch { /* ignore */ }
    return null;
  };

  const runMarketAnalysis = async (forceRefresh = false) => {
    if (isGeneratingMarketData) return;
    setIsGeneratingMarketData(true);
    setMarketSaveState("idle");
    const parts = {
      role: formData.role ?? "",
      location: formData.location ?? "",
      secondaryLocation: formData.secondaryLocation,
      yoe: formData.yoe ?? "",
    };
    const key = marketCacheKey(parts);
    try {
      if (!forceRefresh) {
        const cached = await getCachedMarketData(key);
        if (cached) {
          setMarketData(cached.data);
          setMarketCachedAt(cached.cachedAt);
          return;
        }
      }
      const prompt = config.generatePrompt(formData);
      const chat = createTechCoachChat(config.systemInstruction, config.enableSearch);
      let full = "";
      await sendMessageStream(chat, prompt as string, chunk => { full += chunk; });
      const parsed = tryParseMarketData(full);
      if (parsed) {
        const prior = forceRefresh ? undefined : (await getStaleRow(key))?.locations;
        const enriched = await enrichWithBls(parsed, parts.role, prior);
        setMarketData(enriched);
        setMarketCachedAt(new Date().toISOString());
        void putCachedMarketData(key, parts, enriched);
      } else {
        setMarketData(null);
        setMarketCachedAt(null);
        setMainDocumentText(full);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingMarketData(false);
    }
  };

  return {
    marketData,
    marketCachedAt,
    isGeneratingMarketData,
    marketSaveState,
    marketCopied,
    setMarketData,
    setMarketCachedAt,
    setMarketSaveState,
    handleSaveMarket,
    handleCopyMarket,
    runMarketAnalysis,
  };
}
