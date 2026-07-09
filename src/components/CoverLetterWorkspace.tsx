import React, { useState, useEffect, useRef } from "react";
import { Loader2, Bookmark } from "lucide-react";
import { createCoachingSession, type CoachingSession } from "@/ai/coachingSession";
import { documentDraftingWorkflow } from "@/ai/workflows/documentDrafting";
import { workflowsConfig } from "@/config/workflows";
import { docWrapInstruction, extractDocument, DOC_START } from "@/lib/aiDocFormat";
import { useUserProfile } from "@/context/UserProfileContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { generateId } from "@/types/userProfile";
import {
  DocumentEditor,
  DocMessage,
  DocStyle,
  StoredDocumentPayload,
  htmlToMarkdown,
} from "./DocumentEditor";
import type { CoverLetterFormData } from "./CoverLetterForm";

const BUCKET = "user-documents";

export interface SavedCoverLetterPayload {
  html: string;
  style: DocStyle;
}

interface CoverLetterWorkspaceProps {
  initialFormData?: CoverLetterFormData;
  /** Pre-loaded payload from Supabase Storage when reopening a saved cover letter. */
  initialPayload?: SavedCoverLetterPayload;
  onReset: () => void;
}

export function CoverLetterWorkspace({
  initialFormData,
  initialPayload,
  onReset,
}: CoverLetterWorkspaceProps) {
  const { profile, updateProfile } = useUserProfile();
  const { user } = useAuth();

  const autoName = [
    profile.fullName,
    "Cover Letter",
    initialFormData?.companyName,
    initialFormData?.jobTitle,
  ]
    .filter(Boolean)
    .join(" - ");

  const buildLetterheadHtml = (): string => {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const contacts = [profile.email, profile.phone, profile.linkedin]
      .filter(Boolean)
      .map(esc)
      .join(" &nbsp;·&nbsp; ");
    const company = esc(initialFormData?.companyName ?? "");
    const role = esc(initialFormData?.jobTitle ?? "");
    const accentColor = "#D97757"; // terracotta — matches default; template CSS overrides via h1 color

    return `
<div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:10px;border-bottom:2px solid ${accentColor};margin-bottom:16px;">
  <div>
    <div style="font-size:18pt;font-weight:700;line-height:1.2;margin:0;">${esc(profile.fullName ?? "")}</div>
    ${contacts ? `<div style="font-size:9pt;color:#666;margin-top:3px;line-height:1.4;">${contacts}</div>` : ""}
  </div>
  <div style="text-align:right;font-size:9pt;color:#666;line-height:1.6;">
    <div>${date}</div>
    ${company ? `<div style="font-weight:600;color:#333;">${company}</div>` : ""}
    ${role ? `<div>${role}</div>` : ""}
  </div>
</div>`.trim();
  };

  // content is markdown used for AI context; initialPayload.html drives initial display
  const [content, setContent] = useState(() =>
    initialPayload ? htmlToMarkdown(initialPayload.html) : "",
  );
  const [isGenerating, setIsGenerating] = useState(!initialPayload);
  const [chatInstance, setChatInstance] = useState<CoachingSession | null>(null);
  // Cancels an in-flight initial-generation stream (real AbortController, mirrors GlobalChatPanel).
  const genAbortRef = useRef<AbortController | null>(null);
  const [chatMessages, setChatMessages] = useState<DocMessage[]>(() =>
    initialPayload ? [{ role: "model", text: htmlToMarkdown(initialPayload.html) }] : [],
  );

  // Captured from DocumentEditor's onSave callback — holds the live HTML + style
  const pendingSaveRef = useRef<{ html: string; style: DocStyle } | null>(null);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState(autoName);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const config = workflowsConfig["cover_letter"];
    const systemPrompt = config.systemInstruction + docWrapInstruction("cover letter");

    const session = createCoachingSession(systemPrompt, documentDraftingWorkflow);
    setChatInstance(session);

    if (initialPayload) {
      setIsGenerating(false);
      return;
    }
    if (!initialFormData) {
      setIsGenerating(false);
      return;
    }

    let mounted = true;
    (async () => {
      const prompt = config.generatePrompt(initialFormData as Record<string, any>);
      setChatMessages([
        { role: "user", text: "Please write my cover letter based on my details." },
        { role: "model", text: "" },
      ]);
      const controller = new AbortController();
      genAbortRef.current = controller;
      try {
        await session.send(
          prompt as string,
          (fullText) => {
            setChatMessages((prev) => {
              const m = [...prev];
              m[m.length - 1] = { role: "model", text: fullText };
              return m;
            });
            const body =
              extractDocument(fullText) ??
              (fullText.trim().length > 100 &&
              !fullText.includes(DOC_START) &&
              !fullText.includes("```")
                ? fullText.trim()
                : "");
            if (body) setContent(body);
          },
          controller.signal,
        );
      } catch (err) {
        // A user-initiated stop leaves the partial letter in place, no error.
        if (!controller.signal.aborted) console.error("Cover letter generation failed:", err);
      } finally {
        if (mounted) setIsGenerating(false);
        genAbortRef.current = null;
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called by DocumentEditor's Save button — captures live HTML + style before showing dialog
  const handleEditorSave = (_content: string, _title: string, html: string, style: DocStyle) => {
    pendingSaveRef.current = { html, style };
    setShowSaveDialog(true);
  };

  const handleSave = async () => {
    if (!user || !pendingSaveRef.current) return;
    const { html, style } = pendingSaveRef.current;
    const company = initialFormData?.companyName || "Unknown Company";
    const jobTitle = initialFormData?.jobTitle || "Unknown Role";
    const name =
      saveName.trim() ||
      autoName ||
      `Cover Letter – ${company} – ${new Date().toLocaleDateString()}`;
    const id = generateId();
    const storagePath = `${user.id}/cover-letters/${id}.json`;

    setIsSaving(true);
    try {
      // Store HTML + style as a JSON payload — preserves full formatting
      const payload: StoredDocumentPayload = { version: 1, html, style };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, blob, { upsert: true, contentType: "application/json" });

      if (uploadError) throw uploadError;

      const existing = profile.savedCoverLetters ?? [];
      await updateProfile({
        savedCoverLetters: [
          ...existing,
          { id, name, storagePath, jobTitle, company, createdAt: new Date().toISOString() },
        ],
      });
      setShowSaveDialog(false);
      setSaveName("");
    } catch (err) {
      console.error("Failed to save cover letter:", err);
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
        onStopGenerating={() => genAbortRef.current?.abort()}
        title="Cover Letter"
        aiChat={chatInstance}
        aiMessages={chatMessages}
        aiPlaceholder="Ask AI to adjust tone, shorten, strengthen a paragraph, or rewrite the opening…"
        exportFileName="cover-letter"
        onClose={onReset}
        onSave={handleEditorSave}
        rawHtml={initialPayload?.html}
        initialStyle={
          initialPayload?.style ??
          (initialFormData?.templateId ? { templateId: initialFormData.templateId } : undefined)
        }
        headerHtml={initialPayload ? undefined : buildLetterheadHtml()}
      />

      {showSaveDialog && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display text-lg font-semibold mb-1" style={{ color: "#202124" }}>
              Save cover letter
            </div>
            <p className="text-xs mb-4" style={{ color: "#5f6368" }}>
              Give this version a name (e.g. "Stripe — Senior Engineer").
            </p>
            <input
              autoFocus
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              placeholder={
                autoName ||
                `Cover Letter – ${initialFormData?.companyName || "Company"} – ${new Date().toLocaleDateString()}`
              }
              className="w-full outline-none mb-4"
              style={{
                height: 44,
                padding: "0 14px",
                background: "#f8f9fa",
                border: "1px solid #dadce0",
                borderRadius: 8,
                fontSize: 14,
                color: "#202124",
                fontFamily: "inherit",
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                style={{
                  height: 40,
                  padding: "0 16px",
                  background: "transparent",
                  border: "1px solid #dadce0",
                  borderRadius: 8,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  color: "#5f6368",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  height: 40,
                  padding: "0 20px",
                  background: "#1a73e8",
                  border: "none",
                  borderRadius: 8,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: isSaving ? "not-allowed" : "pointer",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3.5 h-3.5" /> Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
