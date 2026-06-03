/**
 * DocumentEditor — reusable rich-text editor with AI sidebar.
 * Matches the app's Mentor Mode design tokens (terracotta / cream / forest).
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import Markdown from "react-markdown";
import {
  Loader2, Download, Save, Send, Sparkles, Bookmark,
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Minus, RemoveFormatting,
  PanelRightClose, PanelRightOpen, X, Plus, Palette,
  Undo2, Redo2, Smile,
} from "lucide-react";
import { sendMessageStream } from "@/services/geminiService";
import { TEMPLATES } from "@/components/TemplateGallery";
import { getScopedStyles, loadGoogleFont } from "@/components/ResumeRenderer";

// ─── types ─────────────────────────────────────────────────────────────────────

export interface DocMessage { role: "user" | "model"; text: string; }

export interface DocumentEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  isLoading?: boolean;
  title?: string;
  onTitleChange?: (t: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiChat?: any;
  aiMessages?: DocMessage[];
  aiEnabled?: boolean;
  aiPlaceholder?: string;
  onClose?: () => void;
  onSave?: (content: string, title: string) => void;
  exportFileName?: string;
  stylePanel?: React.ReactNode;
}

interface DocStyle {
  templateId: string;
  accentColor: string;
  accentStyle: "line" | "filled" | "minimal";
  paperBg: string;
}

// ─── template font map ─────────────────────────────────────────────────────────

const TEMPLATE_FONTS: Record<string, { heading: string; body: string }> = {
  "modern-clean":  { heading: "Inter",            body: "Inter" },
  "tech-focused":  { heading: "JetBrains Mono",   body: "Inter" },
  "executive":     { heading: "Playfair Display",  body: "Georgia" },
  "minimal":       { heading: "Inter",             body: "Inter" },
  "academic":      { heading: "Merriweather",      body: "Georgia" },
  "creative":      { heading: "Montserrat",        body: "Lato" },
  "photography":   { heading: "Lato",              body: "Lato" },
  "slate":         { heading: "Inter",             body: "Inter" },
};

const DENSITY = { lineHeight: "1.6", fontSize: "11pt" };

// ─── markdown ↔ html ──────────────────────────────────────────────────────────

function sanitizeHref(url: string): string {
  const t = url.trim();
  if (/^https?:\/\//i.test(t) || /^mailto:/i.test(t) || /^tel:/i.test(t))
    return t.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  return "#";
}

function applyInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, txt, url) => `<a href="${sanitizeHref(url)}">${txt}</a>`);
}

export function markdownToHtml(md: string): string {
  const esc = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = esc.split("\n");
  const out: string[] = [];
  let inUl = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<h3>${line.slice(4)}</h3>`); continue; }
    if (/^## /.test(line))  { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<h2>${line.slice(3)}</h2>`); continue; }
    if (/^# /.test(line))   { if (inUl) { out.push("</ul>"); inUl = false; } out.push(`<h1>${line.slice(2)}</h1>`); continue; }
    if (/^---+$/.test(line.trim())) { if (inUl) { out.push("</ul>"); inUl = false; } out.push("<hr>"); continue; }
    if (/^[-*] /.test(line)) {
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${applyInline(line.slice(2))}</li>`);
      continue;
    }
    if (inUl && line.trim() === "") { out.push("</ul>"); inUl = false; }
    if (line.trim() === "") { out.push("<br>"); }
    else { out.push(`<p>${applyInline(line)}</p>`); }
  }
  if (inUl) out.push("</ul>");
  return out.join("\n");
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const kids = Array.from(el.childNodes).map(walk).join("");
    switch (tag) {
      case "h1": return `# ${kids.trim()}\n\n`;
      case "h2": return `## ${kids.trim()}\n\n`;
      case "h3": return `### ${kids.trim()}\n\n`;
      case "strong": case "b": return `**${kids}**`;
      case "em": case "i": return `*${kids}*`;
      case "code": return "`" + kids + "`";
      case "a": return `[${kids}](${el.getAttribute("href") ?? ""})`;
      case "br": return "\n";
      case "hr": return "\n---\n\n";
      case "li": return kids.trim();
      case "ul": return Array.from(el.children).map(li => `- ${walk(li)}`).join("\n") + "\n\n";
      case "ol": return Array.from(el.children).map((li, i) => `${i + 1}. ${walk(li)}`).join("\n") + "\n\n";
      case "p": { const t = kids.trim(); return t ? `${t}\n\n` : ""; }
      case "div": case "section": case "body": return kids + (kids.endsWith("\n") ? "" : "\n");
      default: return kids;
    }
  }
  return walk(doc.body).replace(/\n{3,}/g, "\n\n").trim();
}

// ─── constants ─────────────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  "Inter", "Georgia", "Arial", "Times New Roman", "Helvetica",
  "Lato", "Montserrat", "Merriweather", "Playfair Display", "Verdana",
];
const FONT_SIZES = ["8", "9", "10", "11", "12", "14", "16", "18", "20", "24", "28", "36"];

const PRESET_COLORS = [
  "#000000", "#1a1a1a", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#ea4335", "#e67c0a", "#f9ab00", "#34a853", "#4285f4", "#9900cc", "#e91e63",
  "#d97757", "#2f6b4f", "#1d3557", "#f0e9dc", "#e8dfce", "#8b5e3c",
];

const PAPER_COLORS = [
  { name: "White",      value: "#ffffff" },
  { name: "Cream",      value: "#FBF7F1" },
  { name: "Light Gray", value: "#f5f5f5" },
  { name: "Warm Gray",  value: "#F0E9DC" },
  { name: "Soft Blue",  value: "#EFF6FF" },
  { name: "Soft Green", value: "#F0FDF4" },
  { name: "Soft Yellow",value: "#FEFCE8" },
  { name: "Charcoal",   value: "#1a1a1a" },
];

// ─── icon / shape data ─────────────────────────────────────────────────────────

const ICON_TABS = [
  {
    label: "Contact",
    items: [
      { label: "Email",    html: "✉" },
      { label: "Phone",    html: "📞" },
      { label: "Mobile",   html: "📱" },
      { label: "LinkedIn", html: "🔗" },
      { label: "Website",  html: "🌐" },
      { label: "Location", html: "📍" },
      { label: "Home",     html: "🏠" },
      { label: "Office",   html: "🏢" },
      { label: "Calendar", html: "📅" },
      { label: "GitHub",   html: "⌥" },
    ],
  },
  {
    label: "Resume",
    items: [
      { label: "Work",       html: "💼" },
      { label: "Education",  html: "🎓" },
      { label: "Skills",     html: "🛠" },
      { label: "Award",      html: "🏆" },
      { label: "Project",    html: "📌" },
      { label: "Publish",    html: "📄" },
      { label: "Language",   html: "🌍" },
      { label: "Code",       html: "💻" },
      { label: "Design",     html: "🎨" },
      { label: "Research",   html: "🔬" },
    ],
  },
  {
    label: "Symbols",
    items: [
      { label: "Bullet",     html: "•" },
      { label: "Arrow R",    html: "→" },
      { label: "Arrow L",    html: "←" },
      { label: "Arrow U",    html: "↑" },
      { label: "Chevron",    html: "›" },
      { label: "Star",       html: "★" },
      { label: "Star out",   html: "☆" },
      { label: "Check",      html: "✓" },
      { label: "Cross",      html: "✗" },
      { label: "Diamond",    html: "◆" },
      { label: "Circle",     html: "●" },
      { label: "Square",     html: "■" },
      { label: "Tri up",     html: "▲" },
      { label: "Tri dn",     html: "▼" },
      { label: "Dash em",    html: "—" },
      { label: "Ornament",   html: "✦" },
      { label: "Plus",       html: "＋" },
      { label: "Degree",     html: "°" },
      { label: "Copyright",  html: "©" },
      { label: "Trademark",  html: "™" },
    ],
  },
  {
    label: "Shapes",
    items: [
      {
        label: "Circle",
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><circle cx="10" cy="10" r="9" fill="currentColor"/></svg>`,
      },
      {
        label: "Circle out",
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      },
      {
        label: "Square",
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><rect x="1" y="1" width="18" height="18" rx="2" fill="currentColor"/></svg>`,
      },
      {
        label: "Square out",
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
      },
      {
        label: "Triangle",
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><polygon points="10,1 19,19 1,19" fill="currentColor"/></svg>`,
      },
      {
        label: "Diamond",
        html: `<svg width="20" height="20" viewBox="0 0 20 20" style="display:inline-block;vertical-align:middle;margin:0 2px"><polygon points="10,1 19,10 10,19 1,10" fill="currentColor"/></svg>`,
      },
      {
        label: "Arrow R",
        html: `<svg width="28" height="16" viewBox="0 0 28 16" style="display:inline-block;vertical-align:middle;margin:0 2px"><path d="M0 8 H22 M16 2 L24 8 L16 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      },
      {
        label: "Star",
        html: `<svg width="22" height="22" viewBox="0 0 22 22" style="display:inline-block;vertical-align:middle;margin:0 2px"><polygon points="11,1 13.8,8.4 21.5,8.5 15.4,13.4 17.6,21.1 11,16.5 4.4,21.1 6.6,13.4 0.5,8.5 8.2,8.4" fill="currentColor"/></svg>`,
      },
      {
        label: "Line H",
        html: `<svg width="60" height="10" viewBox="0 0 60 10" style="display:inline-block;vertical-align:middle;margin:0 2px"><line x1="0" y1="5" x2="60" y2="5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
      },
      {
        label: "Divider",
        html: `<svg width="120" height="16" viewBox="0 0 120 16" style="display:inline-block;vertical-align:middle;margin:0 2px"><line x1="0" y1="8" x2="48" y2="8" stroke="currentColor" stroke-width="1.5"/><circle cx="60" cy="8" r="4" fill="currentColor"/><line x1="72" y1="8" x2="120" y2="8" stroke="currentColor" stroke-width="1.5"/></svg>`,
      },
    ],
  },
];

// ─── color picker ──────────────────────────────────────────────────────────────

interface ColorPickerPopoverProps {
  value: string;
  onChange: (color: string) => void;
  onClose: () => void;
  recentColors: string[];
  label?: string;
}

function ColorPickerPopover({ value, onChange, onClose, recentColors, label }: ColorPickerPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [customHex, setCustomHex] = useState(value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const pick = (c: string) => { onChange(c); setCustomHex(c); };

  return (
    <div ref={ref} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 1000, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", boxShadow: "0 6px 24px rgba(0,0,0,0.14)", width: 228 }}>
      {label && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.07em", marginBottom: 8 }}>{label.toUpperCase()}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, marginBottom: 10 }}>
        {PRESET_COLORS.map(c => (
          <button key={c} type="button" onClick={() => pick(c)}
            style={{ width: 24, height: 24, borderRadius: 5, border: "none", background: c, cursor: "pointer", outline: value === c ? `3px solid var(--primary)` : c === "#ffffff" ? "1px solid var(--border)" : "none", outlineOffset: 2, boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #e0e0e0" : "none" }} title={c} />
        ))}
      </div>
      {recentColors.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.07em", marginBottom: 6 }}>RECENT</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
            {recentColors.map((c, i) => (
              <button key={i} type="button" onClick={() => pick(c)}
                style={{ width: 24, height: 24, borderRadius: 5, border: "1px solid var(--border)", background: c, cursor: "pointer", outline: value === c ? `3px solid var(--primary)` : "none", outlineOffset: 2 }} title={c} />
            ))}
          </div>
        </>
      )}
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.07em", marginBottom: 6 }}>CUSTOM</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: customHex, border: "1px solid var(--border)", flexShrink: 0 }} />
        <input type="color" value={customHex.match(/^#[0-9a-f]{6}$/i) ? customHex : "#000000"} onChange={e => { setCustomHex(e.target.value); onChange(e.target.value); }}
          style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer", padding: 0, flexShrink: 0 }} />
        <input type="text" value={customHex} onChange={e => { setCustomHex(e.target.value); if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value); }}
          placeholder="#000000" style={{ flex: 1, height: 28, padding: "0 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--muted)", fontSize: 11, color: "var(--foreground)", fontFamily: "monospace", outline: "none" }} />
      </div>
    </div>
  );
}

// ─── icon picker ───────────────────────────────────────────────────────────────

interface IconPickerProps {
  onInsert: (html: string) => void;
  onClose: () => void;
}

function IconPicker({ onInsert, onClose }: IconPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const tab = ICON_TABS[activeTab];

  return (
    <div ref={ref} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 1000, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,0.14)", width: 280 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 8px" }}>
        {ICON_TABS.map((t, i) => (
          <button key={i} type="button" onClick={() => setActiveTab(i)}
            style={{ padding: "9px 10px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: activeTab === i ? "var(--primary)" : "var(--muted-foreground)", borderBottom: activeTab === i ? "2px solid var(--primary)" : "2px solid transparent", marginBottom: -1, transition: "color 0.1s" }}>
            {t.label}
          </button>
        ))}
      </div>
      {/* Grid */}
      <div style={{ padding: "10px 12px 12px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
        {tab.items.map(item => (
          <button
            key={item.label}
            type="button"
            title={item.label}
            onClick={() => { onInsert(item.html); }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "8px 4px", borderRadius: 8, border: "1px solid transparent", background: "transparent", cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
          >
            <span
              style={{ fontSize: activeTab === 3 ? 12 : 18, lineHeight: 1, color: "var(--foreground)" }}
              dangerouslySetInnerHTML={{ __html: item.html }}
            />
            <span style={{ fontSize: 9, color: "var(--muted-foreground)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{item.label}</span>
          </button>
        ))}
      </div>
      <div style={{ padding: "0 12px 10px" }}>
        <p style={{ fontSize: 10, color: "var(--muted-foreground)", margin: 0 }}>Click to insert at cursor. Shapes inherit text color.</p>
      </div>
    </div>
  );
}

// ─── insert menu ───────────────────────────────────────────────────────────────

interface InsertItem { label: string; hint: string; action: () => void; }
interface InsertMenuProps { items: InsertItem[]; onClose: () => void; }

function InsertMenu({ items, onClose }: InsertMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return (
    <div ref={ref} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 1000, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "6px 0", boxShadow: "0 6px 24px rgba(0,0,0,0.14)", minWidth: 210 }}>
      {items.map(item => (
        <button key={item.label} type="button" onClick={() => { item.action(); onClose(); }}
          style={{ width: "100%", textAlign: "left", padding: "8px 14px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <div style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>{item.label}</div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{item.hint}</div>
        </button>
      ))}
    </div>
  );
}

// ─── style panel ───────────────────────────────────────────────────────────────

interface StylePanelInlineProps {
  style: DocStyle;
  onChange: (patch: Partial<DocStyle>) => void;
  extraPanel?: React.ReactNode;
  onClose: () => void;
}

function StylePanelInline({ style, onChange, extraPanel, onClose }: StylePanelInlineProps) {
  const [showAccentPicker, setShowAccentPicker] = useState(false);
  const [showPaperPicker, setShowPaperPicker] = useState(false);
  const [recentColors] = useState<string[]>([]);

  const selectTemplate = (tpl: typeof TEMPLATES[0]) => {
    onChange({ templateId: tpl.id, accentColor: tpl.accent });
  };

  return (
    <div style={{ width: 268, background: "var(--card)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
      {/* Header */}
      <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid var(--border)", background: "var(--muted)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Palette style={{ width: 14, height: 14, color: "var(--primary)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Style</span>
        </div>
        <button onClick={onClose} style={{ width: 24, height: 24, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Template */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginBottom: 10 }}>TEMPLATE</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {TEMPLATES.map(tpl => {
              const active = style.templateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => selectTemplate(tpl)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                    borderRadius: 9, border: active ? `2px solid var(--primary)` : "2px solid var(--border)",
                    background: active ? "rgba(217,119,87,0.06)" : "var(--muted)",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.12s",
                  }}
                >
                  <div style={{ width: 6, height: 32, borderRadius: 3, background: tpl.accent, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--primary)" : "var(--foreground)" }}>{tpl.name}</div>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 1, lineHeight: 1.3 }}>{tpl.description}</div>
                  </div>
                  {tpl.atsSafe && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--forest)", background: "rgba(47,107,79,0.1)", padding: "2px 5px", borderRadius: 4, letterSpacing: "0.04em", flexShrink: 0 }}>ATS</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent color */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginBottom: 8 }}>ACCENT COLOR</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {TEMPLATES.map(tpl => (
              <button key={tpl.id} type="button" onClick={() => onChange({ accentColor: tpl.accent })} title={tpl.name}
                style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: tpl.accent, cursor: "pointer", outline: style.accentColor === tpl.accent ? `3px solid ${tpl.accent}` : "2px solid transparent", outlineOffset: 2, transform: style.accentColor === tpl.accent ? "scale(1.15)" : "scale(1)", transition: "transform 0.12s, outline 0.12s" }} />
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setShowAccentPicker(v => !v)}
              style={{ height: 30, padding: "0 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--muted)", cursor: "pointer", fontFamily: "inherit", fontSize: 11, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: style.accentColor }} /> Custom color
            </button>
            {showAccentPicker && (
              <ColorPickerPopover value={style.accentColor} onChange={c => { onChange({ accentColor: c }); setShowAccentPicker(false); }} onClose={() => setShowAccentPicker(false)} recentColors={recentColors} />
            )}
          </div>
        </div>

        {/* Paper background */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginBottom: 8 }}>PAPER BACKGROUND</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
            {PAPER_COLORS.map(p => (
              <button key={p.value} type="button" onClick={() => onChange({ paperBg: p.value })} title={p.name}
                style={{ height: 34, borderRadius: 7, border: style.paperBg === p.value ? "2px solid var(--primary)" : "1px solid var(--border)", background: p.value, cursor: "pointer", boxShadow: p.value === "#ffffff" ? "inset 0 0 0 1px #e0e0e0" : "none" }} />
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setShowPaperPicker(v => !v)}
              style={{ height: 30, padding: "0 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--muted)", cursor: "pointer", fontFamily: "inherit", fontSize: 11, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: style.paperBg, border: "1px solid var(--border)" }} /> Custom color
            </button>
            {showPaperPicker && (
              <ColorPickerPopover value={style.paperBg} onChange={c => { onChange({ paperBg: c }); setShowPaperPicker(false); }} onClose={() => setShowPaperPicker(false)} recentColors={recentColors} />
            )}
          </div>
        </div>

        {/* Section dividers (accent style) */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", letterSpacing: "0.06em", marginBottom: 8 }}>SECTION DIVIDERS</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["line", "filled", "minimal"] as const).map(s => (
              <button key={s} type="button" onClick={() => onChange({ accentStyle: s })}
                style={{ flex: 1, height: 30, borderRadius: 7, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer", border: style.accentStyle === s ? "2px solid var(--primary)" : "2px solid var(--border)", background: style.accentStyle === s ? "rgba(217,119,87,0.08)" : "var(--muted)", color: style.accentStyle === s ? "var(--primary)" : "var(--muted-foreground)", textTransform: "capitalize", transition: "all 0.15s" }}>
                {s}
              </button>
            ))}
          </div>
        </div>

      </div>

      {extraPanel && <div style={{ borderTop: "1px solid var(--border)", flex: 1 }}>{extraPanel}</div>}
    </div>
  );
}

// ─── toolbar primitives ────────────────────────────────────────────────────────

function TbSep() {
  return <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 3px", flexShrink: 0 }} />;
}

interface TbBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}
function TbBtn({ label, children, active, style: extStyle, ...rest }: TbBtnProps) {
  return (
    <button type="button" title={label} aria-label={label} {...rest}
      style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 5, border: "none", background: active ? "var(--muted)" : "transparent", cursor: "pointer", color: active ? "var(--primary)" : "var(--foreground)", flexShrink: 0, ...extStyle }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
      onMouseLeave={e => (e.currentTarget.style.background = active ? "var(--muted)" : "transparent")}>
      {children}
    </button>
  );
}

const selectStyle: React.CSSProperties = {
  height: 26, padding: "0 6px", borderRadius: 5,
  border: "1px solid transparent", background: "transparent",
  fontSize: 12, color: "var(--foreground)", fontFamily: "inherit",
  cursor: "pointer", outline: "none",
};

let _cnt = 0;

// ─── component ─────────────────────────────────────────────────────────────────

export function DocumentEditor({
  content, onChange, isLoading = false,
  title: titleProp = "Untitled document", onTitleChange,
  aiChat, aiMessages: aiMessagesProp,
  aiEnabled = true, aiPlaceholder = "Ask AI to edit, rewrite, or improve…",
  onClose, onSave, exportFileName = "document", stylePanel,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(titleProp);
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved">("");
  const [showAI, setShowAI] = useState(true);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [aiMessages, setAiMessages] = useState<DocMessage[]>(aiMessagesProp ?? []);
  const [chatInput, setChatInput] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [selectedContext, setSelectedContext] = useState("");

  const [docStyle, setDocStyle] = useState<DocStyle>({
    templateId: "modern-clean",
    accentColor: "#D97757",
    accentStyle: "line",
    paperBg: "#ffffff",
  });

  const [currentTextColor, setCurrentTextColor] = useState("#1F1B16");
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [currentHighlightColor, setCurrentHighlightColor] = useState("transparent");
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("de_recent_colors") ?? "[]"); } catch { return []; }
  });
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const scopeId = useRef(`de-${++_cnt}`);
  const sourceRef = useRef<"external" | "user">("external");
  const savedSelRef = useRef<Range | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync external content
  useEffect(() => {
    if (sourceRef.current === "external" && editorRef.current)
      editorRef.current.innerHTML = markdownToHtml(content);
  }, [content]);

  useEffect(() => {
    if (!content) return;
    setSaveStatus("saving");
    const t = setTimeout(() => { setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 2000); }, 800);
    return () => clearTimeout(t);
  }, [content]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages]);

  // Inject scoped CSS from getScopedStyles
  useEffect(() => {
    const fonts = TEMPLATE_FONTS[docStyle.templateId] ?? { heading: "Inter", body: "Inter" };
    loadGoogleFont(fonts.heading);
    if (fonts.body !== fonts.heading) loadGoogleFont(fonts.body);

    const id = `${scopeId.current}-theme`;
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = getScopedStyles(
      scopeId.current, docStyle.templateId,
      docStyle.accentColor, docStyle.accentStyle,
      fonts.heading, fonts.body, DENSITY,
    );
    return () => { document.getElementById(id)?.remove(); };
  }, [docStyle.templateId, docStyle.accentColor, docStyle.accentStyle]);

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
    const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(savedSelRef.current);
  }, []);

  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus(); restoreSel();
    document.execCommand(cmd, false, value);
    handleInput();
  }, [handleInput, restoreSel]);

  const trackColor = useCallback((color: string) => {
    setRecentColors(prev => {
      const next = [color, ...prev.filter(c => c !== color)].slice(0, 8);
      try { localStorage.setItem("de_recent_colors", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const applyTextColor = useCallback((color: string) => {
    setCurrentTextColor(color); trackColor(color);
    exec("foreColor", color); setShowTextColorPicker(false);
  }, [exec, trackColor]);

  const applyHighlightColor = useCallback((color: string) => {
    setCurrentHighlightColor(color); trackColor(color);
    exec("hiliteColor", color === "transparent" ? "transparent" : color);
    setShowHighlightPicker(false);
  }, [exec, trackColor]);

  const insertHtml = useCallback((html: string) => {
    editorRef.current?.focus(); restoreSel();
    document.execCommand("insertHTML", false, html);
    handleInput();
  }, [restoreSel, handleInput]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      insertHtml(`<img src="${ev.target?.result as string}" alt="${file.name}" style="max-width:100%;height:auto;border-radius:4px;display:block;margin:8px 0;" />`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const insertItems: InsertItem[] = [
    { label: "Image", hint: "Upload a photo or picture", action: () => fileInputRef.current?.click() },
    { label: "Contact Row", hint: "✉ 📞 🔗 📍 icon row", action: () => insertHtml(`<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:8px 0;font-size:12px;color:#666;"><span>✉ email@example.com</span><span>📞 (555) 000-0000</span><span>🔗 linkedin.com/in/you</span><span>📍 City, State</span></div><br>`) },
    { label: "Skill Badges", hint: "Row of rounded tag chips", action: () => insertHtml(`<div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;"><span style="background:#f0e9dc;border:1px solid #e8dfce;border-radius:20px;padding:3px 12px;font-size:12px;color:#1f1b16;">Skill 1</span><span style="background:#f0e9dc;border:1px solid #e8dfce;border-radius:20px;padding:3px 12px;font-size:12px;color:#1f1b16;">Skill 2</span><span style="background:#f0e9dc;border:1px solid #e8dfce;border-radius:20px;padding:3px 12px;font-size:12px;color:#1f1b16;">Skill 3</span></div><br>`) },
    { label: "Decorative Divider", hint: "Ornamental separator", action: () => insertHtml(`<div style="text-align:center;margin:16px 0;color:${docStyle.accentColor};letter-spacing:8px;font-size:14px;">✦ ✦ ✦</div>`) },
    { label: "Horizontal Rule", hint: "Plain section separator", action: () => exec("insertHorizontalRule") },
  ];

  const handleAiSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = chatInput.trim();
    if (!text || !aiChat || isAiGenerating) return;
    const ctx = selectedContext ? `\n\nHighlighted text:\n"""\n${selectedContext}\n"""` : "";
    const prompt = `User request: ${text}${ctx}\n\nFull document:\n\n${content}\n\nReturn the full updated document inside a \`\`\`markdown\`\`\` block.`;
    setChatInput(""); setSelectedContext(""); setIsAiGenerating(true);
    setAiMessages(prev => [...prev,
      { role: "user", text: selectedContext ? `${text}\n\n*Context: "${selectedContext.slice(0, 80)}…"*` : text },
      { role: "model", text: "" },
    ]);
    try {
      let full = "";
      await sendMessageStream(aiChat, prompt, chunk => {
        full += chunk;
        setAiMessages(prev => { const m = [...prev]; m[m.length - 1] = { role: "model", text: full }; return m; });
        const match = full.match(/```(?:markdown|md)?\s*([\s\S]*?)(?:```|$)/);
        if (match?.[1]) { sourceRef.current = "external"; onChange(match[1].trim()); }
      });
    } catch (err) {
      console.error(err);
      setAiMessages(prev => { const m = [...prev]; m[m.length - 1].text += "\n\n**Error:** Could not reach AI."; return m; });
    } finally { setIsAiGenerating(false); }
  };

  const exportPDF = () => {
    const fonts = TEMPLATE_FONTS[docStyle.templateId] ?? { heading: "Inter", body: "Inter" };
    const win = window.open("", "_blank");
    if (!win) { window.print(); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none';">
      <title>${title}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonts.heading)}:wght@400;500;600;700&family=${encodeURIComponent(fonts.body)}:wght@400;500;700&display=swap">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:"${fonts.body}",Arial,sans-serif;font-size:11pt;line-height:1.6;color:#1a1a1a;padding:40px 50px;max-width:800px;margin:0 auto;background:${docStyle.paperBg};}
        h1,h2,h3{font-family:"${fonts.heading}",sans-serif;color:${docStyle.accentColor};}
        h1{font-size:22pt;font-weight:700;margin:0 0 8px;}
        h2{font-size:14pt;font-weight:700;margin:20px 0 6px;border-bottom:2px solid ${docStyle.accentColor}55;padding-bottom:4px;}
        h3{font-size:12pt;font-weight:600;margin:14px 0 4px;}
        p{margin-bottom:6px;}ul,ol{margin:4px 0 8px 20px;}li{margin-bottom:2px;}
        hr{border:none;border-top:1px solid ${docStyle.accentColor}44;margin:16px 0;}
        a{color:${docStyle.accentColor};}img{max-width:100%;height:auto;}
        @media print{body{padding:20px 30px;}}
      </style>
    </head><body>${editorRef.current?.innerHTML ?? markdownToHtml(content)}</body></html>`);
    win.document.close(); win.focus(); setTimeout(() => win.print(), 500);
  };

  const exportDocx = () => {
    const fonts = TEMPLATE_FONTS[docStyle.templateId] ?? { heading: "Inter", body: "Inter" };
    const src = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${title}</title><style>
  body{font-family:"${fonts.body}",Calibri,sans-serif;font-size:11pt;color:#1a1a1a;margin:1in;}
  h1,h2,h3{font-family:"${fonts.heading}",sans-serif;color:${docStyle.accentColor};}
  h1{font-size:20pt;font-weight:bold;margin-bottom:4pt;}
  h2{font-size:14pt;font-weight:bold;margin-top:14pt;margin-bottom:5pt;}
  h3{font-size:12pt;font-weight:bold;margin-bottom:3pt;}
  p{margin-bottom:5pt;line-height:1.4;}ul{margin-left:18pt;margin-bottom:6pt;}li{margin-bottom:2pt;}
  hr{border-top:1pt solid #ccc;margin:10pt 0;}img{max-width:100%;}
</style></head><body>${editorRef.current?.innerHTML ?? markdownToHtml(content)}</body></html>`;
    const blob = new Blob(["﻿", src], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${exportFileName}.doc`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full" style={{ background: "var(--background)", fontFamily: "var(--font-sans, Inter, sans-serif)" }}>

      {/* Title bar */}
      <div className="flex items-center gap-3 px-5 shrink-0 print:hidden"
        style={{ height: 54, background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(217,119,87,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
            <path d="M1 0h9l5 5v13H1V0z" fill="var(--primary)" fillOpacity=".15" />
            <path d="M10 0l5 5h-5V0z" fill="var(--primary)" fillOpacity=".3" />
            <rect x="3" y="8" width="9" height="1.2" rx=".6" fill="var(--primary)" />
            <rect x="3" y="11" width="9" height="1.2" rx=".6" fill="var(--primary)" />
            <rect x="3" y="14" width="6" height="1.2" rx=".6" fill="var(--primary)" />
          </svg>
        </div>
        <span ref={titleRef} contentEditable suppressContentEditableWarning
          onBlur={() => { const t = titleRef.current?.textContent?.trim() || "Untitled document"; setTitle(t); onTitleChange?.(t); if (titleRef.current) titleRef.current.style.background = "transparent"; }}
          onFocus={() => { if (titleRef.current) titleRef.current.style.background = "var(--muted)"; }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); titleRef.current?.blur(); } }}
          style={{ fontSize: 16, fontWeight: 500, color: "var(--foreground)", outline: "none", minWidth: 60, maxWidth: 360, cursor: "text", padding: "3px 6px", borderRadius: 6, transition: "background 0.1s" }}>
          {title}
        </span>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
          {saveStatus === "saving" && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> Saving…</span>}
          {saveStatus === "saved" && <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--forest)" }}><Save style={{ width: 11, height: 11 }} /> Saved</span>}
        </div>
        <div style={{ flex: 1 }} />
        <div className="flex items-center gap-2">
          <button onClick={() => setShowStylePanel(v => !v)} title={showStylePanel ? "Hide style" : "Style"}
            style={{ width: 32, height: 32, borderRadius: 8, background: showStylePanel ? "rgba(217,119,87,0.10)" : "transparent", border: showStylePanel ? "1px solid rgba(217,119,87,0.25)" : "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: showStylePanel ? "var(--primary)" : "var(--muted-foreground)", transition: "all 0.15s" }}>
            <Palette style={{ width: 14, height: 14 }} />
          </button>
          {onSave && (
            <button onClick={() => onSave(content, title)}
              style={{ height: 32, padding: "0 14px", background: "var(--primary)", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", gap: 5 }}>
              <Bookmark style={{ width: 13, height: 13 }} /> Save
            </button>
          )}
          <button onClick={exportDocx}
            style={{ height: 32, padding: "0 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 5 }}>
            <Download style={{ width: 13, height: 13 }} /> DOCX
          </button>
          <button onClick={exportPDF}
            style={{ height: 32, padding: "0 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer", color: "var(--foreground)", display: "flex", alignItems: "center", gap: 5 }}>
            <Download style={{ width: 13, height: 13 }} /> PDF
          </button>
          {aiEnabled && (
            <button onClick={() => setShowAI(v => !v)} title={showAI ? "Hide AI" : "Show AI"}
              style={{ width: 32, height: 32, borderRadius: 8, background: showAI ? "rgba(217,119,87,0.10)" : "transparent", border: showAI ? "1px solid rgba(217,119,87,0.25)" : "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: showAI ? "var(--primary)" : "var(--muted-foreground)", transition: "all 0.15s" }}>
              {showAI ? <PanelRightClose style={{ width: 14, height: 14 }} /> : <PanelRightOpen style={{ width: 14, height: 14 }} />}
            </button>
          )}
          {onClose && (
            <button onClick={onClose}
              style={{ height: 32, padding: "0 12px", background: "transparent", border: "none", fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer", color: "var(--muted-foreground)" }}>
              Exit
            </button>
          )}
        </div>
      </div>

      {/* Formatting toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-3 shrink-0 print:hidden"
        style={{ minHeight: 38, background: "var(--card)", borderBottom: "1px solid var(--border)" }}>

        {/* Undo / Redo */}
        <TbBtn label="Undo (Ctrl+Z)" onMouseDown={e => { e.preventDefault(); exec("undo"); }}><Undo2 style={{ width: 13, height: 13 }} /></TbBtn>
        <TbBtn label="Redo (Ctrl+Y)" onMouseDown={e => { e.preventDefault(); exec("redo"); }}><Redo2 style={{ width: 13, height: 13 }} /></TbBtn>

        <TbSep />

        <select onChange={e => exec("formatBlock", e.target.value)} defaultValue="p"
          style={{ ...selectStyle, maxWidth: 110 }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          aria-label="Block format">
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="blockquote">Quote</option>
          <option value="pre">Code</option>
        </select>

        <TbSep />

        <select defaultValue="Inter"
          onChange={e => exec("fontName", e.target.value)}
          style={{ ...selectStyle, maxWidth: 120 }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          aria-label="Font family">
          {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        <select defaultValue="11"
          onChange={e => exec("fontSize", String(Math.max(1, Math.min(7, Math.round(Number(e.target.value) / 8)))))}
          style={{ ...selectStyle, width: 48 }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          aria-label="Font size">
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <TbSep />

        <TbBtn label="Bold" onMouseDown={e => { e.preventDefault(); exec("bold"); }}><Bold style={{ width: 13, height: 13, strokeWidth: 2.5 }} /></TbBtn>
        <TbBtn label="Italic" onMouseDown={e => { e.preventDefault(); exec("italic"); }}><Italic style={{ width: 13, height: 13 }} /></TbBtn>
        <TbBtn label="Underline" onMouseDown={e => { e.preventDefault(); exec("underline"); }}><Underline style={{ width: 13, height: 13 }} /></TbBtn>
        <TbBtn label="Strikethrough" onMouseDown={e => { e.preventDefault(); exec("strikeThrough"); }}><Strikethrough style={{ width: 13, height: 13 }} /></TbBtn>

        <TbSep />

        {/* Text color */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button type="button" title="Text color"
            onMouseDown={e => { e.preventDefault(); saveSel(); }}
            onClick={() => setShowTextColorPicker(v => !v)}
            style={{ width: 26, height: 26, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, borderRadius: 5, border: "none", background: showTextColorPicker ? "var(--muted)" : "transparent", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
            onMouseLeave={e => (e.currentTarget.style.background = showTextColorPicker ? "var(--muted)" : "transparent")}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", lineHeight: 1 }}>A</span>
            <div style={{ width: 14, height: 3, borderRadius: 2, background: currentTextColor }} />
          </button>
          {showTextColorPicker && (
            <ColorPickerPopover value={currentTextColor} onChange={applyTextColor} onClose={() => setShowTextColorPicker(false)} recentColors={recentColors} label="Text Color" />
          )}
        </div>

        {/* Highlight color */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button type="button" title="Highlight color"
            onMouseDown={e => { e.preventDefault(); saveSel(); }}
            onClick={() => setShowHighlightPicker(v => !v)}
            style={{ width: 26, height: 26, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, borderRadius: 5, border: "none", background: showHighlightPicker ? "var(--muted)" : "transparent", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
            onMouseLeave={e => (e.currentTarget.style.background = showHighlightPicker ? "var(--muted)" : "transparent")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
            <div style={{ width: 14, height: 3, borderRadius: 2, background: currentHighlightColor === "transparent" ? "#ffff00" : currentHighlightColor }} />
          </button>
          {showHighlightPicker && (
            <ColorPickerPopover value={currentHighlightColor} onChange={applyHighlightColor} onClose={() => setShowHighlightPicker(false)} recentColors={recentColors} label="Highlight Color" />
          )}
        </div>

        <TbSep />

        <TbBtn label="Align left" onMouseDown={e => { e.preventDefault(); exec("justifyLeft"); }}><AlignLeft style={{ width: 13, height: 13 }} /></TbBtn>
        <TbBtn label="Align centre" onMouseDown={e => { e.preventDefault(); exec("justifyCenter"); }}><AlignCenter style={{ width: 13, height: 13 }} /></TbBtn>
        <TbBtn label="Align right" onMouseDown={e => { e.preventDefault(); exec("justifyRight"); }}><AlignRight style={{ width: 13, height: 13 }} /></TbBtn>

        <TbSep />

        <TbBtn label="Bullet list" onMouseDown={e => { e.preventDefault(); exec("insertUnorderedList"); }}><List style={{ width: 13, height: 13 }} /></TbBtn>
        <TbBtn label="Numbered list" onMouseDown={e => { e.preventDefault(); exec("insertOrderedList"); }}><ListOrdered style={{ width: 13, height: 13 }} /></TbBtn>

        <TbSep />

        <TbBtn label="Decrease indent" onMouseDown={e => { e.preventDefault(); exec("outdent"); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/><polyline points="7 8 3 12 7 16"/></svg>
        </TbBtn>
        <TbBtn label="Increase indent" onMouseDown={e => { e.preventDefault(); exec("indent"); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="15" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/><polyline points="3 8 7 12 3 16"/></svg>
        </TbBtn>

        <TbSep />

        <TbBtn label="Clear formatting" onMouseDown={e => { e.preventDefault(); exec("removeFormat"); }}><RemoveFormatting style={{ width: 13, height: 13 }} /></TbBtn>

        <TbSep />

        {/* Icon picker */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button type="button" title="Icons & Shapes"
            onMouseDown={e => { e.preventDefault(); saveSel(); }}
            onClick={() => { setShowInsertMenu(false); setShowIconPicker(v => !v); }}
            style={{ height: 26, padding: "0 8px", display: "flex", alignItems: "center", gap: 4, borderRadius: 5, border: "1px solid var(--border)", background: showIconPicker ? "var(--muted)" : "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--foreground)", fontFamily: "inherit" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
            onMouseLeave={e => (e.currentTarget.style.background = showIconPicker ? "var(--muted)" : "transparent")}>
            <Smile style={{ width: 11, height: 11 }} /> Icons
          </button>
          {showIconPicker && (
            <IconPicker
              onInsert={html => { insertHtml(html); }}
              onClose={() => setShowIconPicker(false)}
            />
          )}
        </div>

        {/* Insert menu */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button type="button" title="Insert"
            onMouseDown={e => { e.preventDefault(); saveSel(); }}
            onClick={() => { setShowIconPicker(false); setShowInsertMenu(v => !v); }}
            style={{ height: 26, padding: "0 8px", display: "flex", alignItems: "center", gap: 4, borderRadius: 5, border: "1px solid var(--border)", background: showInsertMenu ? "var(--muted)" : "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--foreground)", fontFamily: "inherit" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--muted)")}
            onMouseLeave={e => (e.currentTarget.style.background = showInsertMenu ? "var(--muted)" : "transparent")}>
            <Plus style={{ width: 11, height: 11 }} /> Insert
          </button>
          {showInsertMenu && <InsertMenu items={insertItems} onClose={() => setShowInsertMenu(false)} />}
        </div>

      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Style panel (left) */}
        {showStylePanel && (
          <StylePanelInline
            style={docStyle}
            onChange={patch => setDocStyle(prev => ({ ...prev, ...patch }))}
            extraPanel={stylePanel}
            onClose={() => setShowStylePanel(false)}
          />
        )}

        {/* Document canvas */}
        <div className="flex-1 overflow-y-auto" style={{ background: "var(--muted)" }}>
          <div style={{ padding: "32px 0 80px", display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 816, minHeight: 1056, background: docStyle.paperBg, boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px var(--border)", padding: "72px 96px" }}>
              {isLoading && !content ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, color: "var(--muted-foreground)", gap: 12 }}>
                  <Loader2 style={{ width: 32, height: 32, color: "var(--primary)" }} className="animate-spin" />
                  <span style={{ fontSize: 14 }}>Generating…</span>
                </div>
              ) : (
                <div
                  id={scopeId.current}
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onBlur={saveSel}
                  className="outline-none prose max-w-none prose-headings:font-semibold prose-h1:text-4xl prose-h1:mb-3 prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2 prose-p:my-2 prose-p:leading-relaxed prose-ul:my-3 prose-li:my-1"
                  style={{ minHeight: 900, color: "var(--foreground)", fontSize: 11, lineHeight: 1.65, caretColor: "var(--primary)" }}
                  data-placeholder="Start typing or ask the AI assistant to generate content…"
                />
              )}
            </div>
          </div>
        </div>

        {/* AI sidebar */}
        {aiEnabled && showAI && (
          <div className="flex flex-col shrink-0 print:hidden"
            style={{ width: 340, background: "var(--card)", borderLeft: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 px-4 shrink-0"
              style={{ height: 46, borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
              <Sparkles style={{ width: 15, height: 15, color: "var(--primary)" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>AI Coach</span>
              {selectedContext && (
                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: "var(--primary)", background: "rgba(217,119,87,0.10)", padding: "2px 8px", borderRadius: 20 }}>TEXT SELECTED</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {!aiMessages.filter(m => m.text).length && !isAiGenerating && (
                <div style={{ color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.5, padding: "16px 0" }}>
                  <p style={{ marginBottom: 8 }}>Highlight any text in the document, then ask me to:</p>
                  <ul style={{ paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
                    {["Rewrite it in a stronger tone", "Make it more concise", "Fix grammar and clarity", "Expand with more detail"].map(s => (
                      <li key={s} style={{ fontSize: 12 }}>· {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aiMessages.filter(m => m.text).map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "88%", borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "9px 13px", background: msg.role === "user" ? "var(--primary)" : "var(--muted)", color: msg.role === "user" ? "#fff" : "var(--foreground)", fontSize: 13, lineHeight: 1.5 }}>
                    <div className="prose prose-sm max-w-none" style={{ color: "inherit" }}>
                      <Markdown>{msg.text.includes("```markdown") ? msg.text.replace(/```(?:markdown|md)?\s*([\s\S]*?)```/g, "*(Updated document)*") : msg.text}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {isAiGenerating && (!aiMessages.length || aiMessages[aiMessages.length - 1].role !== "model" || !aiMessages[aiMessages.length - 1].text) && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "var(--muted)", borderRadius: "16px 16px 16px 4px", padding: "9px 13px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted-foreground)" }}>
                    <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> Thinking…
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
            <div style={{ padding: "10px 12px 12px", borderTop: "1px solid var(--border)", background: "var(--muted)" }}>
              {selectedContext && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 8, background: "rgba(217,119,87,0.08)", border: "1px solid rgba(217,119,87,0.2)", borderRadius: 8, padding: "7px 10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.05em", marginBottom: 2 }}>SELECTED</div>
                    <div style={{ fontSize: 12, color: "var(--foreground)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      "{selectedContext.length > 120 ? selectedContext.slice(0, 117) + "…" : selectedContext}"
                    </div>
                  </div>
                  <button onClick={() => setSelectedContext("")} style={{ flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", color: "var(--muted-foreground)", padding: 2, borderRadius: 4, display: "flex", alignItems: "center" }}>
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              )}
              <form onSubmit={handleAiSubmit} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <Textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                    placeholder={selectedContext ? "What would you like to do with the selection?" : aiPlaceholder}
                    className="min-h-[40px] max-h-28 resize-y"
                    style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, flex: 1, padding: "8px 10px", fontFamily: "inherit", color: "var(--foreground)" }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiSubmit(); } }} />
                  <button type="submit" disabled={!chatInput.trim() || isAiGenerating || !aiChat}
                    style={{ width: 38, height: 38, borderRadius: 10, background: "var(--primary)", border: "none", color: "#fff", cursor: chatInput.trim() && !isAiGenerating && aiChat ? "pointer" : "not-allowed", opacity: !chatInput.trim() || isAiGenerating || !aiChat ? 0.45 : 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "opacity 0.15s" }}>
                    <Send style={{ width: 15, height: 15 }} />
                  </button>
                </div>
                {!selectedContext && (
                  <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: 0, lineHeight: 1.4 }}>
                    Tip: highlight text in the document to give the AI specific context.
                  </p>
                )}
              </form>
            </div>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />

      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: var(--muted-foreground);
          opacity: 0.5;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
