import React from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  RemoveFormatting,
  Undo2,
  Redo2,
  Smile,
  Plus,
} from "lucide-react";
import {
  FONT_FAMILIES,
  FONT_SIZES,
  ColorPickerPopover,
  IconPicker,
  InsertMenu,
  InsertItem,
} from "./StylePanel";

// ─── toolbar primitives ────────────────────────────────────────────────────────

export function TbSep() {
  return (
    <div
      style={{ width: 1, height: 16, background: "var(--border)", margin: "0 3px", flexShrink: 0 }}
    />
  );
}

interface TbBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}
export function TbBtn({ label, children, active, style: extStyle, ...rest }: TbBtnProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...rest}
      style={{
        width: 26,
        height: 26,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 5,
        border: "none",
        background: active ? "var(--muted)" : "transparent",
        cursor: "pointer",
        color: active ? "var(--primary)" : "var(--foreground)",
        flexShrink: 0,
        ...extStyle,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = active ? "var(--muted)" : "transparent")
      }
    >
      {children}
    </button>
  );
}

export const selectStyle: React.CSSProperties = {
  height: 26,
  padding: "0 6px",
  borderRadius: 5,
  border: "1px solid transparent",
  background: "transparent",
  fontSize: 12,
  color: "var(--foreground)",
  fontFamily: "inherit",
  cursor: "pointer",
  outline: "none",
};

// ─── EditorToolbar component ───────────────────────────────────────────────────

