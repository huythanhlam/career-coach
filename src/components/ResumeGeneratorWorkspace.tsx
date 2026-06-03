/**
 * ResumeGeneratorWorkspace — thin wrapper around DocumentEditor.
 * Handles resume-specific concerns: initial AI generation from form data,
 * saved variants, and the resume-tuned AI system prompt.
 */
import React, { useState, useEffect } from "react";
import { Loader2, Bookmark } from "lucide-react";
import { createTechCoachChat, sendMessageStream } from "@/services/geminiService";
import { workflowsConfig } from "@/config/workflows";
import { useUserProfile } from "@/context/UserProfileContext";
import { generateId } from "@/types/userProfile";
import { DocumentEditor, DocMessage } from "./DocumentEditor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Chat = any;

interface ResumeGeneratorWorkspaceProps {
  initialFormData?: Record<string, any>;
  initialResumeText?: string;
  onReset: () => void;
}

export function ResumeGeneratorWorkspace({
  initialFormData,
  initialResumeText,
  onReset,
}: ResumeGeneratorWorkspaceProps) {
  const { profile, updateProfile } = useUserProfile();
  const [content, setContent] = useState(initialResumeText ?? "");
  const [isGenerating, setIsGenerating] = useState(!initialResumeText);
  const [chatInstance, setChatInstance] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<DocMessage[]>(() =>
    initialResumeText ? [{ role: "model", text: initialResumeText }] : []
  );

  // Save-variant dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const config = workflowsConfig["resume_generation"];
    const systemPrompt =
      config.systemInstruction +
      "\n\nCRITICAL INSTRUCTION: When you provide the resume, wrap it ENTIRELY in ```markdown\n[content]\n``` so the editor can parse it. Only use that block when you want to update the document.";

    const chat = createTechCoachChat(systemPrompt, config.enableSearch);
    setChatInstance(chat);

    if (initialResumeText) { setIsGenerating(false); return; }
    if (!initialFormData) { setIsGenerating(false); return; }

    let mounted = true;
    (async () => {
      const prompt = config.generatePrompt(initialFormData);
      setChatMessages([
        { role: "user", text: "Please generate my resume based on my details." },
        { role: "model", text: "" },
      ]);
      try {
        let full = "";
        await sendMessageStream(chat, prompt as string, chunk => {
          full += chunk;
          setChatMessages(prev => {
            const m = [...prev];
            m[m.length - 1] = { role: "model", text: full };
            return m;
          });
          const match = full.match(/```(?:markdown|md)?\s*([\s\S]*?)(?:```|$)/);
          if (match?.[1]) setContent(match[1].trim());
          else if (full.trim().length > 100 && !full.includes("```")) setContent(full.trim());
        });
      } catch (err) {
        console.error("Resume generation failed:", err);
      } finally {
        if (mounted) setIsGenerating(false);
      }
    })();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveVariant = async () => {
    const name = saveName.trim() || `Resume ${new Date().toLocaleDateString()}`;
    setIsSaving(true);
    try {
      const existing = profile.savedResumes ?? [];
      await updateProfile({
        savedResumes: [
          ...existing,
          { id: generateId(), name, text: content, createdAt: new Date().toISOString() },
        ],
      });
      setShowSaveDialog(false);
      setSaveName("");
    } catch (err) {
      console.error("Failed to save variant:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <DocumentEditor
        content={content}
        onChange={setContent}
        isLoading={isGenerating}
        title="Resume"
        aiChat={chatInstance}
        aiMessages={chatMessages}
        aiPlaceholder="Ask AI to improve, rewrite a section, adjust tone…"
        exportFileName="resume"
        onClose={onReset}
        onSave={() => setShowSaveDialog(true)}
      />

      {/* Save-variant dialog */}
      {showSaveDialog && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="font-display text-lg font-semibold mb-1" style={{ color: "#202124" }}>
              Save resume variant
            </div>
            <p className="text-xs mb-4" style={{ color: "#5f6368" }}>
              Give this version a name (e.g. "Google SWE Application").
            </p>
            <input
              autoFocus
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSaveVariant(); }}
              placeholder={`Resume ${new Date().toLocaleDateString()}`}
              className="w-full outline-none mb-4"
              style={{ height: 44, padding: "0 14px", background: "#f8f9fa", border: "1px solid #dadce0", borderRadius: 8, fontSize: 14, color: "#202124", fontFamily: "inherit" }}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                style={{ height: 40, padding: "0 16px", background: "transparent", border: "1px solid #dadce0", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "#5f6368" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVariant}
                disabled={isSaving}
                style={{ height: 40, padding: "0 20px", background: "#1a73e8", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: isSaving ? "not-allowed" : "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 6, opacity: isSaving ? 0.7 : 1 }}
              >
                {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Bookmark className="w-3.5 h-3.5" /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
