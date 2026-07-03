/** DocumentEditor — rich-text editor with AI sidebar (terracotta / cream / forest design tokens). */
import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { sendMessageStream } from "@/services/geminiService";
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning";
import { extractDocument, DOC_START, DOC_END } from "@/lib/aiDocFormat";
import { markdownToHtml, htmlToMarkdown } from "@/lib/documentMarkdown";
import { StylePanelInline, InsertItem } from "./StylePanel";
import { EditorToolbar } from "./EditorToolbar";
import { AiSuggestionsPanel } from "./AiSuggestionsPanel";
import { DocumentTitleBar } from "./DocumentTitleBar";
import { DocumentBody } from "./DocumentBody";
import { replaceInHtml, revealTextInEditor, setTextHighlight } from "./textMatching";
import { useDocumentStyle } from "./useDocumentStyle";
import { exportToPDF, exportToDocx } from "./exportUtils";

export { markdownToHtml, htmlToMarkdown } from "@/lib/documentMarkdown";

// ─── types ─────────────────────────────────────────────────────────────────────

export type {
  DocMessage,
  DocStyle,
  StoredDocumentPayload,
  DocumentEditorProps,
  DocumentEditorHandle,
} from "./types";
import type { DocMessage, DocStyle, DocumentEditorProps, DocumentEditorHandle } from "./types";

let _cnt = 0;

/** Registered name for the CSS Custom Highlight used to mark the selected suggestion. */
const SUGGESTION_HIGHLIGHT = "de-suggestion-highlight";

// ─── component ─────────────────────────────────────────────────────────────────

