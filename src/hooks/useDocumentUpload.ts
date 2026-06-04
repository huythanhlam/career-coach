import { useState, useCallback } from "react";
import { parseDocumentToText } from "@/services/documentParserService";

export function useDocumentUpload() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const extractText = useCallback(async (file: File): Promise<string | null> => {
    setIsExtracting(true);
    setExtractionError(null);
    try {
      const text = await parseDocumentToText(file);
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to extract text from file.";
      setExtractionError(msg);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const fileInputProps = {
    accept: ".pdf,.docx,.txt",
    onChange: () => {},
  };

  return { isExtracting, extractionError, extractText, fileInputProps };
}