export interface EditorToolbarProps {
  exec: (cmd: string, value?: string) => void;
  saveSel: () => void;
  insertHtml: (html: string) => void;
  insertItems: InsertItem[];
  currentTextColor: string;
  showTextColorPicker: boolean;
  setShowTextColorPicker: (v: boolean | ((prev: boolean) => boolean)) => void;
  applyTextColor: (color: string) => void;
  currentHighlightColor: string;
  showHighlightPicker: boolean;
  setShowHighlightPicker: (v: boolean | ((prev: boolean) => boolean)) => void;
  applyHighlightColor: (color: string) => void;
  recentColors: string[];
  showIconPicker: boolean;
  setShowIconPicker: (v: boolean | ((prev: boolean) => boolean)) => void;
  showInsertMenu: boolean;
  setShowInsertMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export const EditorToolbar = React.memo(function EditorToolbar({
  exec,
  saveSel,
  insertHtml,
  insertItems,
  currentTextColor,
  showTextColorPicker,
  setShowTextColorPicker,
  applyTextColor,
  currentHighlightColor,
  showHighlightPicker,
  setShowHighlightPicker,
  applyHighlightColor,
  recentColors,
  showIconPicker,
  setShowIconPicker,
  showInsertMenu,
  setShowInsertMenu,
}: EditorToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-0.5 px-3 shrink-0 print:hidden"
      style={{ minHeight: 38, background: "var(--card)", borderBottom: "1px solid var(--border)" }}
    >
      {/* Undo / Redo */}
      <TbBtn
        label="Undo (Ctrl+Z)"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("undo");
        }}
      >
        <Undo2 style={{ width: 13, height: 13 }} />
      </TbBtn>
      <TbBtn
        label="Redo (Ctrl+Y)"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("redo");
        }}
      >
        <Redo2 style={{ width: 13, height: 13 }} />
      </TbBtn>

      <TbSep />

      <select
        onChange={(e) => exec("formatBlock", e.target.value)}
        defaultValue="p"
        style={{ ...selectStyle, maxWidth: 110 }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        aria-label="Block format"
      >
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="blockquote">Quote</option>
        <option value="pre">Code</option>
      </select>

      <TbSep />

      <select
        defaultValue="Inter"
        onChange={(e) => exec("fontName", e.target.value)}
        style={{ ...selectStyle, maxWidth: 120 }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        aria-label="Font family"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>

      <select
        defaultValue="11"
        onChange={(e) =>
          exec("fontSize", String(Math.max(1, Math.min(7, Math.round(Number(e.target.value) / 8)))))
        }
        style={{ ...selectStyle, width: 48 }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        aria-label="Font size"
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <TbSep />

      <TbBtn
        label="Bold"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("bold");
        }}
      >
        <Bold style={{ width: 13, height: 13, strokeWidth: 2.5 }} />
      </TbBtn>
      <TbBtn
        label="Italic"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("italic");
        }}
      >
        <Italic style={{ width: 13, height: 13 }} />
      </TbBtn>
      <TbBtn
        label="Underline"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("underline");
        }}
      >
        <Underline style={{ width: 13, height: 13 }} />
      </TbBtn>
      <TbBtn
        label="Strikethrough"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("strikeThrough");
        }}
      >
        <Strikethrough style={{ width: 13, height: 13 }} />
      </TbBtn>

      <TbSep />

      {/* Text color */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          type="button"
          title="Text color"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSel();
          }}
          onClick={() => setShowTextColorPicker((v) => !v)}
          style={{
            width: 26,
            height: 26,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            borderRadius: 5,
            border: "none",
            background: showTextColorPicker ? "var(--muted)" : "transparent",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = showTextColorPicker
              ? "var(--muted)"
              : "transparent")
          }
        >
          <span
            style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}
          >
            A
          </span>
          <div style={{ width: 14, height: 3, borderRadius: 2, background: currentTextColor }} />
        </button>
        {showTextColorPicker && (
          <ColorPickerPopover
            value={currentTextColor}
            onChange={applyTextColor}
            onClose={() => setShowTextColorPicker(false)}
            recentColors={recentColors}
            label="Text Color"
          />
        )}
      </div>

      {/* Highlight color */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          type="button"
          title="Highlight color"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSel();
          }}
          onClick={() => setShowHighlightPicker((v) => !v)}
          style={{
            width: 26,
            height: 26,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            borderRadius: 5,
            border: "none",
            background: showHighlightPicker ? "var(--muted)" : "transparent",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = showHighlightPicker
              ? "var(--muted)"
              : "transparent")
          }
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <div
            style={{
              width: 14,
              height: 3,
              borderRadius: 2,
              background:
                currentHighlightColor === "transparent" ? "#ffff00" : currentHighlightColor,
            }}
          />
        </button>
        {showHighlightPicker && (
          <ColorPickerPopover
            value={currentHighlightColor}
            onChange={applyHighlightColor}
            onClose={() => setShowHighlightPicker(false)}
            recentColors={recentColors}
            label="Highlight Color"
          />
        )}
      </div>

      <TbSep />

      <TbBtn
        label="Align left"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("justifyLeft");
        }}
      >
        <AlignLeft style={{ width: 13, height: 13 }} />
      </TbBtn>
      <TbBtn
        label="Align centre"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("justifyCenter");
        }}
      >
        <AlignCenter style={{ width: 13, height: 13 }} />
      </TbBtn>
      <TbBtn
        label="Align right"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("justifyRight");
        }}
      >
        <AlignRight style={{ width: 13, height: 13 }} />
      </TbBtn>

      <TbSep />

      <TbBtn
        label="Bullet list"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("insertUnorderedList");
        }}
      >
        <List style={{ width: 13, height: 13 }} />
      </TbBtn>
      <TbBtn
        label="Numbered list"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("insertOrderedList");
        }}
      >
        <ListOrdered style={{ width: 13, height: 13 }} />
      </TbBtn>

      <TbSep />

      <TbBtn
        label="Decrease indent"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("outdent");
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="21" y1="12" x2="9" y2="12" />
          <line x1="21" y1="18" x2="3" y2="18" />
          <polyline points="7 8 3 12 7 16" />
        </svg>
      </TbBtn>
      <TbBtn
        label="Increase indent"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("indent");
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="21" y1="12" x2="15" y2="12" />
          <line x1="21" y1="18" x2="3" y2="18" />
          <polyline points="3 8 7 12 3 16" />
        </svg>
      </TbBtn>

      <TbSep />

      <TbBtn
        label="Clear formatting"
        onMouseDown={(e) => {
          e.preventDefault();
          exec("removeFormat");
        }}
      >
        <RemoveFormatting style={{ width: 13, height: 13 }} />
      </TbBtn>

      <TbSep />

      {/* Icon picker */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          type="button"
          title="Icons & Shapes"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSel();
          }}
          onClick={() => {
            setShowInsertMenu(false);
            setShowIconPicker((v) => !v);
          }}
          style={{
            height: 26,
            padding: "0 8px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            borderRadius: 5,
            border: "1px solid var(--border)",
            background: showIconPicker ? "var(--muted)" : "transparent",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--foreground)",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = showIconPicker ? "var(--muted)" : "transparent")
          }
        >
          <Smile style={{ width: 11, height: 11 }} /> Icons
        </button>
        {showIconPicker && (
          <IconPicker
            onInsert={(html) => {
              insertHtml(html);
            }}
            onClose={() => setShowIconPicker(false)}
          />
        )}
      </div>

      {/* Insert menu */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          type="button"
          title="Insert"
          onMouseDown={(e) => {
            e.preventDefault();
            saveSel();
          }}
          onClick={() => {
            setShowIconPicker(false);
            setShowInsertMenu((v) => !v);
          }}
          style={{
            height: 26,
            padding: "0 8px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            borderRadius: 5,
            border: "1px solid var(--border)",
            background: showInsertMenu ? "var(--muted)" : "transparent",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--foreground)",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--muted)")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = showInsertMenu ? "var(--muted)" : "transparent")
          }
        >
          <Plus style={{ width: 11, height: 11 }} /> Insert
        </button>
        {showInsertMenu && (
          <InsertMenu items={insertItems} onClose={() => setShowInsertMenu(false)} />
        )}
      </div>
    </div>
  );
});