export const DocumentEditor = forwardRef<DocumentEditorHandle, DocumentEditorProps>(
  function DocumentEditor(
    {
      content,
      onChange,
      isLoading = false,
      title: titleProp = "Untitled document",
      onTitleChange,
      aiChat,
      aiMessages: aiMessagesProp,
      aiEnabled = true,
      aiPlaceholder = "Ask AI to edit, rewrite, or improve…",
      onClose,
      onSave,
      exportFileName = "document",
      stylePanel,
      rawHtml,
      initialStyle,
      headerHtml,
      rightSidebarContent,
      initialHtml,
      rawHtmlMode = false,
      showTailorPrompt = false,
      customSidebar,
    },
    ref,
  ) {
    const [title, setTitle] = useState(titleProp);
    const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved">("");
    const [showAI, setShowAI] = useState(true);
    const [showStylePanel, setShowStylePanel] = useState(false);
    const [aiMessages, setAiMessages] = useState<DocMessage[]>(aiMessagesProp ?? []);
    const [chatInput, setChatInput] = useState("");
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [selectedContext, setSelectedContext] = useState("");
    const [showTailorJd, setShowTailorJd] = useState(false);
    const [tailorJdInput, setTailorJdInput] = useState("");

    const [docStyle, setDocStyle] = useState<DocStyle>({
      templateId: "modern-clean",
      accentColor: "#D97757",
      accentStyle: "line",
      paperBg: "#ffffff",
      ...initialStyle,
    });

    const [currentTextColor, setCurrentTextColor] = useState("#1F1B16");
    const [showTextColorPicker, setShowTextColorPicker] = useState(false);
    const [currentHighlightColor, setCurrentHighlightColor] = useState("transparent");
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);
    const [recentColors, setRecentColors] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("de_recent_colors") ?? "[]");
      } catch {
        return [];
      }
    });
    const [showInsertMenu, setShowInsertMenu] = useState(false);
    const [showIconPicker, setShowIconPicker] = useState(false);

    const editorRef = useRef<HTMLDivElement>(null);
    const scopeId = useRef(`de-${++_cnt}`);
    const sourceRef = useRef<"external" | "user">("external");
    // Tears down the current suggestion highlight (CSS Highlight entry or inline style).
    const clearHighlightRef = useRef<(() => void) | null>(null);

    const clearHighlight = useCallback(() => {
      clearHighlightRef.current?.();
      clearHighlightRef.current = null;
    }, []);

    const revealTimerRef = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      applyFix: (original, suggested) => {
        if (!editorRef.current) return;
        const newHtml = replaceInHtml(editorRef.current.innerHTML, original, suggested);
        editorRef.current.innerHTML = newHtml;
        sourceRef.current = "user";
        onChange(htmlToMarkdown(newHtml));
      },
      revealText: (text) => {
        if (editorRef.current && text) revealTextInEditor(editorRef.current, text, revealTimerRef);
      },
      setHighlight: (text) => {
        clearHighlight();
        if (editorRef.current && text)
          setTextHighlight(editorRef.current, text, SUGGESTION_HIGHLIGHT, clearHighlightRef);
      },
    }));
    const savedSelRef = useRef<Range | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Clear any pending reveal-highlight timer on unmount
    useEffect(
      () => () => {
        if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
      },
      [],
    );

    // Seed editor on mount — runs synchronously before paint so editorRef is guaranteed set
    const seededRef = useRef(false);
    useLayoutEffect(() => {
      if (!editorRef.current || seededRef.current) return;
      seededRef.current = true;
      if (rawHtml) {
        editorRef.current.innerHTML = rawHtml;
      } else if (initialHtml) {
        editorRef.current.innerHTML = initialHtml;
      } else if (content) {
        editorRef.current.innerHTML = markdownToHtml(content);
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync external content changes after mount — skip if content is empty
    // (empty content on mount would overwrite the rawHtml/initialHtml seed)
    useEffect(() => {
      if (!editorRef.current || !seededRef.current) return;
      if (sourceRef.current === "external" && content)
        editorRef.current.innerHTML = markdownToHtml(content);
    }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

    // Drop any active suggestion highlight when the editor unmounts.
    useEffect(() => clearHighlight, [clearHighlight]);

    useEffect(() => {
      if (!content) return;
      setSaveStatus("saving");
      const t = setTimeout(() => {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 2000);
      }, 800);
      return () => clearTimeout(t);
    }, [content]);

    // Don't let the tab close while a debounced autosave may not have flushed.
    useUnsavedChangesWarning(saveStatus === "saving");

    useEffect(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [aiMessages]);

    // Inject scoped CSS for the current theme / rawHtmlMode.
    useDocumentStyle({
      scopeId: scopeId.current,
      rawHtmlMode,
      templateId: docStyle.templateId,
      accentColor: docStyle.accentColor,
      accentStyle: docStyle.accentStyle,
    });

    // Capture selection
    useEffect(() => {
      const onSel = () => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const text = sel.toString().trim();
        if (text && editorRef.current?.contains(sel.anchorNode)) setSelectedContext(text);
      };
      document.addEventListener("selectionchange", onSel);
      return () => document.removeEventListener("selectionchange", onSel);
    }, []);

    const handleInput = useCallback(() => {
      if (!editorRef.current) return;
      sourceRef.current = "user";
      onChange(htmlToMarkdown(editorRef.current.innerHTML));
    }, [onChange]);

    const saveSel = useCallback(() => {
      const s = window.getSelection();
      if (s && s.rangeCount > 0) savedSelRef.current = s.getRangeAt(0).cloneRange();
    }, []);

    const restoreSel = useCallback(() => {
      if (!savedSelRef.current) return;
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(savedSelRef.current);
    }, []);

    const exec = useCallback(
      (cmd: string, value?: string) => {
        editorRef.current?.focus();
        restoreSel();
        document.execCommand(cmd, false, value);
        handleInput();
      },
      [handleInput, restoreSel],
    );

    const trackColor = useCallback((color: string) => {
      setRecentColors((prev) => {
        const next = [color, ...prev.filter((c) => c !== color)].slice(0, 8);
        try {
          localStorage.setItem("de_recent_colors", JSON.stringify(next));
        } catch {}
        return next;
      });
    }, []);

    const applyTextColor = useCallback(
      (color: string) => {
        setCurrentTextColor(color);
        trackColor(color);
        exec("foreColor", color);
        setShowTextColorPicker(false);
      },
      [exec, trackColor],
    );

    const applyHighlightColor = useCallback(
      (color: string) => {
        setCurrentHighlightColor(color);
        trackColor(color);
        exec("hiliteColor", color === "transparent" ? "transparent" : color);
        setShowHighlightPicker(false);
      },
      [exec, trackColor],
    );

    const insertHtml = useCallback(
      (html: string) => {
        editorRef.current?.focus();
        restoreSel();
        document.execCommand("insertHTML", false, html);
        handleInput();
      },
      [restoreSel, handleInput],
    );

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        insertHtml(
          `<img src="${ev.target?.result as string}" alt="${file.name}" style="max-width:100%;height:auto;border-radius:4px;display:block;margin:8px 0;" />`,
        );
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    };

    const insertItems: InsertItem[] = [
      {
        label: "Image",
        hint: "Upload a photo or picture",
        action: () => fileInputRef.current?.click(),
      },
      {
        label: "Contact Row",
        hint: "✉ 📞 🔗 📍 icon row",
        action: () =>
          insertHtml(
            `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:8px 0;font-size:12px;color:#666;"><span>✉ email@example.com</span><span>📞 (555) 000-0000</span><span>🔗 linkedin.com/in/you</span><span>📍 City, State</span></div><br>`,
          ),
      },
      {
        label: "Skill Badges",
        hint: "Row of rounded tag chips",
        action: () =>
          insertHtml(
            `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;"><span style="background:#f0e9dc;border:1px solid #e8dfce;border-radius:20px;padding:3px 12px;font-size:12px;color:#1f1b16;">Skill 1</span><span style="background:#f0e9dc;border:1px solid #e8dfce;border-radius:20px;padding:3px 12px;font-size:12px;color:#1f1b16;">Skill 2</span><span style="background:#f0e9dc;border:1px solid #e8dfce;border-radius:20px;padding:3px 12px;font-size:12px;color:#1f1b16;">Skill 3</span></div><br>`,
          ),
      },
      {
        label: "Decorative Divider",
        hint: "Ornamental separator",
        action: () =>
          insertHtml(
            `<div style="text-align:center;margin:16px 0;color:${docStyle.accentColor};letter-spacing:8px;font-size:14px;">✦ ✦ ✦</div>`,
          ),
      },
      {
        label: "Horizontal Rule",
        hint: "Plain section separator",
        action: () => exec("insertHorizontalRule"),
      },
    ];

    const handleAiSubmit = async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = chatInput.trim();
      if (!text || !aiChat || isAiGenerating) return;
      const ctx = selectedContext ? `\n\nHighlighted text:\n"""\n${selectedContext}\n"""` : "";
      const prompt = `User request: ${text}${ctx}\n\nFull document:\n\n${content}\n\nApply the request and return the COMPLETE updated document (preserve everything you are not explicitly changing), wrapped between ${DOC_START} and ${DOC_END} markers.`;
      setChatInput("");
      setSelectedContext("");
      setIsAiGenerating(true);
      setAiMessages((prev) => [
        ...prev,
        {
          role: "user",
          text: selectedContext ? `${text}\n\n*Context: "${selectedContext.slice(0, 80)}…"*` : text,
        },
        { role: "model", text: "" },
      ]);
      try {
        let full = "";
        await sendMessageStream(aiChat, prompt, (chunk) => {
          full += chunk;
          setAiMessages((prev) => {
            const m = [...prev];
            m[m.length - 1] = { role: "model", text: full };
            return m;
          });
          const body = extractDocument(full);
          if (body) {
            sourceRef.current = "external";
            onChange(body);
          }
        });
      } catch (err) {
        console.error(err);
        setAiMessages((prev) => {
          const m = [...prev];
          m[m.length - 1].text += "\n\n**Error:** Could not reach AI.";
          return m;
        });
      } finally {
        setIsAiGenerating(false);
      }
    };

    const getHtml = useCallback(
      () => editorRef.current?.innerHTML ?? markdownToHtml(content),
      [content],
    );
    const exportPDF = useCallback(
      () => exportToPDF({ title, docStyle, html: getHtml(), content }),
      [title, docStyle, getHtml, content],
    );
    const exportDocx = useCallback(
      () => exportToDocx({ docStyle, html: getHtml(), content, exportFileName, title, headerHtml }),
      [docStyle, getHtml, content, exportFileName, title, headerHtml],
    );

    // ── render ──────────────────────────────────────────────────────────────────

    return (
      <div
        className="flex flex-col h-full w-full"
        style={{
          background: "var(--background)",
          fontFamily: "var(--font-sans, Inter, sans-serif)",
        }}
      >
        {/* Title bar */}
        <DocumentTitleBar
          title={title}
          setTitle={setTitle}
          onTitleChange={onTitleChange}
          saveStatus={saveStatus}
          showStylePanel={showStylePanel}
          setShowStylePanel={setShowStylePanel}
          showAI={showAI}
          setShowAI={setShowAI}
          aiEnabled={aiEnabled}
          onSave={onSave}
          onClose={onClose}
          content={content}
          docStyle={docStyle}
          getHtml={getHtml}
          exportDocx={exportDocx}
          exportPDF={exportPDF}
        />

        {/* Formatting toolbar */}
        <EditorToolbar
          exec={exec}
          saveSel={saveSel}
          insertHtml={insertHtml}
          insertItems={insertItems}
          currentTextColor={currentTextColor}
          showTextColorPicker={showTextColorPicker}
          setShowTextColorPicker={setShowTextColorPicker}
          applyTextColor={applyTextColor}
          currentHighlightColor={currentHighlightColor}
          showHighlightPicker={showHighlightPicker}
          setShowHighlightPicker={setShowHighlightPicker}
          applyHighlightColor={applyHighlightColor}
          recentColors={recentColors}
          showIconPicker={showIconPicker}
          setShowIconPicker={setShowIconPicker}
          showInsertMenu={showInsertMenu}
          setShowInsertMenu={setShowInsertMenu}
        />

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Style panel (left) */}
          {showStylePanel && (
            <StylePanelInline
              style={docStyle}
              onChange={(patch) => setDocStyle((prev) => ({ ...prev, ...patch }))}
              extraPanel={stylePanel}
              onClose={() => setShowStylePanel(false)}
            />
          )}

          {/* Document canvas */}
          <DocumentBody
            scopeId={scopeId.current}
            editorRef={editorRef}
            isLoading={isLoading}
            content={content}
            rawHtmlMode={rawHtmlMode}
            headerHtml={headerHtml}
            paperBg={docStyle.paperBg}
            handleInput={handleInput}
            saveSel={saveSel}
          />

          {/* Analysis/custom sidebar (overrides AI chat when provided) */}
          {(rightSidebarContent ?? customSidebar) && (
            <div
              className="w-full md:w-[380px] h-[55vh] md:h-auto flex flex-col shrink-0 print:hidden overflow-hidden border-t md:border-t-0"
              style={{ background: "var(--card)", borderLeft: "1px solid var(--border)" }}
            >
              {rightSidebarContent ?? customSidebar}
            </div>
          )}

          {/* AI sidebar */}
          {!rightSidebarContent && !customSidebar && aiEnabled && showAI && (
            <AiSuggestionsPanel
              aiMessages={aiMessages}
              isAiGenerating={isAiGenerating}
              chatInput={chatInput}
              setChatInput={setChatInput}
              selectedContext={selectedContext}
              setSelectedContext={setSelectedContext}
              aiPlaceholder={aiPlaceholder}
              aiChat={aiChat}
              showTailorPrompt={showTailorPrompt}
              showTailorJd={showTailorJd}
              setShowTailorJd={setShowTailorJd}
              tailorJdInput={tailorJdInput}
              setTailorJdInput={setTailorJdInput}
              scrollRef={scrollRef}
              handleAiSubmit={handleAiSubmit}
            />
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />

        <style>{`[data-placeholder]:empty:before{content:attr(data-placeholder);color:var(--muted-foreground);opacity:0.5;pointer-events:none;}::highlight(${SUGGESTION_HIGHLIGHT}){background-color:rgba(217,119,87,0.28);color:inherit;}`}</style>
      </div>
    );
  },
);
